package com.workpulse.security.jwt;

import com.workpulse.exception.ApiException;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Authenticates portal users and guests from the {@code Authorization: Bearer} header and
 * populates the tenant context.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String AUTH_ERROR_ATTRIBUTE = "workpulse.authError";
    private static final String ORG_HEADER = "X-Organization-Id";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        try {
            if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
                String token = header.substring(7).trim();
                try {
                    UserPrincipal principal = jwtService.parse(token);
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(principal, null, principal.authorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    UUID organizationId = principal.getOrganizationId();
                    if (principal.isSuperAdmin()) {
                        String override = request.getHeader(ORG_HEADER);
                        if (override != null && !override.isBlank()) {
                            organizationId = UUID.fromString(override.trim());
                        }
                    }
                    TenantContext.set(organizationId);
                    MDC.put("userId", principal.getUserId().toString());
                    if (organizationId != null) {
                        MDC.put("orgId", organizationId.toString());
                    }
                } catch (ApiException ex) {
                    // Let the entry point report the precise reason (expired vs invalid).
                    request.setAttribute(AUTH_ERROR_ATTRIBUTE, ex);
                } catch (IllegalArgumentException ex) {
                    request.setAttribute(AUTH_ERROR_ATTRIBUTE, ApiException.badRequest("Invalid organization header"));
                }
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            MDC.remove("userId");
            MDC.remove("orgId");
        }
    }
}
