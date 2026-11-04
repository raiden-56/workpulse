package com.workpulse.websocket;

import com.workpulse.activity.LiveStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/** Pushes live status deltas to {@code /topic/org.{orgId}.live}. */
@Component
@RequiredArgsConstructor
@Slf4j
public class LiveStatusBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public record LiveStatusDelta(UUID employeeId, String status, String foregroundApp, String foregroundProcess, UUID deviceId,
                                  Instant since, Instant sessionStartedAt, String reason, Instant updatedAt) {}

    public void broadcast(LiveStatus status) {
        try {
            messagingTemplate.convertAndSend("/topic/org." + status.getOrganizationId() + ".live",
                    new LiveStatusDelta(status.getEmployeeId(), status.getStatus().name(), status.getForegroundApp(),
                            status.getForegroundProcess(), status.getDeviceId(), status.getSinceAt(), status.getSessionStartedAt(),
                            status.getReason(), status.getUpdatedAt()));
        } catch (Exception ex) {
            log.debug("Live status broadcast failed: {}", ex.getMessage());
        }
    }
}
