package com.workpulse.guest;

import com.workpulse.auth.dto.AuthDtos.AuthTokensResponse;
import com.workpulse.auth.dto.AuthDtos.MessageResponse;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.guest.dto.GuestDtos.CreateGuestSessionRequest;
import com.workpulse.guest.dto.GuestDtos.GuestConfigResponse;
import com.workpulse.guest.dto.GuestDtos.ResetResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/guest")
@RequiredArgsConstructor
@Tag(name = "Guest Mode", description = "Public demo guest sessions on the simulated organisation")
public class GuestController {

    private final GuestService guestService;

    @GetMapping("/config")
    @Operation(summary = "Whether Guest Mode is available, the personas offered and the demo notice")
    public ApiResponse<GuestConfigResponse> config() {
        return ApiResponse.ok(guestService.config());
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Start a read-only demo session (no registration required)")
    public ApiResponse<AuthTokensResponse> create(@Valid @RequestBody(required = false) CreateGuestSessionRequest request,
                                                  HttpServletRequest http) {
        return ApiResponse.ok(guestService.createDemoSession(request == null ? null : request.persona(), http));
    }

    @DeleteMapping("/sessions/current")
    @PreAuthorize("hasRole('GUEST_DEMO') or hasRole('GUEST_AUTHORIZED')")
    public ApiResponse<MessageResponse> end() {
        guestService.endCurrentSession();
        return ApiResponse.ok(new MessageResponse("Guest session ended"));
    }

    @PostMapping("/demo/reset")
    @PreAuthorize("hasRole('GUEST_DEMO') or hasRole('SUPER_ADMIN')")
    @Operation(summary = "Regenerate the simulated demo data (rate-limited)")
    public ApiResponse<ResetResponse> reset() {
        return ApiResponse.ok(guestService.resetDemo());
    }
}
