package com.workpulse.security.device;

import com.workpulse.common.util.HashUtil;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.devices.DeviceToken;
import com.workpulse.devices.DeviceTokenRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.exception.ErrorCode;
import com.workpulse.security.DevicePrincipal;
import com.workpulse.security.TenantContext;
import com.workpulse.security.jwt.JwtAuthenticationFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Authenticates desktop agents from the {@code X-Device-Token} header.
 */
public class DeviceTokenAuthenticationFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Device-Token";

    private final DeviceTokenRepository deviceTokenRepository;

    public DeviceTokenAuthenticationFilter(DeviceTokenRepository deviceTokenRepository) {
        this.deviceTokenRepository = deviceTokenRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getHeader(HEADER) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                String raw = request.getHeader(HEADER).trim();
                Optional<DeviceToken> tokenOpt = deviceTokenRepository.findByTokenHashAndRevokedAtIsNull(HashUtil.sha256Hex(raw));
                if (tokenOpt.isEmpty()) {
                    request.setAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE,
                            new ApiException(ErrorCode.UNAUTHORIZED, "Unknown device token"));
                } else {
                    DeviceToken token = tokenOpt.get();
                    Device device = token.getDevice();
                    if (token.getExpiresAt() != null && token.getExpiresAt().isBefore(Instant.now())) {
                        request.setAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE,
                                new ApiException(ErrorCode.TOKEN_EXPIRED, "Device token has expired"));
                    } else if (device.getStatus() == DeviceStatus.REVOKED || device.getStatus() == DeviceStatus.RETIRED) {
                        request.setAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE,
                                new ApiException(ErrorCode.DEVICE_REVOKED, "Device access has been revoked"));
                    } else {
                        DevicePrincipal principal = new DevicePrincipal(device.getId(), device.getOrganizationId(),
                                device.getEmployeeId(), device.getHostname(), token.getId());
                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                principal, null, List.of(new SimpleGrantedAuthority(DevicePrincipal.AUTHORITY),
                                new SimpleGrantedAuthority("DEVICE_STATUS_" + device.getStatus().name())));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                        TenantContext.set(device.getOrganizationId());
                        MDC.put("deviceId", device.getId().toString());
                        MDC.put("orgId", device.getOrganizationId().toString());
                    }
                }
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            MDC.remove("deviceId");
            MDC.remove("orgId");
        }
    }
}
