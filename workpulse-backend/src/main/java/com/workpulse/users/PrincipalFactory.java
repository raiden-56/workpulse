package com.workpulse.users;

import com.workpulse.security.AccessScope;
import com.workpulse.security.ScopeLevel;
import com.workpulse.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Builds the JWT principal (roles, permissions, effective scope) for a user. */
@Component
@RequiredArgsConstructor
public class PrincipalFactory {

    private final UserRoleRepository userRoleRepository;

    @Transactional(readOnly = true)
    public UserPrincipal build(User user) {
        List<UserRole> grants = userRoleRepository.findByUserId(user.getId());
        Set<String> roles = new HashSet<>();
        Set<String> permissions = new HashSet<>();
        Set<UUID> departmentIds = new HashSet<>();
        Set<UUID> teamIds = new HashSet<>();
        ScopeLevel widest = ScopeLevel.SELF;
        for (UserRole grant : grants) {
            Role role = grant.getRole();
            roles.add(role.getCode());
            role.getPermissions().forEach(p -> permissions.add(p.getCode()));
            ScopeLevel level = role.getScopeLevel();
            if (level == ScopeLevel.DEPARTMENT && grant.getDepartmentId() != null) {
                departmentIds.add(grant.getDepartmentId());
            }
            if (level == ScopeLevel.TEAM && grant.getTeamId() != null) {
                teamIds.add(grant.getTeamId());
            }
            if (level.ordinal() < widest.ordinal()) {
                widest = level;
            }
        }
        if (user.getOrganizationId() == null && roles.contains(UserPrincipal.ROLE_SUPER_ADMIN)) {
            widest = ScopeLevel.GLOBAL;
        } else if (widest == ScopeLevel.GLOBAL) {
            widest = ScopeLevel.ORGANIZATION;
        }
        AccessScope scope = new AccessScope(widest, Set.copyOf(departmentIds), Set.copyOf(teamIds), user.getEmployeeId());
        return UserPrincipal.builder()
                .userId(user.getId())
                .organizationId(user.getOrganizationId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .employeeId(user.getEmployeeId())
                .roles(roles)
                .permissions(permissions)
                .scope(scope)
                .build();
    }
}
