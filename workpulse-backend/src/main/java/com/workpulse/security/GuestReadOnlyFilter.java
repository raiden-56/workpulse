package com.workpulse.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workpulse.common.api.ApiError;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.exception.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Guests are read-only by construction: any non-safe HTTP method outside the guest module is
 * rejected before it reaches a controller, regardless of which permissions the token carries.
 */
public class GuestReadOnlyFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final ObjectMapper objectMapper;

    public GuestReadOnlyFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        UserPrincipal principal = SecurityUtils.currentUser().orElse(null);
        if (principal != null && principal.isGuest()
                && !SAFE_METHODS.contains(request.getMethod().toUpperCase())
                && !request.getRequestURI().startsWith("/api/v1/guest/")
                && !request.getRequestURI().startsWith("/api/v1/auth/logout")
                && !request.getRequestURI().startsWith("/api/v1/notifications/")) {
            response.setStatus(ErrorCode.FORBIDDEN.status().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(), ApiResponse.fail(new ApiError(
                    ErrorCode.FORBIDDEN.name(), "Guest sessions are read-only", null, MDC.get("traceId"))));
            return;
        }
        chain.doFilter(request, response);
    }
}
