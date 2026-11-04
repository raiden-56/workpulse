package com.workpulse.security;

import com.workpulse.exception.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

public final class SecurityUtils {

    private SecurityUtils() {}

    public static Optional<UserPrincipal> currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            return Optional.of(principal);
        }
        return Optional.empty();
    }

    public static UserPrincipal requireUser() {
        return currentUser().orElseThrow(() -> ApiException.unauthorized("Authentication required"));
    }

    public static Optional<DevicePrincipal> currentDevice() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof DevicePrincipal principal) {
            return Optional.of(principal);
        }
        return Optional.empty();
    }

    public static DevicePrincipal requireDevice() {
        return currentDevice().orElseThrow(() -> ApiException.unauthorized("Device authentication required"));
    }

    public static UUID currentUserIdOrNull() {
        return currentUser().map(UserPrincipal::getUserId).orElse(null);
    }
}
