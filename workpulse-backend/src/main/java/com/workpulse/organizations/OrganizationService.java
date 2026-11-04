package com.workpulse.organizations;

import com.workpulse.audit.AuditService;
import com.workpulse.auth.PasswordResetToken;
import com.workpulse.auth.PasswordResetTokenRepository;
import com.workpulse.common.util.HashUtil;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.organizations.dto.OrganizationDtos.CreateOrganizationRequest;
import com.workpulse.organizations.dto.OrganizationDtos.CreateOrganizationResponse;
import com.workpulse.organizations.dto.OrganizationDtos.OrganizationResponse;
import com.workpulse.organizations.dto.OrganizationDtos.OrganizationSummary;
import com.workpulse.organizations.dto.OrganizationDtos.UpdateOrganizationRequest;
import com.workpulse.policies.MonitoringPolicy;
import com.workpulse.policies.MonitoringPolicyRepository;
import com.workpulse.policies.PolicyLevel;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import com.workpulse.shifts.Shift;
import com.workpulse.shifts.ShiftRepository;
import com.workpulse.users.Role;
import com.workpulse.users.RoleRepository;
import com.workpulse.users.User;
import com.workpulse.users.UserRepository;
import com.workpulse.users.UserRole;
import com.workpulse.users.UserRoleRepository;
import com.workpulse.users.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final MonitoringPolicyRepository policyRepository;
    private final ShiftRepository shiftRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<OrganizationSummary> list() {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (principal.isSuperAdmin()) {
            return organizationRepository.findAll().stream().map(this::toSummary).toList();
        }
        return organizationRepository.findById(principal.getOrganizationId()).map(o -> List.of(toSummary(o))).orElse(List.of());
    }

    @Transactional(readOnly = true)
    public OrganizationResponse get(UUID id) {
        return toResponse(load(id));
    }

    @Transactional(readOnly = true)
    public OrganizationResponse current() {
        return toResponse(load(TenantContext.require()));
    }

    @Transactional
    public CreateOrganizationResponse create(CreateOrganizationRequest request) {
        if (organizationRepository.existsBySlug(request.slug())) {
            throw ApiException.conflict("An organisation with this slug already exists");
        }
        String adminEmail = request.adminEmail().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(adminEmail)) {
            throw ApiException.conflict("A user with the admin email already exists");
        }
        Organization org = new Organization();
        org.setName(request.name().trim());
        org.setSlug(request.slug());
        org.setCode(request.code());
        org.setTimezone(request.timezone() == null || request.timezone().isBlank() ? "UTC" : request.timezone());
        org = organizationRepository.save(org);
        createDefaults(org);

        User admin = new User();
        admin.setOrganizationId(org.getId());
        admin.setEmail(adminEmail);
        admin.setDisplayName(request.adminDisplayName().trim());
        admin.setStatus(UserStatus.INVITED);
        admin = userRepository.save(admin);
        Role orgAdmin = roleRepository.findByCode("ORG_ADMIN").orElseThrow();
        UserRole grant = new UserRole();
        grant.setUserId(admin.getId());
        grant.setRole(orgAdmin);
        grant.setGrantedBy(SecurityUtils.currentUserIdOrNull());
        userRoleRepository.save(grant);

        String raw = HashUtil.randomToken(32);
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(admin.getId());
        token.setTokenHash(HashUtil.sha256Hex(raw));
        token.setExpiresAt(Instant.now().plus(Duration.ofDays(7)));
        resetTokenRepository.save(token);

        auditService.record("ORGANIZATION_CREATED", "ORGANIZATION", org.getId(), null,
                Map.of("name", org.getName(), "slug", org.getSlug(), "adminEmail", adminEmail));
        return new CreateOrganizationResponse(toResponse(org), raw);
    }

    @Transactional
    public OrganizationResponse update(UUID id, UpdateOrganizationRequest request) {
        Organization org = load(id);
        Map<String, Object> before = Map.of("name", org.getName(), "timezone", org.getTimezone(), "status", org.getStatus().name());
        org.setName(request.name().trim());
        org.setCode(request.code());
        if (request.timezone() != null && !request.timezone().isBlank()) {
            org.setTimezone(request.timezone());
        }
        if (request.status() != null && SecurityUtils.requireUser().isSuperAdmin()) {
            org.setStatus(OrganizationStatus.valueOf(request.status().toUpperCase()));
        }
        auditService.record("ORGANIZATION_UPDATED", "ORGANIZATION", org.getId(), before,
                Map.of("name", org.getName(), "timezone", org.getTimezone(), "status", org.getStatus().name()));
        return toResponse(org);
    }

    @Transactional
    public OrganizationResponse updateSettings(Map<String, Object> settings) {
        Organization org = load(TenantContext.require());
        Map<String, Object> before = Map.copyOf(org.getSettings());
        org.setSettings(settings == null ? Map.of() : settings);
        auditService.record("ORGANIZATION_SETTINGS_UPDATED", "ORGANIZATION", org.getId(), before, org.getSettings());
        return toResponse(org);
    }

    /** Creates the default monitoring policy and shift for a new organisation. */
    @Transactional
    public void createDefaults(Organization org) {
        if (policyRepository.findFirstByOrganizationIdAndDefaultPolicyTrue(org.getId()).isEmpty()) {
            MonitoringPolicy policy = new MonitoringPolicy();
            policy.setOrganizationId(org.getId());
            policy.setName("Default monitoring policy");
            policy.setLevel(PolicyLevel.ORGANIZATION);
            policy.setDefaultPolicy(true);
            policy.setWorkingHours(Map.of("from", "09:00", "to", "18:00", "days", List.of(1, 2, 3, 4, 5)));
            policy.setCollectionWindows(List.of(Map.of("days", List.of(1, 2, 3, 4, 5), "from", "07:00", "to", "21:00", "tz", org.getTimezone())));
            policy.setIdleThresholdSeconds(300);
            policy.setSamplingIntervalSeconds(10);
            policy.setCollectWindowTitles(false);
            policy.setCollectInputSummary(true);
            policy.setSensitiveAppExclusions(List.of("keepass.exe", "1password.exe", "bitwarden.exe"));
            policy.setDataCategories(List.of("FOREGROUND_APPLICATION", "IDLE_TIME", "SESSION_STATE", "INPUT_SUMMARY", "DEVICE_HEALTH"));
            policy.setRetentionDays(180);
            policy.setEmployeeNotice("WorkPulse records which applications are in the foreground, idle periods and session "
                    + "lock/unlock events on company devices during the configured collection window. It never records "
                    + "keystrokes, screenshots, clipboard content or private messages.");
            policy.setMinAgentVersion("1.0.0");
            policyRepository.save(policy);
        }
        if (shiftRepository.findFirstByOrganizationIdAndDefaultShiftTrue(org.getId()).isEmpty()) {
            Shift shift = new Shift();
            shift.setOrganizationId(org.getId());
            shift.setName("General shift");
            shift.setStartTime(LocalTime.of(9, 0));
            shift.setEndTime(LocalTime.of(18, 0));
            shift.setTimezone(org.getTimezone());
            shift.setDefaultShift(true);
            shiftRepository.save(shift);
        }
    }

    private Organization load(UUID id) {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (!principal.isSuperAdmin() && !id.equals(principal.getOrganizationId())) {
            throw ApiException.notFound("Organization", id);
        }
        return organizationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Organization", id));
    }

    private OrganizationSummary toSummary(Organization o) {
        return new OrganizationSummary(o.getId(), o.getName(), o.getSlug(), o.getTimezone(), o.isDemo(), o.getStatus().name());
    }

    private OrganizationResponse toResponse(Organization o) {
        return new OrganizationResponse(o.getId(), o.getName(), o.getSlug(), o.getCode(), o.getTimezone(), o.getStatus().name(),
                o.isDemo(), o.getSettings(), o.getCreatedAt(),
                employeeRepository.countByOrganizationId(o.getId()),
                departmentRepository.countByOrganizationId(o.getId()),
                deviceRepository.countByOrganizationId(o.getId()));
    }
}
