package com.workpulse.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record LogoutRequest(String refreshToken) {}

    public record ForgotPasswordRequest(@NotBlank @Email String email) {}

    public record ResetPasswordRequest(@NotBlank String token, @NotBlank @Size(min = 10, max = 128) String password) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 10, max = 128) String newPassword) {}

    public record ScopeResponse(String level, Set<UUID> departmentIds, Set<UUID> teamIds, UUID employeeId) {}

    public record MeResponse(UUID userId, String email, String displayName, UUID organizationId, String organizationName,
                             String organizationTimezone, boolean demoOrganization, UUID employeeId,
                             Set<String> roles, Set<String> permissions, ScopeResponse scope,
                             String guestType, String guestPersona, Instant guestExpiresAt) {}

    public record AuthTokensResponse(String accessToken, String refreshToken, String tokenType, long expiresIn, MeResponse user) {}

    public record LoginHistoryResponse(UUID id, String outcome, String ipAddress, String userAgent, Instant occurredAt) {}

    public record MessageResponse(String message) {}

    public record ForgotPasswordResponse(String message, String developmentResetToken) {}

    public record RefreshTokenList(List<String> tokens) {}
}
