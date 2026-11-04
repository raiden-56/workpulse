package com.workpulse.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.data.domain.Page;

import java.time.Instant;

/**
 * Standard response envelope used by every REST endpoint.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, PageMeta meta, ApiError error, Instant timestamp) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, null, Instant.now());
    }

    public static <T> ApiResponse<T> ok(T data, PageMeta meta) {
        return new ApiResponse<>(true, data, meta, null, Instant.now());
    }

    public static <T> ApiResponse<java.util.List<T>> page(Page<T> page) {
        return new ApiResponse<>(true, page.getContent(), PageMeta.from(page), null, Instant.now());
    }

    public static ApiResponse<Void> fail(ApiError error) {
        return new ApiResponse<>(false, null, null, error, Instant.now());
    }
}
