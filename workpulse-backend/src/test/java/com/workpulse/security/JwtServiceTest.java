package com.workpulse.security;

import com.workpulse.config.WorkPulseProperties;
import com.workpulse.exception.ApiException;
import com.workpulse.exception.ErrorCode;
import com.workpulse.security.jwt.JwtService;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private final WorkPulseProperties properties = new WorkPulseProperties(
            new WorkPulseProperties.Jwt("0123456789abcdef0123456789abcdef0123456789", "workpulse-test",
                    Duration.ofMinutes(15), Duration.ofDays(7), Duration.ofHours(2)),
            new WorkPulseProperties.Cors(List.of("http://localhost:5173")),
            new WorkPulseProperties.Demo(false, "demo", 14, 48),
            new WorkPulseProperties.Bootstrap("a@b.c", "password", "Org"),
            new WorkPulseProperties.Agent(true, 500, Duration.ofMinutes(2)),
            new WorkPulseProperties.RateLimit(false, 10, 5, 120));

    private final JwtService jwtService = new JwtService(properties);

    @Test
    void roundTripsEveryClaim() {
        UUID dept = UUID.randomUUID();
        UserPrincipal principal = UserPrincipal.builder()
                .userId(UUID.randomUUID()).organizationId(UUID.randomUUID()).email("lead@example.com").displayName("Lead")
                .employeeId(UUID.randomUUID()).roles(Set.of("TEAM_LEAD")).permissions(Set.of("EMPLOYEE_VIEW", "DASHBOARD_VIEW"))
                .scope(new AccessScope(ScopeLevel.DEPARTMENT, Set.of(dept), Set.of(), null))
                .guestType(null).build();

        UserPrincipal parsed = jwtService.parse(jwtService.createAccessToken(principal));

        assertThat(parsed.getUserId()).isEqualTo(principal.getUserId());
        assertThat(parsed.getOrganizationId()).isEqualTo(principal.getOrganizationId());
        assertThat(parsed.getEmail()).isEqualTo("lead@example.com");
        assertThat(parsed.getEmployeeId()).isEqualTo(principal.getEmployeeId());
        assertThat(parsed.getRoles()).containsExactly("TEAM_LEAD");
        assertThat(parsed.getPermissions()).containsExactlyInAnyOrder("EMPLOYEE_VIEW", "DASHBOARD_VIEW");
        assertThat(parsed.getScope().level()).isEqualTo(ScopeLevel.DEPARTMENT);
        assertThat(parsed.getScope().departmentIds()).containsExactly(dept);
        assertThat(parsed.isGuest()).isFalse();
        assertThat(parsed.authorities()).extracting("authority").contains("EMPLOYEE_VIEW", "ROLE_TEAM_LEAD");
    }

    @Test
    void guestClaimsSurvive() {
        UserPrincipal guest = UserPrincipal.builder()
                .userId(UUID.randomUUID()).organizationId(UUID.randomUUID()).email("g@demo").displayName("Guest")
                .roles(Set.of("GUEST_DEMO")).permissions(Set.of("DASHBOARD_VIEW")).scope(AccessScope.organization())
                .guestType("DEMO").guestSessionId(UUID.randomUUID()).guestPersona("EXECUTIVE").build();
        UserPrincipal parsed = jwtService.parse(jwtService.createAccessToken(guest, Duration.ofMinutes(5)));
        assertThat(parsed.isDemoGuest()).isTrue();
        assertThat(parsed.getGuestSessionId()).isEqualTo(guest.getGuestSessionId());
        assertThat(parsed.getGuestPersona()).isEqualTo("EXECUTIVE");
    }

    @Test
    void expiredAndTamperedTokensAreRejectedWithDistinctCodes() {
        UserPrincipal principal = UserPrincipal.builder().userId(UUID.randomUUID()).email("x@y.z").displayName("x")
                .roles(Set.of()).permissions(Set.of()).scope(AccessScope.organization()).build();
        String expired = jwtService.createAccessToken(principal, Duration.ofSeconds(-5));
        assertThatThrownBy(() -> jwtService.parse(expired)).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo(ErrorCode.TOKEN_EXPIRED);

        String valid = jwtService.createAccessToken(principal);
        String tampered = valid.substring(0, valid.length() - 4) + "abcd";
        assertThatThrownBy(() -> jwtService.parse(tampered)).isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo(ErrorCode.UNAUTHORIZED);
    }
}
