package com.workpulse.activity;

import com.workpulse.activity.dto.ActivityDtos.ActivityBatchRequest;
import com.workpulse.activity.dto.ActivityDtos.ActivityBatchResponse;
import com.workpulse.activity.dto.ActivityDtos.ActivityEventDto;
import com.workpulse.activity.dto.ActivityDtos.RejectedEvent;
import com.workpulse.agent.dto.AgentDtos.AgentCommand;
import com.workpulse.common.messaging.EventPublisher;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.exception.ApiException;
import com.workpulse.exception.ErrorCode;
import com.workpulse.policies.PolicyService;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;
import com.workpulse.security.DevicePrincipal;
import com.workpulse.websocket.LiveStatusBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Idempotent ingestion of agent event batches. Duplicate events (same device + eventId) are
 * silently skipped, rejected events are reported back so the agent can dead-letter them.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityIngestionService {

    /** Payload keys that must never appear: the agent is not allowed to collect this content. */
    private static final Set<String> FORBIDDEN_KEYS = Set.of("keys", "keystrokes", "keycodes", "text", "clipboard",
            "screenshot", "image", "password", "url", "message", "messages", "fileContent", "windowTitle");
    private static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(5);

    private final ActivityEventJdbcRepository eventRepository;
    private final DeviceRepository deviceRepository;
    private final LiveStatusService liveStatusService;
    private final PolicyService policyService;
    private final EventPublisher eventPublisher;
    private final LiveStatusBroadcaster broadcaster;
    private final WorkPulseProperties properties;

    @Transactional
    public ActivityBatchResponse ingest(DevicePrincipal principal, ActivityBatchRequest request) {
        Device device = deviceRepository.findById(principal.deviceId())
                .orElseThrow(() -> ApiException.notFound("Device", principal.deviceId()));
        if (device.getStatus() != DeviceStatus.APPROVED) {
            throw new ApiException(ErrorCode.DEVICE_PENDING, "Device is awaiting approval; events are buffered on the agent");
        }
        if (request.events().size() > properties.agent().maxBatchEvents()) {
            throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE, "Batch exceeds " + properties.agent().maxBatchEvents() + " events");
        }
        Instant now = Instant.now();
        long offsetMs = request.clockOffsetMs() == null ? 0 : request.clockOffsetMs();
        List<RejectedEvent> rejected = new ArrayList<>();
        List<ActivityEventRecord> valid = new ArrayList<>(request.events().size());
        for (ActivityEventDto dto : request.events()) {
            ActivityEventType type = ActivityEventType.fromString(dto.type());
            if (type == ActivityEventType.UNKNOWN) {
                rejected.add(new RejectedEvent(dto.eventId(), "UNKNOWN_TYPE"));
                continue;
            }
            Map<String, Object> payload = dto.payload() == null ? Map.of() : dto.payload();
            String forbidden = findForbiddenKey(payload);
            if (forbidden != null) {
                rejected.add(new RejectedEvent(dto.eventId(), "FORBIDDEN_CONTENT:" + forbidden));
                continue;
            }
            Instant occurredAt = dto.occurredAt().plusMillis(offsetMs);
            if (occurredAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
                rejected.add(new RejectedEvent(dto.eventId(), "CLOCK_SKEW"));
                continue;
            }
            Map<String, Object> sanitized = new HashMap<>(payload);
            if (sanitized.get("processName") instanceof String p) {
                sanitized.put("processName", p.trim().toLowerCase(Locale.ROOT));
            }
            valid.add(new ActivityEventRecord(null, device.getOrganizationId(), device.getId(), device.getEmployeeId(),
                    dto.eventId(), type, occurredAt, now, dto.sequence(), dto.sessionId(), request.agentVersion(), sanitized));
        }

        int inserted = eventRepository.insertBatch(valid);
        int duplicates = valid.size() - inserted;

        device.setLastSeenAt(now);
        device.setLastSyncAt(now);
        device.setHealth(DeviceHealth.HEALTHY);
        if (request.agentVersion() != null && !request.agentVersion().isBlank()) {
            device.setAgentVersion(request.agentVersion());
        }

        if (inserted > 0) {
            liveStatusService.apply(device, valid).ifPresent(broadcaster::broadcast);
            eventPublisher.publish("activity.ingested", Map.of(
                    "organizationId", device.getOrganizationId().toString(),
                    "deviceId", device.getId().toString(),
                    "employeeId", device.getEmployeeId() == null ? "" : device.getEmployeeId().toString(),
                    "batchId", request.batchId().toString(),
                    "events", inserted));
        }

        EffectivePolicyResponse policy = policyService.effectiveFor(device.getOrganizationId(), device.getEmployeeId());
        List<AgentCommand> commands = new ArrayList<>();
        if (!rejected.isEmpty()) {
            log.info("Batch {} from device {}: {} rejected events", request.batchId(), device.getId(), rejected.size());
        }
        return new ActivityBatchResponse(request.batchId(), inserted, duplicates, rejected, now, policy.version(), commands);
    }

    private static String findForbiddenKey(Map<String, Object> payload) {
        for (String key : payload.keySet()) {
            if (FORBIDDEN_KEYS.contains(key)) {
                return key;
            }
        }
        return null;
    }
}
