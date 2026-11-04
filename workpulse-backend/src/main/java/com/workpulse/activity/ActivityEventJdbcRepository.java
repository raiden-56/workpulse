package com.workpulse.activity;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * JDBC access to the partitioned {@code activity_events} table. Inserts are idempotent through
 * {@code ON CONFLICT DO NOTHING} on {@code (device_id, event_id, occurred_at)}.
 */
@Repository
@RequiredArgsConstructor
public class ActivityEventJdbcRepository {

    private static final String INSERT_SQL = """
            INSERT INTO activity_events (organization_id, device_id, employee_id, event_id, event_type, occurred_at,
                                         received_at, sequence, session_id, agent_version, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
            ON CONFLICT (device_id, event_id, occurred_at) DO NOTHING
            """;

    private static final String SELECT_COLUMNS = """
            SELECT id, organization_id, device_id, employee_id, event_id, event_type, occurred_at, received_at,
                   sequence, session_id, agent_version, payload::text AS payload
            FROM activity_events
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /** @return number of rows actually inserted (duplicates are skipped). */
    public int insertBatch(List<ActivityEventRecord> records) {
        if (records.isEmpty()) {
            return 0;
        }
        List<Object[]> args = records.stream().map(r -> new Object[]{
                r.organizationId(), r.deviceId(), r.employeeId(), r.eventId(), r.eventType().name(),
                Timestamp.from(r.occurredAt()), Timestamp.from(r.receivedAt() == null ? Instant.now() : r.receivedAt()),
                r.sequence(), r.sessionId(), r.agentVersion(), toJson(r.payload())
        }).toList();
        int[] counts = jdbc.batchUpdate(INSERT_SQL, args);
        int inserted = 0;
        for (int c : counts) {
            if (c > 0) {
                inserted += c;
            }
        }
        return inserted;
    }

    public List<ActivityEventRecord> findForEmployee(UUID organizationId, UUID employeeId, Instant from, Instant to) {
        return jdbc.query(SELECT_COLUMNS + " WHERE organization_id = ? AND employee_id = ? AND occurred_at >= ? AND occurred_at < ? "
                        + "ORDER BY occurred_at ASC, sequence ASC NULLS FIRST",
                rowMapper(), organizationId, employeeId, Timestamp.from(from), Timestamp.from(to));
    }

    public long countInRange(UUID organizationId, Instant from, Instant to) {
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM activity_events WHERE organization_id = ? AND occurred_at >= ? AND occurred_at < ?",
                Long.class, organizationId, Timestamp.from(from), Timestamp.from(to));
        return count == null ? 0 : count;
    }

    public record AppDurationRow(String processName, String appName, long durationMs, long employees) {}

    /** Aggregated foreground time per application; {@code employeeIds == null} means whole organisation. */
    public List<AppDurationRow> aggregateForegroundByApp(UUID organizationId, Collection<UUID> employeeIds,
                                                         Instant from, Instant to, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT lower(payload->>'processName') AS process_name,
                       max(payload->>'appName') AS app_name,
                       sum(COALESCE((payload->>'durationMs')::bigint, 0)) AS duration_ms,
                       count(DISTINCT employee_id) AS employees
                FROM activity_events
                WHERE organization_id = ? AND event_type = 'FOREGROUND_APP' AND occurred_at >= ? AND occurred_at < ?
                """);
        java.util.ArrayList<Object> params = new java.util.ArrayList<>(List.of(organizationId, Timestamp.from(from), Timestamp.from(to)));
        if (employeeIds != null) {
            if (employeeIds.isEmpty()) {
                return List.of();
            }
            sql.append(" AND employee_id = ANY(?)");
            params.add(employeeIds.toArray(new UUID[0]));
        }
        sql.append(" GROUP BY lower(payload->>'processName') ORDER BY duration_ms DESC LIMIT ?");
        params.add(limit);
        return jdbc.query(sql.toString(), (rs, i) -> new AppDurationRow(
                rs.getString("process_name"), rs.getString("app_name"), rs.getLong("duration_ms"), rs.getLong("employees")),
                params.toArray());
    }

    public record DailyActivityRow(java.time.LocalDate day, long activeEmployees, long foregroundMs, long idleEvents) {}

    /** Per-day activity totals in the organisation timezone; {@code employeeIds == null} means whole organisation. */
    public List<DailyActivityRow> dailyActivity(UUID organizationId, Collection<UUID> employeeIds, Instant from, Instant to, String timezone) {
        StringBuilder sql = new StringBuilder("""
                SELECT (occurred_at AT TIME ZONE ?)::date AS day,
                       count(DISTINCT employee_id) FILTER (WHERE event_type = 'FOREGROUND_APP') AS active_employees,
                       sum(COALESCE((payload->>'durationMs')::bigint, 0)) FILTER (WHERE event_type = 'FOREGROUND_APP') AS foreground_ms,
                       count(*) FILTER (WHERE event_type = 'IDLE_START') AS idle_events
                FROM activity_events
                WHERE organization_id = ? AND occurred_at >= ? AND occurred_at < ?
                """);
        java.util.ArrayList<Object> params = new java.util.ArrayList<>(List.of(timezone, organizationId, Timestamp.from(from), Timestamp.from(to)));
        if (employeeIds != null) {
            if (employeeIds.isEmpty()) {
                return List.of();
            }
            sql.append(" AND employee_id = ANY(?)");
            params.add(employeeIds.toArray(new UUID[0]));
        }
        sql.append(" GROUP BY 1 ORDER BY 1");
        return jdbc.query(sql.toString(), (rs, i) -> new DailyActivityRow(
                rs.getDate("day").toLocalDate(), rs.getLong("active_employees"), rs.getLong("foreground_ms"), rs.getLong("idle_events")),
                params.toArray());
    }

    public List<ActivityEventRecord> findRecent(UUID organizationId, Collection<UUID> employeeIds, int limit) {
        if (employeeIds != null) {
            if (employeeIds.isEmpty()) {
                return List.of();
            }
            return jdbc.query(SELECT_COLUMNS + " WHERE organization_id = ? AND employee_id = ANY(?) AND event_type IN ('SESSION_START','SESSION_END','SESSION_LOCK','SESSION_UNLOCK','IDLE_START','IDLE_END','BREAK_START','BREAK_END','AGENT_STARTED','AGENT_STOPPED') ORDER BY occurred_at DESC LIMIT ?",
                    rowMapper(), organizationId, employeeIds.toArray(new UUID[0]), limit);
        }
        return jdbc.query(SELECT_COLUMNS + " WHERE organization_id = ? AND event_type IN ('SESSION_START','SESSION_END','SESSION_LOCK','SESSION_UNLOCK','IDLE_START','IDLE_END','BREAK_START','BREAK_END','AGENT_STARTED','AGENT_STOPPED') ORDER BY occurred_at DESC LIMIT ?",
                rowMapper(), organizationId, limit);
    }

    public int deleteForOrganization(UUID organizationId) {
        return jdbc.update("DELETE FROM activity_events WHERE organization_id = ?", organizationId);
    }

    private RowMapper<ActivityEventRecord> rowMapper() {
        return (ResultSet rs, int rowNum) -> new ActivityEventRecord(
                rs.getLong("id"),
                rs.getObject("organization_id", UUID.class),
                rs.getObject("device_id", UUID.class),
                rs.getObject("employee_id", UUID.class),
                rs.getObject("event_id", UUID.class),
                ActivityEventType.fromString(rs.getString("event_type")),
                toInstant(rs.getTimestamp("occurred_at")),
                toInstant(rs.getTimestamp("received_at")),
                rs.getObject("sequence") == null ? null : rs.getLong("sequence"),
                rs.getObject("session_id", UUID.class),
                rs.getString("agent_version"),
                fromJson(rs.getString("payload")));
    }

    private static Instant toInstant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Unserialisable event payload", e);
        }
    }

    private Map<String, Object> fromJson(String json) throws SQLException {
        try {
            return json == null ? Map.of() : objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            throw new SQLException("Corrupt event payload", e);
        }
    }
}
