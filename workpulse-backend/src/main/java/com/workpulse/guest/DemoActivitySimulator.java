package com.workpulse.guest;

import com.workpulse.activity.ActivityEventJdbcRepository;
import com.workpulse.activity.ActivityEventRecord;
import com.workpulse.activity.ActivityEventType;
import com.workpulse.activity.ActivityState;
import com.workpulse.activity.LiveStatus;
import com.workpulse.activity.LiveStatusRepository;
import com.workpulse.activity.LiveStatusService;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.employees.EmploymentStatus;
import com.workpulse.organizations.Organization;
import com.workpulse.organizations.OrganizationRepository;
import com.workpulse.websocket.LiveStatusBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Plays the role of the desktop agents for the demo organisation so Guest Mode shows a living
 * workforce. Once a minute, during the demo organisation's working hours, it produces the same event
 * types a real agent would and pushes them through the real ingestion path (event store, live status
 * derivation, WebSocket broadcast). It only ever touches the organisation flagged {@code is_demo}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DemoActivitySimulator {

    private static final Map<String, String[]> APPS_BY_PROFILE = Map.of(
            "DEVELOPER", new String[]{"code.exe", "idea64.exe", "windowsterminal.exe", "chrome.exe", "slack.exe", "postman.exe"},
            "ANALYST", new String[]{"pycharm64.exe", "dbeaver.exe", "excel.exe", "chrome.exe", "powerpnt.exe"},
            "DESIGNER", new String[]{"figma.exe", "chrome.exe", "notion.exe", "slack.exe"},
            "PRODUCT", new String[]{"notion.exe", "chrome.exe", "excel.exe", "powerpnt.exe", "outlook.exe"},
            "SUPPORT", new String[]{"chrome.exe", "outlook.exe", "slack.exe", "notepad++.exe", "excel.exe"},
            "FINANCE", new String[]{"excel.exe", "saplogon.exe", "outlook.exe", "acrobat.exe"},
            "HR", new String[]{"outlook.exe", "chrome.exe", "excel.exe", "winword.exe"},
            "SALES", new String[]{"outlook.exe", "chrome.exe", "powerpnt.exe", "excel.exe", "zoom.exe"},
            "GENERAL", new String[]{"chrome.exe", "outlook.exe", "excel.exe", "winword.exe"});

    private static final LocalTime DAY_START = LocalTime.of(8, 45);
    private static final LocalTime DAY_END = LocalTime.of(18, 45);
    private static final LocalTime LUNCH_FROM = LocalTime.of(12, 45);
    private static final LocalTime LUNCH_TO = LocalTime.of(13, 30);

    private final WorkPulseProperties properties;
    private final OrganizationRepository organizationRepository;
    private final EmployeeRepository employeeRepository;
    private final DeviceRepository deviceRepository;
    private final LiveStatusRepository liveStatusRepository;
    private final ActivityEventJdbcRepository eventRepository;
    private final LiveStatusService liveStatusService;
    private final LiveStatusBroadcaster broadcaster;
    private final Random random = new Random();

    @Scheduled(fixedDelayString = "PT60S", initialDelayString = "PT75S")
    public void tick() {
        if (!properties.demo().enabled()) {
            return;
        }
        organizationRepository.findFirstByDemoTrue()
                .ifPresent(org -> simulate(ZonedDateTime.now(ZoneId.of(org.getTimezone()))));
    }

    /** One simulation step at the given (demo organisation local) time. @return number of events produced. */
    @Transactional
    public int simulate(ZonedDateTime now) {
        Organization org = organizationRepository.findFirstByDemoTrue().orElse(null);
        if (org == null) {
            return 0;
        }
        LocalTime time = now.toLocalTime();
        boolean workday = now.getDayOfWeek() != DayOfWeek.SATURDAY && now.getDayOfWeek() != DayOfWeek.SUNDAY;
        boolean withinDay = workday && time.isAfter(DAY_START) && time.isBefore(DAY_END);
        boolean lunch = time.isAfter(LUNCH_FROM) && time.isBefore(LUNCH_TO);
        boolean lateDay = time.isAfter(LocalTime.of(17, 30));
        boolean earlyDay = time.isBefore(LocalTime.of(10, 30));

        List<Employee> employees = employeeRepository.findByOrganizationId(org.getId()).stream()
                .filter(e -> e.getEmploymentStatus() == EmploymentStatus.ACTIVE).toList();
        if (employees.isEmpty()) {
            return 0;
        }
        Map<UUID, Device> deviceByEmployee = new HashMap<>();
        deviceRepository.findByOrganizationIdAndEmployeeIdIn(org.getId(), employees.stream().map(Employee::getId).toList()).stream()
                .filter(d -> d.getStatus() == DeviceStatus.APPROVED)
                .forEach(d -> deviceByEmployee.putIfAbsent(d.getEmployeeId(), d));
        Map<UUID, LiveStatus> statuses = liveStatusRepository.findByOrganizationIdAndEmployeeIdIn(org.getId(), deviceByEmployee.keySet()).stream()
                .collect(Collectors.toMap(LiveStatus::getEmployeeId, Function.identity()));

        int produced = 0;
        Instant at = now.toInstant();
        for (Employee employee : employees) {
            Device device = deviceByEmployee.get(employee.getId());
            if (device == null) {
                continue;
            }
            LiveStatus status = statuses.get(employee.getId());
            ActivityState state = status == null ? ActivityState.OFFLINE : status.getStatus();
            boolean online = state != ActivityState.OFFLINE;
            List<ActivityEventRecord> events = new ArrayList<>();
            String[] apps = APPS_BY_PROFILE.getOrDefault(employee.getRoleProfile(), APPS_BY_PROFILE.get("GENERAL"));
            UUID sessionId = status == null || status.getSessionId() == null ? UUID.randomUUID() : status.getSessionId();

            if (!withinDay) {
                if (online && random.nextDouble() < 0.5) {
                    events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.SESSION_END, at, Map.of("reason", "LOGOFF")));
                }
            } else if (!online) {
                double chance = earlyDay ? 0.25 : 0.03;
                if (random.nextDouble() < chance) {
                    UUID newSession = UUID.randomUUID();
                    events.add(event(org.getId(), device, employee, newSession, ActivityEventType.AGENT_STARTED, at.minusSeconds(30),
                            Map.of("agentVersion", device.getAgentVersion() == null ? "1.0.0" : device.getAgentVersion(), "hostname", device.getHostname())));
                    events.add(event(org.getId(), device, employee, newSession, ActivityEventType.SESSION_START, at.minusSeconds(20),
                            Map.of("windowsUser", "NORTHWIND\\" + employee.getWorkEmail().split("@")[0], "sessionKind", "CONSOLE")));
                    events.add(foreground(org.getId(), device, employee, newSession, at, pick(apps)));
                }
            } else {
                switch (state) {
                    case LOCKED -> {
                        if (random.nextDouble() < (lunch ? 0.08 : 0.25)) {
                            events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.SESSION_UNLOCK, at.minusSeconds(5), Map.of()));
                            events.add(foreground(org.getId(), device, employee, sessionId, at, pick(apps)));
                        }
                    }
                    case BREAK -> {
                        if (random.nextDouble() < (lunch ? 0.08 : 0.3)) {
                            events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.BREAK_END, at.minusSeconds(5), Map.of("breakType", "DECLARED")));
                            events.add(foreground(org.getId(), device, employee, sessionId, at, pick(apps)));
                        }
                    }
                    case IDLE -> {
                        if (random.nextDouble() < 0.3) {
                            long idleSeconds = status.getSinceAt() == null ? 300 : Math.max(300, at.getEpochSecond() - status.getSinceAt().getEpochSecond());
                            events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.IDLE_END, at.minusSeconds(5), Map.of("idleSeconds", idleSeconds)));
                            events.add(foreground(org.getId(), device, employee, sessionId, at, pick(apps)));
                        }
                    }
                    default -> {
                        double r = random.nextDouble();
                        if (lunch && r < 0.12) {
                            if (random.nextBoolean()) {
                                events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.SESSION_LOCK, at, Map.of()));
                            } else {
                                events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.BREAK_START, at, Map.of("breakType", "DECLARED", "note", "Lunch")));
                            }
                        } else if (r < 0.05) {
                            events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.IDLE_START, at,
                                    Map.of("lastInputAt", at.minusSeconds(300).toString(), "thresholdSeconds", 300)));
                        } else if (lateDay && r < 0.12) {
                            events.add(event(org.getId(), device, employee, sessionId, ActivityEventType.SESSION_END, at, Map.of("reason", "LOGOFF")));
                        } else if (r < 0.22) {
                            events.add(foreground(org.getId(), device, employee, sessionId, at, random.nextDouble() < 0.3 ? "ms-teams.exe" : pick(apps)));
                        } else {
                            String current = status.getForegroundProcess() == null ? pick(apps) : status.getForegroundProcess();
                            events.add(foreground(org.getId(), device, employee, sessionId, at, current));
                        }
                    }
                }
            }
            if (events.isEmpty()) {
                continue;
            }
            produced += eventRepository.insertBatch(events);
            liveStatusService.apply(device, events).ifPresent(broadcaster::broadcast);
            device.setLastSeenAt(at);
            device.setLastSyncAt(at);
            device.setHealth(DeviceHealth.HEALTHY);
        }
        if (produced > 0) {
            log.debug("Demo simulator produced {} events", produced);
        }
        return produced;
    }

    private String pick(String[] apps) {
        return apps[random.nextInt(apps.length)];
    }

    private static ActivityEventRecord foreground(UUID orgId, Device device, Employee employee, UUID sessionId, Instant at, String process) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("processName", process);
        payload.put("pid", 1000 + Math.abs(process.hashCode() % 9000));
        payload.put("durationMs", 60_000);
        return event(orgId, device, employee, sessionId, ActivityEventType.FOREGROUND_APP, at, payload);
    }

    private static ActivityEventRecord event(UUID orgId, Device device, Employee employee, UUID sessionId, ActivityEventType type,
                                             Instant at, Map<String, Object> payload) {
        return new ActivityEventRecord(null, orgId, device.getId(), employee.getId(), UUID.randomUUID(), type, at, Instant.now(),
                null, sessionId, device.getAgentVersion(), payload);
    }
}
