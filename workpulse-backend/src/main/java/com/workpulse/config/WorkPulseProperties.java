package com.workpulse.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

/**
 * Typed application configuration bound from the {@code workpulse.*} namespace.
 */
@Validated
@ConfigurationProperties(prefix = "workpulse")
public record WorkPulseProperties(
        @NotNull Jwt jwt,
        @NotNull Cors cors,
        @NotNull Demo demo,
        @NotNull Bootstrap bootstrap,
        @NotNull Agent agent,
        @NotNull RateLimit rateLimit
) {

    public record Jwt(
            @NotBlank @Size(min = 32, message = "JWT secret must be at least 32 characters") String secret,
            @NotBlank String issuer,
            @NotNull Duration accessTokenTtl,
            @NotNull Duration refreshTokenTtl,
            @NotNull Duration guestTokenTtl
    ) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Demo(boolean enabled, @NotBlank String organizationSlug, @Min(1) int seedDays, @Min(1) int employeeCount) {}

    public record Bootstrap(@NotBlank String adminEmail, @NotBlank String adminPassword, @NotBlank String organizationName) {}

    public record Agent(boolean autoApproveDevices, @Min(1) int maxBatchEvents, @NotNull Duration offlineAfter) {}

    public record RateLimit(boolean enabled, @Min(1) int loginPerMinute, @Min(1) int guestPerMinute, @Min(1) int activityBatchPerMinute) {}
}
