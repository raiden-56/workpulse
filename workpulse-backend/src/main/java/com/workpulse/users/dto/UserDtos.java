package com.workpulse.users.dto;

import com.workpulse.security.ScopeLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record RoleGrant(@NotBlank String roleCode, UUID departmentId, UUID teamId) {}

    public record RoleGrantResponse(String roleCode, String roleName, ScopeLevel scopeLevel, UUID departmentId, UUID teamId) {}

    public record UserResponse(UUID id, UUID organizationId, String email, String displayName, String status,
                               boolean mfaEnabled, UUID employeeId, Instant lastLoginAt, Instant createdAt,
                               List<RoleGrantResponse> roles) {}

    public record InviteUserRequest(@NotBlank @Email String email,
                                    @NotBlank @Size(max = 160) String displayName,
                                    UUID employeeId,
                                    @NotEmpty List<@Valid RoleGrant> roles) {}

    public record InviteUserResponse(UserResponse user, String activationToken) {}

    public record ActivateUserRequest(@NotBlank String token, @NotBlank @Size(min = 10, max = 128) String password) {}

    public record UpdateUserRequest(@NotBlank @Size(max = 160) String displayName, UUID employeeId) {}

    public record AssignRolesRequest(@NotEmpty List<@Valid RoleGrant> roles) {}

    public record RoleResponse(UUID id, String code, String name, String description, ScopeLevel scopeLevel, List<String> permissions) {}

    public record PermissionResponse(UUID id, String code, String resource, String action, String description) {}
}
