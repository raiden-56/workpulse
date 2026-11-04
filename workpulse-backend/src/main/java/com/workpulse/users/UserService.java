package com.workpulse.users;

import com.workpulse.audit.AuditService;
import com.workpulse.auth.PasswordResetToken;
import com.workpulse.auth.PasswordResetTokenRepository;
import com.workpulse.common.util.HashUtil;
import com.workpulse.exception.ApiException;
import com.workpulse.security.ScopeLevel;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import com.workpulse.users.dto.UserDtos.ActivateUserRequest;
import com.workpulse.users.dto.UserDtos.InviteUserRequest;
import com.workpulse.users.dto.UserDtos.InviteUserResponse;
import com.workpulse.users.dto.UserDtos.RoleGrant;
import com.workpulse.users.dto.UserDtos.RoleGrantResponse;
import com.workpulse.users.dto.UserDtos.UpdateUserRequest;
import com.workpulse.users.dto.UserDtos.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final Set<String> GUEST_ROLES = Set.of(UserPrincipal.ROLE_GUEST_DEMO, UserPrincipal.ROLE_GUEST_AUTHORIZED);

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Page<UserResponse> list(Pageable pageable) {
        UUID organizationId = TenantContext.require();
        return userRepository.findByOrganizationId(organizationId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse get(UUID id) {
        return toResponse(load(id));
    }

    @Transactional
    public InviteUserResponse invite(InviteUserRequest request) {
        UUID organizationId = TenantContext.require();
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("A user with this email already exists");
        }
        User user = new User();
        user.setOrganizationId(organizationId);
        user.setEmail(email);
        user.setDisplayName(request.displayName().trim());
        user.setEmployeeId(request.employeeId());
        user.setStatus(UserStatus.INVITED);
        user = userRepository.save(user);
        applyRoles(user, request.roles());

        String rawToken = HashUtil.randomToken(32);
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setTokenHash(HashUtil.sha256Hex(rawToken));
        token.setExpiresAt(Instant.now().plus(Duration.ofDays(7)));
        resetTokenRepository.save(token);

        auditService.record("USER_INVITED", "USER", user.getId(), null,
                Map.of("email", email, "roles", request.roles().stream().map(RoleGrant::roleCode).toList()));
        // The activation token is returned to the inviting administrator until the email channel is wired (Phase 10).
        return new InviteUserResponse(toResponse(user), rawToken);
    }

    @Transactional
    public UserResponse activate(ActivateUserRequest request) {
        PasswordResetToken token = resetTokenRepository.findByTokenHash(HashUtil.sha256Hex(request.token()))
                .filter(PasswordResetToken::isUsable)
                .orElseThrow(() -> ApiException.badRequest("Activation link is invalid or has expired"));
        User user = userRepository.findById(token.getUserId()).orElseThrow(() -> ApiException.notFound("User", token.getUserId()));
        if (user.getStatus() == UserStatus.REVOKED) {
            throw ApiException.forbidden("This account has been revoked");
        }
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setPasswordChangedAt(Instant.now());
        user.setStatus(UserStatus.ACTIVE);
        token.setUsedAt(Instant.now());
        auditService.recordSystem(user.getOrganizationId(), "USER_ACTIVATED", "USER", user.getId(), Map.of("email", user.getEmail()));
        return toResponse(user);
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request) {
        User user = load(id);
        Map<String, Object> before = Map.of("displayName", user.getDisplayName());
        user.setDisplayName(request.displayName().trim());
        user.setEmployeeId(request.employeeId());
        auditService.record("USER_UPDATED", "USER", user.getId(), before, Map.of("displayName", user.getDisplayName()));
        return toResponse(user);
    }

    @Transactional
    public UserResponse changeStatus(UUID id, UserStatus status) {
        User user = load(id);
        if (user.getId().equals(SecurityUtils.requireUser().getUserId())) {
            throw ApiException.badRequest("You cannot change the status of your own account");
        }
        UserStatus before = user.getStatus();
        user.setStatus(status);
        auditService.record("USER_STATUS_" + status.name(), "USER", user.getId(),
                Map.of("status", before.name()), Map.of("status", status.name()));
        return toResponse(user);
    }

    @Transactional
    public UserResponse assignRoles(UUID id, List<RoleGrant> grants) {
        User user = load(id);
        List<String> before = userRoleRepository.findByUserId(user.getId()).stream().map(r -> r.getRole().getCode()).toList();
        userRoleRepository.deleteByUserId(user.getId());
        userRoleRepository.flush();
        applyRoles(user, grants);
        auditService.record("USER_ROLES_CHANGED", "USER", user.getId(), Map.of("roles", before),
                Map.of("roles", grants.stream().map(RoleGrant::roleCode).toList()));
        return toResponse(user);
    }

    private void applyRoles(User user, List<RoleGrant> grants) {
        UserPrincipal actor = SecurityUtils.currentUser().orElse(null);
        for (RoleGrant grant : grants) {
            String code = grant.roleCode().trim().toUpperCase();
            Role role = roleRepository.findByCode(code).orElseThrow(() -> ApiException.badRequest("Unknown role: " + code));
            if (GUEST_ROLES.contains(code)) {
                throw ApiException.badRequest("Guest roles are managed through guest accounts");
            }
            if (code.equals(UserPrincipal.ROLE_SUPER_ADMIN) && (actor == null || !actor.isSuperAdmin())) {
                throw ApiException.forbidden("Only a super admin can grant the super admin role");
            }
            if (role.getScopeLevel() == ScopeLevel.DEPARTMENT && grant.departmentId() == null) {
                throw ApiException.badRequest("Role " + code + " requires a departmentId");
            }
            if (role.getScopeLevel() == ScopeLevel.TEAM && grant.teamId() == null) {
                throw ApiException.badRequest("Role " + code + " requires a teamId");
            }
            UserRole userRole = new UserRole();
            userRole.setUserId(user.getId());
            userRole.setRole(role);
            userRole.setDepartmentId(role.getScopeLevel() == ScopeLevel.DEPARTMENT ? grant.departmentId() : null);
            userRole.setTeamId(role.getScopeLevel() == ScopeLevel.TEAM ? grant.teamId() : null);
            userRole.setGrantedBy(actor == null ? null : actor.getUserId());
            userRoleRepository.save(userRole);
        }
    }

    private User load(UUID id) {
        UserPrincipal actor = SecurityUtils.requireUser();
        if (actor.isSuperAdmin() && TenantContext.getOrNull() == null) {
            return userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User", id));
        }
        return userRepository.findByIdAndOrganizationId(id, TenantContext.require())
                .orElseThrow(() -> ApiException.notFound("User", id));
    }

    public UserResponse toResponse(User user) {
        List<RoleGrantResponse> roles = userRoleRepository.findByUserId(user.getId()).stream()
                .map(r -> new RoleGrantResponse(r.getRole().getCode(), r.getRole().getName(), r.getRole().getScopeLevel(),
                        r.getDepartmentId(), r.getTeamId()))
                .toList();
        return new UserResponse(user.getId(), user.getOrganizationId(), user.getEmail(), user.getDisplayName(),
                user.getStatus().name(), user.isMfaEnabled(), user.getEmployeeId(), user.getLastLoginAt(),
                user.getCreatedAt(), roles);
    }
}
