package com.workpulse.agent.dto;

import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AgentDtos {

    private AgentDtos() {}

    public record RegisterDeviceRequest(@NotBlank @Size(max = 120) String hostname,
                                        @NotBlank @Size(max = 128) String machineId,
                                        @Size(max = 80) String osName,
                                        @Size(max = 80) String osVersion,
                                        @NotBlank @Size(max = 32) String agentVersion,
                                        Map<String, Object> metadata) {}

    public record RegisterDeviceResponse(UUID deviceId, String deviceToken, DeviceStatus status, UUID organizationId,
                                         UUID employeeId, String employeeName, EffectivePolicyResponse policy) {}

    public record HeartbeatRequest(@Size(max = 32) String agentVersion, Integer queueDepth, Instant lastSyncAt,
                                   Boolean collectorConnected, Boolean uiConnected, Integer policyVersion, UUID currentSessionId) {}

    public record AgentCommand(String type, Map<String, Object> params) {}

    public record HeartbeatResponse(Instant serverTime, DeviceStatus deviceStatus, DeviceHealth health, int policyVersion,
                                    List<AgentCommand> commands) {}
}
