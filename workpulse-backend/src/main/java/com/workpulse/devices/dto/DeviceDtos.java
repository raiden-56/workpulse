package com.workpulse.devices.dto;

import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class DeviceDtos {

    private DeviceDtos() {}

    public record DeviceResponse(UUID id, String hostname, String machineId, String osName, String osVersion, String agentVersion,
                                 DeviceStatus status, DeviceHealth health, UUID employeeId, String employeeName,
                                 String departmentName, Instant lastSeenAt, Instant lastSyncAt, Instant registeredAt,
                                 Instant approvedAt, Instant revokedAt, Map<String, Object> metadata) {}

    public record UpdateDeviceRequest(@Size(max = 120) String hostname, Map<String, Object> metadata) {}

    public record AssignDeviceEmployeeRequest(@NotNull UUID employeeId) {}

    public record DeviceFilter(String q, DeviceStatus status, DeviceHealth health, UUID employeeId, UUID departmentId) {}

    public record DeviceSummary(long total, long approved, long pending, long revoked, long connected, long disconnected,
                                long healthy, long degraded, long offline) {}
}
