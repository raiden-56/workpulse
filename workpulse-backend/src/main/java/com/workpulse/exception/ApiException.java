package com.workpulse.exception;

import com.workpulse.common.api.ApiError;
import lombok.Getter;

import java.util.List;

@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final transient List<ApiError.FieldError> details;

    public ApiException(ErrorCode code, String message) {
        this(code, message, List.of());
    }

    public ApiException(ErrorCode code, String message, List<ApiError.FieldError> details) {
        super(message);
        this.code = code;
        this.details = details;
    }

    public static ApiException notFound(String entity, Object id) {
        return new ApiException(ErrorCode.NOT_FOUND, entity + " not found: " + id);
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(ErrorCode.BAD_REQUEST, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(ErrorCode.UNAUTHORIZED, message);
    }
}
