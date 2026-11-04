package com.workpulse.auth;

import com.workpulse.auth.dto.AuthDtos.AuthTokensResponse;
import com.workpulse.auth.dto.AuthDtos.ChangePasswordRequest;
import com.workpulse.auth.dto.AuthDtos.ForgotPasswordRequest;
import com.workpulse.auth.dto.AuthDtos.ForgotPasswordResponse;
import com.workpulse.auth.dto.AuthDtos.LoginHistoryResponse;
import com.workpulse.auth.dto.AuthDtos.LoginRequest;
import com.workpulse.auth.dto.AuthDtos.LogoutRequest;
import com.workpulse.auth.dto.AuthDtos.MeResponse;
import com.workpulse.auth.dto.AuthDtos.MessageResponse;
import com.workpulse.auth.dto.AuthDtos.RefreshRequest;
import com.workpulse.auth.dto.AuthDtos.ResetPasswordRequest;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.exception.ApiException;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Authentication, session and password management")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "Sign in with email and password")
    public ApiResponse<AuthTokensResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return ApiResponse.ok(authService.login(request, http));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate the refresh token and obtain a new access token")
    public ApiResponse<AuthTokensResponse> refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest http) {
        return ApiResponse.ok(authService.refresh(request.refreshToken(), http));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the current session")
    public ApiResponse<MessageResponse> logout(@RequestBody(required = false) LogoutRequest request, HttpServletRequest http) {
        authService.logout(request == null ? null : request.refreshToken(), http);
        return ApiResponse.ok(new MessageResponse("Signed out"));
    }

    @GetMapping("/me")
    @Operation(summary = "Current principal, roles, permissions and scope")
    public ApiResponse<MeResponse> me() {
        return ApiResponse.ok(authService.me());
    }

    @PostMapping("/forgot-password")
    public ApiResponse<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest http) {
        return ApiResponse.ok(authService.forgotPassword(request.email(), http));
    }

    @PostMapping("/reset-password")
    public ApiResponse<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request, HttpServletRequest http) {
        authService.resetPassword(request, http);
        return ApiResponse.ok(new MessageResponse("Password updated. Please sign in."));
    }

    @PostMapping("/change-password")
    public ApiResponse<MessageResponse> changePassword(@Valid @RequestBody ChangePasswordRequest request, HttpServletRequest http) {
        authService.changePassword(request, http);
        return ApiResponse.ok(new MessageResponse("Password changed"));
    }

    @GetMapping("/login-history")
    @Operation(summary = "Login history for the current user, or for another user with USER_VIEW")
    public ApiResponse<List<LoginHistoryResponse>> loginHistory(@RequestParam(required = false) UUID userId,
                                                                @RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "20") int size) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID target = userId == null ? principal.getUserId() : userId;
        if (!target.equals(principal.getUserId()) && !principal.hasPermission("USER_VIEW")) {
            throw ApiException.forbidden("Not allowed to view other users' login history");
        }
        return ApiResponse.page(authService.loginHistory(target, PageRequest.of(page, Math.min(size, 100))));
    }
}
