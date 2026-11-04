package com.workpulse.activity;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Row of the partitioned {@code activity_events} table (accessed through JDBC, not JPA). */
public record ActivityEventRecord(
        Long id,
        UUID organizationId,
        UUID deviceId,
        UUID employeeId,
        UUID eventId,
        ActivityEventType eventType,
        Instant occurredAt,
        Instant receivedAt,
        Long sequence,
        UUID sessionId,
        String agentVersion,
        Map<String, Object> payload
) {
    public String payloadString(String key) {
        Object v = payload == null ? null : payload.get(key);
        return v == null ? null : String.valueOf(v);
    }

    public long payloadLong(String key, long defaultValue) {
        Object v = payload == null ? null : payload.get(key);
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v instanceof String s) {
            try {
                return Long.parseLong(s);
            } catch (NumberFormatException ignored) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
}
