package com.workpulse.agent;

import com.workpulse.agent.dto.AgentDtos.AgentCommand;
import com.workpulse.agent.dto.AgentDtos.HeartbeatRequest;
import com.workpulse.agent.dto.AgentDtos.HeartbeatResponse;
import com.workpulse.agent.dto.AgentDtos.RegisterDeviceRequest;
import com.workpulse.agent.dto.AgentDtos.RegisterDeviceResponse;
import com.workpulse.audit.AuditService;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.devices.AgentVersion;
import com.workpulse.devices.AgentVersionRepository;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.devices.DeviceService;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.exception.ErrorCode;
import com.workpulse.policies.PolicyService;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;
import com.workpulse.security.DevicePrincipal;
import com.workpulse.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AgentService {

    private final DeviceRepository deviceRepository;
    private final DeviceService deviceService;
    private final EmployeeRepository employeeRepository;
    private final AgentVersionRepository agentVersionRepository;
    private final PolicyService policyService;
    private final AuditService auditService;
    private final WorkPulseProperties properties;

    /** Called by the Electron UI with the employee's user JWT after sign-in. */
    @Transactional
    public RegisterDeviceResponse register(UserPrincipal principal, RegisterDeviceRequest request) {
        if (principal.isGuest()) {
            throw ApiException.forbidden("Guest sessions cannot register devices");
        }
        if (principal.getEmployeeId() == null || principal.getOrganizationId() == null) {
            throw ApiException.badRequest("Only accounts linked to an employee record can register a device");
        }
        Employee employee = employeeRepository.findByIdAndOrganizationId(principal.getEmployeeId(), principal.getOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Employee", principal.getEmployeeId()));

        Optional<Device> existing = deviceRepository.findByOrganizationIdAndMachineId(principal.getOrganizationId(), request.machineId().trim());
        Device device;
        boolean created = false;
        if (existing.isPresent()) {
            device = existing.get();
            if (device.getStatus() == DeviceStatus.REVOKED || device.getStatus() == DeviceStatus.RETIRED) {
                throw new ApiException(ErrorCode.DEVICE_REVOKED, "This device has been revoked. Ask your IT administrator to re-enable it.");
            }
        } else {
            device = new Device();
            device.setOrganizationId(principal.getOrganizationId());
            device.setMachineId(request.machineId().trim());
            device.setRegisteredAt(Instant.now());
            device.setStatus(properties.agent().autoApproveDevices() ? DeviceStatus.APPROVED : DeviceStatus.PENDING);
            if (device.getStatus() == DeviceStatus.APPROVED) {
                device.setApprovedAt(Instant.now());
            }
            created = true;
        }
        device.setEmployeeId(employee.getId());
        device.setHostname(request.hostname().trim());
        device.setOsName(request.osName());
        device.setOsVersion(request.osVersion());
        device.setAgentVersion(request.agentVersion());
        device.setHealth(DeviceHealth.HEALTHY);
        device.setLastSeenAt(Instant.now());
        if (request.metadata() != null) {
            device.setMetadata(request.metadata());
        }
        device = deviceRepository.save(device);
        String rawToken = deviceService.issueToken(device);

        auditService.record(created ? "DEVICE_REGISTERED" : "DEVICE_REREGISTERED", "DEVICE", device.getId(), null,
                Map.of("hostname", device.getHostname(), "employeeId", employee.getId().toString(), "status", device.getStatus().name()));

        EffectivePolicyResponse policy = policyService.effectiveFor(device.getOrganizationId(), employee.getId());
        return new RegisterDeviceResponse(device.getId(), rawToken, device.getStatus(), device.getOrganizationId(),
                employee.getId(), employee.getFullName(), policy);
    }

    @Transactional
    public HeartbeatResponse heartbeat(DevicePrincipal principal, HeartbeatRequest request) {
        Device device = deviceRepository.findById(principal.deviceId()).orElseThrow(() -> ApiException.notFound("Device", principal.deviceId()));
        device.setLastSeenAt(Instant.now());
        if (request.agentVersion() != null && !request.agentVersion().isBlank()) {
            device.setAgentVersion(request.agentVersion());
        }
        boolean degraded = Boolean.FALSE.equals(request.collectorConnected())
                || (request.queueDepth() != null && request.queueDepth() > 5000);
        device.setHealth(degraded ? DeviceHealth.DEGRADED : DeviceHealth.HEALTHY);
        Map<String, Object> meta = new HashMap<>(device.getMetadata());
        meta.put("queueDepth", request.queueDepth());
        meta.put("collectorConnected", request.collectorConnected());
        meta.put("uiConnected", request.uiConnected());
        meta.put("lastHeartbeatAt", Instant.now().toString());
        device.setMetadata(meta);

        EffectivePolicyResponse policy = policyService.effectiveFor(device.getOrganizationId(), device.getEmployeeId());
        List<AgentCommand> commands = new ArrayList<>();
        if (device.getStatus() == DeviceStatus.PENDING) {
            commands.add(new AgentCommand("PENDING_APPROVAL", Map.of()));
        }
        if (request.policyVersion() == null || request.policyVersion() != policy.version()) {
            commands.add(new AgentCommand("REFRESH_POLICY", Map.of("version", policy.version())));
        }
        agentVersionRepository.findFirstByChannelOrderByReleasedAtDesc("STABLE").ifPresent(latest -> {
            if (device.getAgentVersion() != null && compareVersions(device.getAgentVersion(), latest.getVersion()) < 0) {
                commands.add(new AgentCommand("UPDATE_AVAILABLE", updateParams(latest)));
            }
        });
        return new HeartbeatResponse(Instant.now(), device.getStatus(), device.getHealth(), policy.version(), commands);
    }

    @Transactional(readOnly = true)
    public EffectivePolicyResponse policy(DevicePrincipal principal) {
        return policyService.effectiveFor(principal.organizationId(), principal.employeeId());
    }

    private static Map<String, Object> updateParams(AgentVersion v) {
        Map<String, Object> params = new HashMap<>();
        params.put("version", v.getVersion());
        params.put("url", v.getDownloadUrl());
        params.put("sha256", v.getSha256());
        params.put("mandatory", v.isMandatory());
        return params;
    }

    static int compareVersions(String a, String b) {
        String[] pa = a.split("[.-]");
        String[] pb = b.split("[.-]");
        for (int i = 0; i < Math.max(pa.length, pb.length); i++) {
            int x = i < pa.length ? parse(pa[i]) : 0;
            int y = i < pb.length ? parse(pb[i]) : 0;
            if (x != y) {
                return Integer.compare(x, y);
            }
        }
        return 0;
    }

    private static int parse(String s) {
        try {
            return Integer.parseInt(s.replaceAll("\\D", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
