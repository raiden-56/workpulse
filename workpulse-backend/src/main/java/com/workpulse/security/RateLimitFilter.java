package com.workpulse.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workpulse.common.api.ApiError;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.exception.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

/**
 * Fixed-window rate limiter backed by Redis for the abuse-prone public endpoints.
 * If Redis is unreachable the request is allowed and a warning is logged (fail-open), so a
 * cache outage never takes the API down.
 */
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;
    private final WorkPulseProperties properties;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(StringRedisTemplate redis, WorkPulseProperties properties, ObjectMapper objectMapper) {
        this.redis = redis;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.rateLimit().enabled() || !"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return limitFor(request.getRequestURI()) <= 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        int limit = limitFor(uri);
        String subject = uri.endsWith("/activity/batch") && request.getHeader("X-Device-Token") != null
                ? "dev:" + request.getHeader("X-Device-Token").hashCode()
                : "ip:" + clientIp(request);
        String key = "wp:rl:" + uri + ":" + subject;
        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, Duration.ofMinutes(1));
            }
            if (count != null && count > limit) {
                response.setStatus(ErrorCode.RATE_LIMITED.status().value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", "60");
                objectMapper.writeValue(response.getOutputStream(), ApiResponse.fail(new ApiError(
                        ErrorCode.RATE_LIMITED.name(), "Too many requests, please retry shortly", null, MDC.get("traceId"))));
                return;
            }
        } catch (Exception ex) {
            log.warn("Rate limiter unavailable ({}); allowing request", ex.getClass().getSimpleName());
        }
        chain.doFilter(request, response);
    }

    private int limitFor(String uri) {
        if (uri.endsWith("/auth/login") || uri.endsWith("/auth/forgot-password") || uri.endsWith("/auth/reset-password")) {
            return properties.rateLimit().loginPerMinute();
        }
        if (uri.endsWith("/guest/sessions")) {
            return properties.rateLimit().guestPerMinute();
        }
        if (uri.endsWith("/activity/batch")) {
            return properties.rateLimit().activityBatchPerMinute();
        }
        return 0;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
