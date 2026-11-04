package com.workpulse.auth;

import com.workpulse.auth.dto.AuthDtos.AuthTokensResponse;
import com.workpulse.auth.dto.AuthDtos.ChangePasswordRequest;
import com.workpulse.auth.dto.AuthDtos.ForgotPasswordResponse;
import com.workpulse.auth.dto.AuthDtos.LoginHistoryResponse;
import com.workpulse.auth.dto.AuthDtos.LoginRequest;
import com.workpulse.auth.dto.AuthDtos.MeResponse;
import com.workpulse.auth.dto.AuthDtos.ResetPasswordRequest;
import com.workpulse.auth.dto.AuthDtos.ScopeResponse;
import com.workpulse.common.util.HashUtil;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.exception.ApiException;
import com.workpulse.exception.ErrorCode;
import com.workpulse.organizations.Organization;
import com.workpulse.organizations.OrganizationRepository;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.UserPrincipal;
import com.workpulse.security.jwt.JwtService;
import com.workpulse.users.PrincipalFactory;
import com.workpulse.users.User;
import com.workpulse.users.UserRepository;
import com.workpulse.users.UserStatus;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final LoginAuditRepository loginAuditRepository;
    private final PasswordEncoder passwordEncoder;
    private final PrincipalFactory principalFactory;
    private final JwtService jwtService;
    private final WorkPulseProperties properties;

    @Transactional(noRollbackFor = ApiException.class)
    public AuthTokensResponse login(LoginRequest request, HttpServletRequest http) {
        String email = request.email().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty() || userOpt.get().getPasswordHash() == null
                || !passwordEncoder.matches(request.password(), userOpt.get().getPasswordHash())) {
            audit(userOpt.orElse(null), email, LoginOutcome.INVALID_CREDENTIALS, http);
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }
        User user = userOpt.get();
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.REVOKED) {
            audit(user, email, LoginOutcome.ACCOUNT_SUSPENDED, http);
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, "This account is suspended. Contact your administrator.");
        }
        if (user.getStatus() == UserStatus.INVITED) {
            audit(user, email, LoginOutcome.ACCOUNT_INACTIVE, http);
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, "This account has not been activated yet");
        }
        user.setLastLoginAt(Instant.now());
        audit(user, email, LoginOutcome.SUCCESS, http);
        UserPrincipal principal = principalFactory.build(user);
        return issueTokens(principal, UUID.randomUUID(), http);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthTokensResponse refresh(String rawRefreshToken, HttpServletRequest http) {
        RefreshToken token = refreshTokenRepository.findByTokenHash(HashUtil.sha256Hex(rawRefreshToken))
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Invalid refresh token"));
        if (token.getRevokedAt() != null || token.getReplacedBy() != null) {
            // Rotated token presented again: possible theft. Kill the entire family.
            refreshTokenRepository.revokeFamily(token.getFamilyId(), Instant.now());
            userRepository.findById(token.getUserId()).ifPresent(u -> audit(u, u.getEmail(), LoginOutcome.TOKEN_REUSE_DETECTED, http));
            throw new ApiException(ErrorCode.TOKEN_REUSED, "Refresh token reuse detected; please sign in again");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(ErrorCode.TOKEN_EXPIRED, "Refresh token has expired");
        }
        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "User no longer exists"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, "This account is not active");
        }
        UserPrincipal principal = principalFactory.build(user);
        AuthTokensResponse response = issueTokens(principal, token.getFamilyId(), http);
        token.setRevokedAt(Instant.now());
        token.setReplacedBy(refreshTokenRepository.findByTokenHash(HashUtil.sha256Hex(response.refreshToken())).map(RefreshToken::getId).orElse(null));
        audit(user, user.getEmail(), LoginOutcome.REFRESH, http);
        return response;
    }

    @Transactional
    public void logout(String rawRefreshToken, HttpServletRequest http) {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokenRepository.findByTokenHash(HashUtil.sha256Hex(rawRefreshToken))
                    .ifPresent(t -> refreshTokenRepository.revokeFamily(t.getFamilyId(), Instant.now()));
        } else if (!principal.isGuest()) {
            refreshTokenRepository.revokeAllForUser(principal.getUserId(), Instant.now());
        }
        if (!principal.isGuest()) {
            userRepository.findById(principal.getUserId()).ifPresent(u -> audit(u, u.getEmail(), LoginOutcome.LOGOUT, http));
        }
    }

    @Transactional(readOnly = true)
    public MeResponse me() {
        UserPrincipal principal = SecurityUtils.requireUser();
        return toMe(principal, null, null);
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(String email, HttpServletRequest http) {
        String normalized = email.trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normalized);
        String devToken = null;
        if (userOpt.isPresent() && userOpt.get().getStatus() == UserStatus.ACTIVE) {
            User user = userOpt.get();
            String raw = HashUtil.randomToken(32);
            PasswordResetToken token = new PasswordResetToken();
            token.setUserId(user.getId());
            token.setTokenHash(HashUtil.sha256Hex(raw));
            token.setExpiresAt(Instant.now().plus(Duration.ofHours(1)));
            resetTokenRepository.save(token);
            audit(user, normalized, LoginOutcome.PASSWORD_RESET_REQUESTED, http);
            // Email delivery is wired in Phase 10; until then the token is logged for local development only.
            log.info("[DEV ONLY] Password reset token for {}: {}", normalized, raw);
            if (properties.demo().enabled()) {
                devToken = raw;
            }
        }
        return new ForgotPasswordResponse("If an account exists for this email, password reset instructions have been sent.", devToken);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request, HttpServletRequest http) {
        PasswordResetToken token = resetTokenRepository.findByTokenHash(HashUtil.sha256Hex(request.token()))
                .filter(PasswordResetToken::isUsable)
                .orElseThrow(() -> ApiException.badRequest("Reset link is invalid or has expired"));
        User user = userRepository.findById(token.getUserId()).orElseThrow(() -> ApiException.notFound("User", token.getUserId()));
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setPasswordChangedAt(Instant.now());
        token.setUsedAt(Instant.now());
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
        audit(user, user.getEmail(), LoginOutcome.PASSWORD_RESET, http);
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request, HttpServletRequest http) {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (principal.isGuest()) {
            throw ApiException.forbidden("Guests cannot change passwords");
        }
        User user = userRepository.findById(principal.getUserId()).orElseThrow(() -> ApiException.notFound("User", principal.getUserId()));
        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(Instant.now());
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
        audit(user, user.getEmail(), LoginOutcome.PASSWORD_CHANGED, http);
    }

    @Transactional(readOnly = true)
    public Page<LoginHistoryResponse> loginHistory(UUID userId, Pageable pageable) {
        return loginAuditRepository.findByUserIdOrderByOccurredAtDesc(userId, pageable)
                .map(a -> new LoginHistoryResponse(a.getId(), a.getOutcome().name(), a.getIpAddress(), a.getUserAgent(), a.getOccurredAt()));
    }

    /** Issues an access + refresh token pair for a fully built principal (also used by guest sessions). */
    @Transactional
    public AuthTokensResponse issueTokens(UserPrincipal principal, UUID familyId, HttpServletRequest http) {
        String accessToken = jwtService.createAccessToken(principal);
        String rawRefresh = HashUtil.randomToken(48);
        RefreshToken refresh = new RefreshToken();
        refresh.setUserId(principal.getUserId());
        refresh.setTokenHash(HashUtil.sha256Hex(rawRefresh));
        refresh.setFamilyId(familyId);
        refresh.setExpiresAt(Instant.now().plus(properties.jwt().refreshTokenTtl()));
        if (http != null) {
            refresh.setUserAgent(trim(http.getHeader("User-Agent"), 255));
            refresh.setIpAddress(com.workpulse.audit.AuditService.clientIp(http));
        }
        refreshTokenRepository.save(refresh);
        return new AuthTokensResponse(accessToken, rawRefresh, "Bearer", jwtService.accessTtl().toSeconds(),
                toMe(principal, null, null));
    }

    public AuthTokensResponse issueGuestTokens(UserPrincipal principal, Duration ttl, String persona, Instant expiresAt) {
        String accessToken = jwtService.createAccessToken(principal, ttl);
        return new AuthTokensResponse(accessToken, null, "Bearer", ttl.toSeconds(), toMe(principal, persona, expiresAt));
    }

    public MeResponse toMe(UserPrincipal principal, String persona, Instant guestExpiresAt) {
        Organization org = principal.getOrganizationId() == null ? null
                : organizationRepository.findById(principal.getOrganizationId()).orElse(null);
        ScopeResponse scope = principal.getScope() == null ? null : new ScopeResponse(principal.getScope().level().name(),
                principal.getScope().departmentIds(), principal.getScope().teamIds(), principal.getScope().employeeId());
        return new MeResponse(principal.getUserId(), principal.getEmail(), principal.getDisplayName(),
                principal.getOrganizationId(), org == null ? null : org.getName(), org == null ? "UTC" : org.getTimezone(),
                org != null && org.isDemo(), principal.getEmployeeId(), principal.getRoles(), principal.getPermissions(),
                scope, principal.getGuestType(), persona, guestExpiresAt);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void audit(User user, String email, LoginOutcome outcome, HttpServletRequest http) {
        LoginAudit entry = new LoginAudit();
        entry.setUserId(user == null ? null : user.getId());
        entry.setOrganizationId(user == null ? null : user.getOrganizationId());
        entry.setEmail(email);
        entry.setOutcome(outcome);
        if (http != null) {
            entry.setIpAddress(com.workpulse.audit.AuditService.clientIp(http));
            entry.setUserAgent(trim(http.getHeader("User-Agent"), 255));
        }
        loginAuditRepository.save(entry);
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
