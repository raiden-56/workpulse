package com.workpulse.devices;

import com.workpulse.audit.AuditService;
import com.workpulse.common.util.HashUtil;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.departments.Department;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.devices.dto.DeviceDtos.DeviceFilter;
import com.workpulse.devices.dto.DeviceDtos.DeviceResponse;
import com.workpulse.devices.dto.DeviceDtos.DeviceSummary;
import com.workpulse.devices.dto.DeviceDtos.UpdateDeviceRequest;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.security.AccessScopeService;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final AccessScopeService accessScopeService;
    private final AuditService auditService;
    private final WorkPulseProperties properties;

    @Transactional(readOnly = true)
    public Page<DeviceResponse> list(DeviceFilter filter, Pageable pageable) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID organizationId = TenantContext.require();
        Optional<Set<UUID>> visible = accessScopeService.visibleEmployeeIds(principal);
        if (visible.isPresent() && visible.get().isEmpty()) {
            return Page.empty(pageable);
        }
        Set<UUID> departmentEmployees = filter.departmentId() == null ? null
                : employeeRepository.findIdsInScope(organizationId, List.of(filter.departmentId()), List.of(new UUID(0, 0)))
                .stream().collect(Collectors.toSet());
        Specification<Device> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            visible.ifPresent(ids -> predicates.add(root.get("employeeId").in(ids)));
            if (filter.status() != null) predicates.add(cb.equal(root.get("status"), filter.status()));
            if (filter.health() != null) predicates.add(cb.equal(root.get("health"), filter.health()));
            if (filter.employeeId() != null) predicates.add(cb.equal(root.get("employeeId"), filter.employeeId()));
            if (departmentEmployees != null) {
                predicates.add(departmentEmployees.isEmpty() ? cb.disjunction() : root.get("employeeId").in(departmentEmployees));
            }
            if (filter.q() != null && !filter.q().isBlank()) {
                String like = "%" + filter.q().trim().toLowerCase() + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("hostname")), like), cb.like(cb.lower(root.get("machineId")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("agentVersion"), "")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return toResponses(deviceRepository.findAll(spec, pageable));
    }

    @Transactional(readOnly = true)
    public DeviceSummary summary() {
        UUID org = TenantContext.require();
        Instant connectedCutoff = Instant.now().minus(properties.agent().offlineAfter());
        long approved = deviceRepository.countByOrganizationIdAndStatus(org, DeviceStatus.APPROVED);
        long connected = deviceRepository.countByOrganizationIdAndStatusAndLastSeenAtAfter(org, DeviceStatus.APPROVED, connectedCutoff);
        return new DeviceSummary(deviceRepository.countByOrganizationId(org), approved,
                deviceRepository.countByOrganizationIdAndStatus(org, DeviceStatus.PENDING),
                deviceRepository.countByOrganizationIdAndStatus(org, DeviceStatus.REVOKED),
                connected, approved - connected,
                deviceRepository.countByOrganizationIdAndStatusAndHealth(org, DeviceStatus.APPROVED, DeviceHealth.HEALTHY),
                deviceRepository.countByOrganizationIdAndStatusAndHealth(org, DeviceStatus.APPROVED, DeviceHealth.DEGRADED),
                deviceRepository.countByOrganizationIdAndStatusAndHealth(org, DeviceStatus.APPROVED, DeviceHealth.OFFLINE));
    }

    @Transactional(readOnly = true)
    public DeviceResponse get(UUID id) {
        Device device = load(id);
        if (device.getEmployeeId() != null) {
            accessScopeService.assertCanView(SecurityUtils.requireUser(), device.getEmployeeId());
        }
        return toResponse(device);
    }

    @Transactional
    public DeviceResponse update(UUID id, UpdateDeviceRequest request) {
        Device device = load(id);
        Map<String, Object> before = Map.of("hostname", device.getHostname());
        if (request.hostname() != null && !request.hostname().isBlank()) {
            device.setHostname(request.hostname().trim());
        }
        if (request.metadata() != null) {
            device.setMetadata(request.metadata());
        }
        auditService.record("DEVICE_UPDATED", "DEVICE", device.getId(), before, Map.of("hostname", device.getHostname()));
        return toResponse(device);
    }

    @Transactional
    public DeviceResponse approve(UUID id) {
        Device device = load(id);
        if (device.getStatus() == DeviceStatus.REVOKED) {
            throw ApiException.conflict("A revoked device cannot be approved; register it again");
        }
        DeviceStatus before = device.getStatus();
        device.setStatus(DeviceStatus.APPROVED);
        device.setApprovedAt(Instant.now());
        device.setApprovedBy(SecurityUtils.currentUserIdOrNull());
        auditService.record("DEVICE_APPROVED", "DEVICE", device.getId(), Map.of("status", before.name()), Map.of("status", "APPROVED"));
        return toResponse(device);
    }

    @Transactional
    public DeviceResponse revoke(UUID id) {
        Device device = load(id);
        DeviceStatus before = device.getStatus();
        device.setStatus(DeviceStatus.REVOKED);
        device.setRevokedAt(Instant.now());
        device.setRevokedBy(SecurityUtils.currentUserIdOrNull());
        device.setHealth(DeviceHealth.OFFLINE);
        deviceTokenRepository.revokeAllForDevice(device.getId(), Instant.now());
        auditService.record("DEVICE_REVOKED", "DEVICE", device.getId(), Map.of("status", before.name()), Map.of("status", "REVOKED"));
        return toResponse(device);
    }

    @Transactional
    public DeviceResponse assignEmployee(UUID id, UUID employeeId) {
        Device device = load(id);
        employeeRepository.findByIdAndOrganizationId(employeeId, device.getOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Employee", employeeId));
        UUID before = device.getEmployeeId();
        device.setEmployeeId(employeeId);
        auditService.record("DEVICE_EMPLOYEE_ASSIGNED", "DEVICE", device.getId(),
                Map.of("employeeId", before == null ? "" : before.toString()), Map.of("employeeId", employeeId.toString()));
        return toResponse(device);
    }

    /** Issues a fresh opaque device token, revoking any previous ones. Returns the raw token (only time it is visible). */
    @Transactional
    public String issueToken(Device device) {
        deviceTokenRepository.revokeAllForDevice(device.getId(), Instant.now());
        String raw = HashUtil.randomToken(48);
        DeviceToken token = new DeviceToken();
        token.setDevice(device);
        token.setTokenHash(HashUtil.sha256Hex(raw));
        deviceTokenRepository.save(token);
        return raw;
    }

    private Device load(UUID id) {
        return deviceRepository.findByIdAndOrganizationId(id, TenantContext.require())
                .orElseThrow(() -> ApiException.notFound("Device", id));
    }

    public DeviceResponse toResponse(Device device) {
        return toResponses(new org.springframework.data.domain.PageImpl<>(List.of(device))).getContent().get(0);
    }

    public Page<DeviceResponse> toResponses(Page<Device> page) {
        List<Device> devices = page.getContent();
        if (devices.isEmpty()) {
            return page.map(d -> null);
        }
        UUID organizationId = devices.get(0).getOrganizationId();
        Set<UUID> employeeIds = devices.stream().map(Device::getEmployeeId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Employee> employees = employeeIds.isEmpty() ? Map.of()
                : employeeRepository.findByOrganizationIdAndIdIn(organizationId, employeeIds).stream()
                .collect(Collectors.toMap(Employee::getId, Function.identity()));
        Map<UUID, Department> departments = departmentRepository.findByOrganizationIdOrderByNameAsc(organizationId).stream()
                .collect(Collectors.toMap(Department::getId, Function.identity()));
        return page.map(d -> {
            Employee e = d.getEmployeeId() == null ? null : employees.get(d.getEmployeeId());
            Department dept = e == null || e.getDepartmentId() == null ? null : departments.get(e.getDepartmentId());
            return new DeviceResponse(d.getId(), d.getHostname(), d.getMachineId(), d.getOsName(), d.getOsVersion(), d.getAgentVersion(),
                    d.getStatus(), d.getHealth(), d.getEmployeeId(), e == null ? null : e.getFullName(), dept == null ? null : dept.getName(),
                    d.getLastSeenAt(), d.getLastSyncAt(), d.getRegisteredAt(), d.getApprovedAt(), d.getRevokedAt(), d.getMetadata());
        });
    }
}
