package com.workpulse.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workpulse.common.api.ApiError;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.io.IOException;

/** Writes the standard envelope when an authenticated principal lacks a permission. */
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public ApiAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        response.setStatus(ErrorCode.FORBIDDEN.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.fail(new ApiError(
                ErrorCode.FORBIDDEN.name(), "You do not have permission to perform this action", null, MDC.get("traceId"))));
    }
}
