package com.workpulse.organizations;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.organizations.dto.OrganizationDtos.CreateOrganizationRequest;
import com.workpulse.organizations.dto.OrganizationDtos.CreateOrganizationResponse;
import com.workpulse.organizations.dto.OrganizationDtos.OrganizationResponse;
import com.workpulse.organizations.dto.OrganizationDtos.OrganizationSummary;
import com.workpulse.organizations.dto.OrganizationDtos.UpdateOrganizationRequest;
import com.workpulse.organizations.dto.OrganizationDtos.UpdateSettingsRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
@Tag(name = "Organizations")
public class OrganizationController {

    private final OrganizationService organizationService;

    @GetMapping
    @PreAuthorize("hasAuthority('ORGANIZATION_VIEW')")
    @Operation(summary = "Organisations visible to the caller (all for super admins)")
    public ApiResponse<List<OrganizationSummary>> list() {
        return ApiResponse.ok(organizationService.list());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ORGANIZATION_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CreateOrganizationResponse> create(@Valid @RequestBody CreateOrganizationRequest request) {
        return ApiResponse.ok(organizationService.create(request));
    }

    @GetMapping("/current")
    @PreAuthorize("hasAuthority('ORGANIZATION_VIEW') or hasAuthority('DASHBOARD_VIEW')")
    public ApiResponse<OrganizationResponse> current() {
        return ApiResponse.ok(organizationService.current());
    }

    @PutMapping("/current/settings")
    @PreAuthorize("hasAuthority('ORGANIZATION_CONFIGURE')")
    public ApiResponse<OrganizationResponse> updateSettings(@RequestBody UpdateSettingsRequest request) {
        return ApiResponse.ok(organizationService.updateSettings(request.settings()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ORGANIZATION_VIEW')")
    public ApiResponse<OrganizationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(organizationService.get(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ORGANIZATION_UPDATE')")
    public ApiResponse<OrganizationResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateOrganizationRequest request) {
        return ApiResponse.ok(organizationService.update(id, request));
    }
}
