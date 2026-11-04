package com.workpulse.activity.dto;

import com.workpulse.activity.ActivityState;
import com.workpulse.agent.dto.AgentDtos.AgentCommand;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ActivityDtos {

    private ActivityDtos() {}

    public record ActivityEventDto(@NotNull UUID eventId, Long sequence, @NotBlank String type, @NotNull Instant occurredAt,
                                   UUID sessionId, Map<String, Object> payload) {}

    public record ActivityBatchRequest(@NotNull UUID batchId, UUID deviceId, @Size(max = 32) String agentVersion, Instant sentAt,
                                       Long clockOffsetMs, @NotEmpty @Size(max = 500) List<@Valid ActivityEventDto> events) {}

    public record RejectedEvent(UUID eventId, String reason) {}

    public record ActivityBatchResponse(UUID batchId, int accepted, int duplicates, List<RejectedEvent> rejected,
                                        Instant serverTime, int policyVersion, List<AgentCommand> commands) {}

    public record LiveStatusResponse(UUID employeeId, String employeeCode, String employeeName, UUID departmentId, String departmentName,
                                     UUID teamId, String teamName, ActivityState status, String foregroundApp, String foregroundProcess,
                                     UUID deviceId, String deviceName, String deviceHealth, String agentVersion, Instant lastSyncAt,
                                     Instant sessionStartedAt, Long sessionDurationSeconds, Instant sinceAt, String reason) {}

    public record LiveSummary(long total, Map<String, Long> byStatus) {}

    public record TimelineInterval(Instant startedAt, Instant endedAt, long durationSeconds, ActivityState state,
                                   String processName, String appName, String category, String reason) {}

    public record TimelineSummary(long sessionSeconds, long activeSeconds, long focusSeconds, long meetingSeconds, long idleSeconds,
                                  long breakSeconds, long lockedSeconds, long unknownSeconds, Instant firstEventAt, Instant lastEventAt,
                                  int applicationSwitches) {}

    public record AppUsage(String processName, String appName, String category, long durationSeconds) {}

    public record TimelineResponse(UUID employeeId, String employeeName, LocalDate date, String timezone,
                                   List<TimelineInterval> intervals, TimelineSummary summary, List<AppUsage> topApplications) {}
}
