package com.workpulse.security.jwt;

import com.workpulse.config.WorkPulseProperties;
import com.workpulse.exception.ApiException;
import com.workpulse.exception.ErrorCode;
import com.workpulse.security.AccessScope;
import com.workpulse.security.ScopeLevel;
import com.workpulse.security.UserPrincipal;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Issues and verifies HS256 access tokens. Refresh tokens are opaque and handled by the auth module.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final String issuer;
    private final Duration accessTtl;

    public JwtService(WorkPulseProperties properties) {
        this.key = Keys.hmacShaKeyFor(properties.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.issuer = properties.jwt().issuer();
        this.accessTtl = properties.jwt().accessTokenTtl();
    }

    public Duration accessTtl() {
        return accessTtl;
    }

    public String createAccessToken(UserPrincipal principal) {
        return createAccessToken(principal, accessTtl);
    }

    public String createAccessToken(UserPrincipal principal, Duration ttl) {
        Instant now = Instant.now();
        Map<String, Object> claims = new HashMap<>();
        if (principal.getOrganizationId() != null) {
            claims.put("org", principal.getOrganizationId().toString());
        }
        claims.put("email", principal.getEmail());
        claims.put("name", principal.getDisplayName());
        if (principal.getEmployeeId() != null) {
            claims.put("emp", principal.getEmployeeId().toString());
        }
        claims.put("roles", List.copyOf(principal.getRoles()));
        claims.put("perms", List.copyOf(principal.getPermissions()));
        AccessScope scope = principal.getScope() == null ? AccessScope.organization() : principal.getScope();
        Map<String, Object> scopeClaim = new HashMap<>();
        scopeClaim.put("level", scope.level().name());
        scopeClaim.put("departments", scope.departmentIds().stream().map(UUID::toString).toList());
        scopeClaim.put("teams", scope.teamIds().stream().map(UUID::toString).toList());
        if (scope.employeeId() != null) {
            scopeClaim.put("employee", scope.employeeId().toString());
        }
        claims.put("scope", scopeClaim);
        if (principal.getGuestType() != null) {
            claims.put("gt", principal.getGuestType());
        }
        if (principal.getGuestSessionId() != null) {
            claims.put("gs", principal.getGuestSessionId().toString());
        }
        if (principal.getGuestPersona() != null) {
            claims.put("gp", principal.getGuestPersona());
        }
        return Jwts.builder()
                .subject(principal.getUserId().toString())
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .claims(claims)
                .signWith(key)
                .compact();
    }

    @SuppressWarnings("unchecked")
    public UserPrincipal parse(String token) {
        Claims claims;
        try {
            claims = Jwts.parser().verifyWith(key).requireIssuer(issuer).build()
                    .parseSignedClaims(token).getPayload();
        } catch (ExpiredJwtException ex) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED, "Access token has expired");
        } catch (JwtException | IllegalArgumentException ex) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid access token");
        }
        Map<String, Object> scopeClaim = claims.get("scope", Map.class);
        AccessScope scope = scopeClaim == null ? AccessScope.organization() : new AccessScope(
                ScopeLevel.valueOf((String) scopeClaim.getOrDefault("level", "ORGANIZATION")),
                toUuidSet((Collection<String>) scopeClaim.get("departments")),
                toUuidSet((Collection<String>) scopeClaim.get("teams")),
                scopeClaim.get("employee") == null ? null : UUID.fromString((String) scopeClaim.get("employee")));
        return UserPrincipal.builder()
                .userId(UUID.fromString(claims.getSubject()))
                .organizationId(claims.get("org") == null ? null : UUID.fromString(claims.get("org", String.class)))
                .email(claims.get("email", String.class))
                .displayName(claims.get("name", String.class))
                .employeeId(claims.get("emp") == null ? null : UUID.fromString(claims.get("emp", String.class)))
                .roles(toStringSet((Collection<String>) claims.get("roles")))
                .permissions(toStringSet((Collection<String>) claims.get("perms")))
                .scope(scope)
                .guestType(claims.get("gt", String.class))
                .guestSessionId(claims.get("gs") == null ? null : UUID.fromString(claims.get("gs", String.class)))
                .guestPersona(claims.get("gp", String.class))
                .build();
    }

    private static Set<UUID> toUuidSet(Collection<String> values) {
        if (values == null) {
            return Set.of();
        }
        return values.stream().map(UUID::fromString).collect(Collectors.toUnmodifiableSet());
    }

    private static Set<String> toStringSet(Collection<String> values) {
        return values == null ? Set.of() : new HashSet<>(values);
    }
}
