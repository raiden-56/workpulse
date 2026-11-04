package com.workpulse.organizations.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class OrganizationDtos {

    private OrganizationDtos() {}

    public record OrganizationResponse(UUID id, String name, String slug, String code, String timezone, String status,
                                       boolean demo, Map<String, Object> settings, Instant createdAt,
                                       long employeeCount, long departmentCount, long deviceCount) {}

    public record OrganizationSummary(UUID id, String name, String slug, String timezone, boolean demo, String status) {}

    public record CreateOrganizationRequest(@NotBlank @Size(max = 160) String name,
                                            @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z0-9-]+", message = "slug may contain lower-case letters, digits and dashes") String slug,
                                            @Size(max = 32) String code,
                                            @Size(max = 64) String timezone,
                                            @NotBlank @Size(max = 255) String adminEmail,
                                            @NotBlank @Size(max = 160) String adminDisplayName) {}

    public record CreateOrganizationResponse(OrganizationResponse organization, String adminActivationToken) {}

    public record UpdateOrganizationRequest(@NotBlank @Size(max = 160) String name, @Size(max = 32) String code,
                                            @Size(max = 64) String timezone, String status) {}

    public record UpdateSettingsRequest(Map<String, Object> settings) {}
}
