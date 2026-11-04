package com.workpulse.agent;

import com.workpulse.agent.dto.AgentDtos.HeartbeatRequest;
import com.workpulse.agent.dto.AgentDtos.HeartbeatResponse;
import com.workpulse.agent.dto.AgentDtos.RegisterDeviceRequest;
import com.workpulse.agent.dto.AgentDtos.RegisterDeviceResponse;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;
import com.workpulse.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/agent")
@RequiredArgsConstructor
@Tag(name = "Agent", description = "Desktop agent registration, heartbeat and policy delivery")
public class AgentController {

    private final AgentService agentService;

    @PostMapping("/register")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register this workstation for the signed-in employee and obtain a device token")
    public ApiResponse<RegisterDeviceResponse> register(@Valid @RequestBody RegisterDeviceRequest request) {
        return ApiResponse.ok(agentService.register(SecurityUtils.requireUser(), request));
    }

    @PostMapping("/heartbeat")
    @PreAuthorize("hasAuthority('DEVICE')")
    public ApiResponse<HeartbeatResponse> heartbeat(@Valid @RequestBody HeartbeatRequest request) {
        return ApiResponse.ok(agentService.heartbeat(SecurityUtils.requireDevice(), request));
    }

    @GetMapping("/policy")
    @PreAuthorize("hasAuthority('DEVICE')")
    public ApiResponse<EffectivePolicyResponse> policy() {
        return ApiResponse.ok(agentService.policy(SecurityUtils.requireDevice()));
    }
}
