package com.workpulse.guest;

import com.workpulse.audit.AuditService;
import com.workpulse.auth.AuthService;
import com.workpulse.auth.dto.AuthDtos.AuthTokensResponse;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.guest.dto.GuestDtos.DemoCredential;
import com.workpulse.guest.dto.GuestDtos.GuestConfigResponse;
import com.workpulse.guest.dto.GuestDtos.Persona;
import com.workpulse.guest.dto.GuestDtos.ResetResponse;
import com.workpulse.organizations.Organization;
import com.workpulse.organizations.OrganizationRepository;
import com.workpulse.security.AccessScope;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.UserPrincipal;
import com.workpulse.users.Permission;
import com.workpulse.users.Role;
import com.workpulse.users.RoleRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuestService {

    public static final List<Persona> PERSONAS = List.of(
            new Persona("EXECUTIVE", "Executive / Org Admin", "Organisation-wide dashboards, employees, devices, policies and audit", "ORG_ADMIN"),
            new Persona("DEPARTMENT_MANAGER", "Department Manager", "Department dashboard, team activity and reviews", "DEPT_MANAGER"),
            new Persona("TEAM_LEAD", "Team Lead", "Team dashboard, member activity and attendance", "TEAM_LEAD"),
            new Persona("HR_ADMIN", "HR Administrator", "Employee directory, attendance and shifts", "HR_ADMIN"),
            new Persona("IT_ADMIN", "IT Administrator", "Device inventory, agent health and configuration", "IT_ADMIN"),
            new Persona("EMPLOYEE", "Employee", "Personal dashboard, timeline and privacy information", "EMPLOYEE"),
            new Persona("AUDITOR", "Auditor", "Read-only audit trail and access history", "AUDITOR"));

    static final String NOTICE = "Guest Mode shows a simulated organisation with generated employees, devices and activity. "
            + "No real person is monitored and nothing you see here is production data.";

    private static final AtomicReference<Instant> LAST_RESET = new AtomicReference<>(Instant.EPOCH);
    private static final Duration RESET_COOLDOWN = Duration.ofMinutes(10);

    private final WorkPulseProperties properties;
    private final OrganizationRepository organizationRepository;
    private final RoleRepository roleRepository;
    private final EmployeeRepository employeeRepository;
    private final GuestSessionRepository guestSessionRepository;
    private final AuthService authService;
    private final AuditService auditService;
    private final DemoDataSeeder seeder;

    @Transactional(readOnly = true)
    public GuestConfigResponse config() {
        Optional<Organization> demo = organizationRepository.findFirstByDemoTrue();
        boolean enabled = properties.demo().enabled() && demo.isPresent();
        List<DemoCredential> logins = enabled ? DemoDataSeeder.DEMO_USERS.stream()
                .map(u -> new DemoCredential(u.roleCode(), u.label(), u.email(), DemoDataSeeder.DEMO_PASSWORD)).toList() : List.of();
        return new GuestConfigResponse(enabled, demo.map(Organization::getName).orElse(null), PERSONAS,
                properties.jwt().guestTokenTtl().toMinutes(), NOTICE, logins);
    }

    @Transactional
    public AuthTokensResponse createDemoSession(String personaCode, HttpServletRequest http) {
        if (!properties.demo().enabled()) {
            throw ApiException.notFound("Guest Mode is not enabled on this deployment");
        }
        Organization demo = organizationRepository.findFirstByDemoTrue()
                .orElseThrow(() -> ApiException.notFound("Demo organisation is not available"));
        String wanted = personaCode == null || personaCode.isBlank() ? "EXECUTIVE" : personaCode;
        Persona persona = PERSONAS.stream().filter(p -> p.code().equalsIgnoreCase(wanted)).findFirst().orElse(PERSONAS.get(0));
        Role role = roleRepository.findByCode(UserPrincipal.ROLE_GUEST_DEMO).orElseThrow();
        Set<String> permissions = role.getPermissions().stream().map(Permission::getCode).collect(Collectors.toSet());

        GuestSession session = new GuestSession();
        session.setGuestType("DEMO");
        session.setOrganizationId(demo.getId());
        session.setPersona(persona.code());
        session.setExpiresAt(Instant.now().plus(properties.jwt().guestTokenTtl()));
        if (http != null) {
            session.setIpAddress(AuditService.clientIp(http));
            String ua = http.getHeader("User-Agent");
            session.setUserAgent(ua == null ? null : ua.substring(0, Math.min(ua.length(), 255)));
        }
        session = guestSessionRepository.save(session);

        UUID employeeId = demoEmployeeFor(demo.getId(), persona.code());
        UserPrincipal principal = UserPrincipal.builder()
                .userId(session.getId())
                .organizationId(demo.getId())
                .email("guest-" + session.getId().toString().substring(0, 8) + "@demo.workpulse")
                .displayName("Demo Guest · " + persona.label())
                .employeeId(employeeId)
                .roles(Set.of(UserPrincipal.ROLE_GUEST_DEMO))
                .permissions(permissions)
                .scope(AccessScope.organization())
                .guestType("DEMO")
                .guestSessionId(session.getId())
                .guestPersona(persona.code())
                .build();
        auditService.recordSystem(demo.getId(), "GUEST_SESSION_STARTED", "GUEST_SESSION", session.getId(), Map.of("persona", persona.code()));
        return authService.issueGuestTokens(principal, properties.jwt().guestTokenTtl(), persona.code(), session.getExpiresAt());
    }

    @Transactional
    public void endCurrentSession() {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (principal.getGuestSessionId() != null) {
            guestSessionRepository.findById(principal.getGuestSessionId()).ifPresent(s -> s.setEndedAt(Instant.now()));
        }
    }

    public ResetResponse resetDemo() {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (!principal.isDemoGuest() && !principal.isSuperAdmin()) {
            throw ApiException.forbidden("Only demo guests or super admins can reset the demo data");
        }
        Instant last = LAST_RESET.get();
        if (!principal.isSuperAdmin() && last.plus(RESET_COOLDOWN).isAfter(Instant.now())) {
            long minutes = Duration.between(Instant.now(), last.plus(RESET_COOLDOWN)).toMinutes() + 1;
            throw ApiException.conflict("Demo data was reset recently. Try again in about " + minutes + " minute(s).");
        }
        LAST_RESET.set(Instant.now());
        DemoDataSeeder.SeedResult result = seeder.reseed();
        return new ResetResponse("Demo data regenerated", result.employees(), result.events());
    }

    private UUID demoEmployeeFor(UUID orgId, String persona) {
        String code = switch (persona) {
            case "EMPLOYEE" -> DemoDataSeeder.PERSONA_EMPLOYEE_CODE;
            case "TEAM_LEAD" -> DemoDataSeeder.PERSONA_TEAM_LEAD_CODE;
            case "DEPARTMENT_MANAGER" -> DemoDataSeeder.PERSONA_MANAGER_CODE;
            default -> null;
        };
        if (code == null) {
            return null;
        }
        return employeeRepository.findByOrganizationId(orgId).stream()
                .filter(e -> code.equals(e.getEmployeeCode())).findFirst().map(Employee::getId).orElse(null);
    }
}
