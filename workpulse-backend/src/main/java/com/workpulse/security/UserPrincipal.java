package com.workpulse.security;

import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Authenticated portal user or guest, reconstructed from the JWT on every request.
 */
@Getter
@Builder(toBuilder = true)
public class UserPrincipal {

    public static final String ROLE_SUPER_ADMIN = "SUPER_ADMIN";
    public static final String ROLE_GUEST_DEMO = "GUEST_DEMO";
    public static final String ROLE_GUEST_AUTHORIZED = "GUEST_AUTHORIZED";

    private final UUID userId;
    private final UUID organizationId;
    private final String email;
    private final String displayName;
    private final UUID employeeId;
    private final Set<String> roles;
    private final Set<String> permissions;
    private final AccessScope scope;
    /** {@code null} for regular users, {@code DEMO} or {@code AUTHORIZED} for guests. */
    private final String guestType;
    private final UUID guestSessionId;
    /** Which role's experience a demo guest chose to explore (layout hint only, never a permission). */
    private final String guestPersona;

    public boolean isSuperAdmin() {
        return roles.contains(ROLE_SUPER_ADMIN);
    }

    public boolean isGuest() {
        return guestType != null;
    }

    public boolean isDemoGuest() {
        return "DEMO".equals(guestType);
    }

    public boolean hasPermission(String permission) {
        return permissions.contains(permission);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }

    public List<GrantedAuthority> authorities() {
        List<GrantedAuthority> list = new ArrayList<>(permissions.size() + roles.size());
        permissions.forEach(p -> list.add(new SimpleGrantedAuthority(p)));
        roles.forEach(r -> list.add(new SimpleGrantedAuthority("ROLE_" + r)));
        return list;
    }
}
