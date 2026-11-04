package com.workpulse.policies;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.exception.ApiException;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;
import com.workpulse.policies.dto.PolicyDtos.PolicyResponse;
import com.workpulse.security.AccessScopeService;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/policies")
@RequiredArgsConstructor
@Tag(name = "Monitoring policies")
public class PolicyController {

    private final PolicyService policyService;
    private final AccessScopeService accessScopeService;

    @GetMapping
    @PreAuthorize("hasAuthority('POLICY_VIEW')")
    public ApiResponse<List<PolicyResponse>> list() {
        return ApiResponse.ok(policyService.list(TenantContext.require()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('POLICY_VIEW')")
    public ApiResponse<PolicyResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(policyService.get(TenantContext.require(), id));
    }

    @GetMapping("/effective")
    @PreAuthorize("hasAuthority('POLICY_VIEW') or hasAuthority('SELF_VIEW')")
    @Operation(summary = "The policy that applies to an employee (defaults to the caller's own employee record)")
    public ApiResponse<EffectivePolicyResponse> effective(@RequestParam(required = false) UUID employeeId) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID target = employeeId == null ? principal.getEmployeeId() : employeeId;
        if (target != null && !target.equals(principal.getEmployeeId())) {
            if (!principal.hasPermission("POLICY_VIEW")) {
                throw ApiException.notFound("Employee", target);
            }
            accessScopeService.assertCanView(principal, target);
        }
        return ApiResponse.ok(policyService.effectiveFor(TenantContext.require(), target));
    }
}
