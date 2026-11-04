package com.workpulse.activity;

import com.workpulse.applications.ApplicationCatalogService;
import com.workpulse.applications.ApplicationCategory;
import com.workpulse.devices.Device;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Applies incoming agent events to the employee's live status and logon sessions, attaching a
 * human-readable reason to every state so the live monitoring page can explain itself.
 */
@Service
@RequiredArgsConstructor
public class LiveStatusService {

    static final Duration FOCUS_THRESHOLD = Duration.ofMinutes(25);

    private final LiveStatusRepository liveStatusRepository;
    private final EmployeeSessionRepository sessionRepository;
    private final ApplicationCatalogService catalog;

    /** @return the updated status if it changed, otherwise empty. */
    @Transactional
    public Optional<LiveStatus> apply(Device device, List<ActivityEventRecord> events) {
        if (device.getEmployeeId() == null || events.isEmpty()) {
            return Optional.empty();
        }
        List<ActivityEventRecord> ordered = new ArrayList<>(events);
        ordered.sort(Comparator.comparing(ActivityEventRecord::occurredAt)
                .thenComparing(e -> e.sequence() == null ? Long.MAX_VALUE : e.sequence()));

        LiveStatus status = liveStatusRepository.findById(device.getEmployeeId()).orElseGet(() -> {
            LiveStatus s = new LiveStatus();
            s.setEmployeeId(device.getEmployeeId());
            s.setOrganizationId(device.getOrganizationId());
            s.setStatus(ActivityState.OFFLINE);
            return s;
        });
        ActivityState before = status.getStatus();
        String beforeApp = status.getForegroundProcess();
        Instant lastEvent = status.getLastEventAt();

        for (ActivityEventRecord event : ordered) {
            if (lastEvent != null && event.occurredAt().isBefore(lastEvent.minus(Duration.ofMinutes(10)))) {
                continue; // stale replay far in the past: data is stored, but it must not rewind the live state
            }
            status.setDeviceId(device.getId());
            switch (event.eventType()) {
                case SESSION_START -> {
                    EmployeeSession session = startSession(device, event);
                    status.setSessionId(session.getId());
                    status.setSessionStartedAt(session.getStartedAt());
                    transition(status, ActivityState.UNKNOWN, event.occurredAt(), "Signed in to Windows, waiting for activity");
                    status.setForegroundProcess(null);
                    status.setForegroundApp(null);
                }
                case SESSION_END -> {
                    endSession(device, event, Objects.requireNonNullElse(event.payloadString("reason"), "LOGOFF"));
                    transition(status, ActivityState.OFFLINE, event.occurredAt(), "Signed out of Windows");
                    status.setForegroundProcess(null);
                    status.setForegroundApp(null);
                }
                case SESSION_LOCK -> transition(status, ActivityState.LOCKED, event.occurredAt(), "Workstation locked");
                case SESSION_UNLOCK -> transition(status, ActivityState.UNKNOWN, event.occurredAt(), "Workstation unlocked, waiting for activity");
                case IDLE_START -> transition(status, ActivityState.IDLE, event.occurredAt(),
                        "No keyboard or mouse input for " + event.payloadLong("thresholdSeconds", 300) / 60 + " min (may still be working away from the keyboard)");
                case IDLE_END -> transition(status, ActivityState.UNKNOWN, event.occurredAt(), "Input resumed, waiting for application sample");
                case BREAK_START -> transition(status, ActivityState.BREAK, event.occurredAt(),
                        "Employee-declared break" + (event.payloadString("note") == null ? "" : ": " + event.payloadString("note")));
                case BREAK_END -> transition(status, ActivityState.UNKNOWN, event.occurredAt(), "Break ended, waiting for activity");
                case AGENT_STOPPED -> transition(status, ActivityState.OFFLINE, event.occurredAt(), "Agent stopped (" + Objects.requireNonNullElse(event.payloadString("reason"), "unknown") + ")");
                case FOREGROUND_APP -> applyForeground(status, event);
                case AGENT_HEARTBEAT -> sessionRepository.findFirstByDeviceIdAndEndedAtIsNullOrderByStartedAtDesc(device.getId())
                        .ifPresent(s -> { s.setLastHeartbeatAt(event.occurredAt()); s.setUpdatedAt(Instant.now()); });
                default -> { /* informational events do not change the live state */ }
            }
            if (status.getLastEventAt() == null || event.occurredAt().isAfter(status.getLastEventAt())) {
                status.setLastEventAt(event.occurredAt());
            }
        }
        status.setUpdatedAt(Instant.now());
        LiveStatus saved = liveStatusRepository.save(status);
        boolean changed = before != saved.getStatus() || !Objects.equals(beforeApp, saved.getForegroundProcess());
        return changed ? Optional.of(saved) : Optional.empty();
    }

    private void applyForeground(LiveStatus status, ActivityEventRecord event) {
        String process = event.payloadString("processName");
        if (process == null) {
            return;
        }
        process = process.toLowerCase();
        String appName = catalog.displayNameOf(process, event.payloadString("appName"));
        ApplicationCategory category = catalog.categoryOf(process);
        if (status.getStatus() == ActivityState.LOCKED || status.getStatus() == ActivityState.BREAK) {
            return; // a stray sample while locked / on a declared break does not override the explicit state
        }
        boolean sameApp = process.equals(status.getForegroundProcess());
        if (category == ApplicationCategory.MEETING) {
            if (status.getStatus() != ActivityState.MEETING || !sameApp) {
                transition(status, ActivityState.MEETING, event.occurredAt(), appName + " in the foreground (meeting application)");
            }
        } else if (sameApp && (status.getStatus() == ActivityState.ACTIVE_APPLICATION || status.getStatus() == ActivityState.FOCUS_SESSION)) {
            if (status.getStatus() == ActivityState.ACTIVE_APPLICATION && status.getSinceAt() != null
                    && Duration.between(status.getSinceAt(), event.occurredAt()).compareTo(FOCUS_THRESHOLD) >= 0) {
                status.setStatus(ActivityState.FOCUS_SESSION); // keep sinceAt: the focus block started when the app did
                status.setReason(appName + " in the foreground for over " + FOCUS_THRESHOLD.toMinutes() + " minutes without idle or switching");
            }
        } else {
            transition(status, ActivityState.ACTIVE_APPLICATION, event.occurredAt(), appName + " in the foreground");
        }
        status.setForegroundProcess(process);
        status.setForegroundApp(appName);
    }

    private static void transition(LiveStatus status, ActivityState next, Instant at, String reason) {
        if (status.getStatus() != next) {
            status.setSinceAt(at);
        }
        status.setStatus(next);
        status.setReason(reason);
    }

    private EmployeeSession startSession(Device device, ActivityEventRecord event) {
        if (event.sessionId() != null) {
            Optional<EmployeeSession> existing = sessionRepository.findByDeviceIdAndAgentSessionId(device.getId(), event.sessionId());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        sessionRepository.findFirstByDeviceIdAndEndedAtIsNullOrderByStartedAtDesc(device.getId()).ifPresent(open -> {
            open.setEndedAt(event.occurredAt());
            open.setEndReason("UNKNOWN");
            open.setUpdatedAt(Instant.now());
        });
        EmployeeSession session = new EmployeeSession();
        session.setOrganizationId(device.getOrganizationId());
        session.setEmployeeId(device.getEmployeeId());
        session.setDeviceId(device.getId());
        session.setAgentSessionId(event.sessionId());
        session.setStartedAt(event.occurredAt());
        session.setLastHeartbeatAt(event.occurredAt());
        return sessionRepository.save(session);
    }

    private void endSession(Device device, ActivityEventRecord event, String reason) {
        Optional<EmployeeSession> session = event.sessionId() == null ? Optional.empty()
                : sessionRepository.findByDeviceIdAndAgentSessionId(device.getId(), event.sessionId());
        if (session.isEmpty()) {
            session = sessionRepository.findFirstByDeviceIdAndEndedAtIsNullOrderByStartedAtDesc(device.getId());
        }
        session.ifPresent(s -> {
            if (s.getEndedAt() == null) {
                s.setEndedAt(event.occurredAt());
                s.setEndReason(reason);
                s.setUpdatedAt(Instant.now());
            }
        });
    }

    @Transactional
    public LiveStatus upsert(UUID organizationId, UUID employeeId, ActivityState state, String reason, Instant since, UUID deviceId,
                             String process, String app, Instant sessionStartedAt) {
        LiveStatus s = liveStatusRepository.findById(employeeId).orElseGet(LiveStatus::new);
        s.setEmployeeId(employeeId);
        s.setOrganizationId(organizationId);
        s.setStatus(state);
        s.setReason(reason);
        s.setSinceAt(since);
        s.setDeviceId(deviceId);
        s.setForegroundProcess(process);
        s.setForegroundApp(app);
        s.setSessionStartedAt(sessionStartedAt);
        s.setLastEventAt(since);
        s.setUpdatedAt(Instant.now());
        return liveStatusRepository.save(s);
    }
}
