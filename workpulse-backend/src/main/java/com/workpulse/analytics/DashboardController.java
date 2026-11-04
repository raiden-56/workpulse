package com.workpulse.analytics;

import com.workpulse.analytics.dto.DashboardDtos.DashboardOverviewResponse;
import com.workpulse.analytics.dto.DashboardDtos.MyDashboardResponse;
import com.workpulse.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('DASHBOARD_VIEW')")
    @Operation(summary = "Executive / department / team overview for a date range, scoped to the caller")
    public ApiResponse<DashboardOverviewResponse> overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) UUID teamId) {
        return ApiResponse.ok(dashboardService.overview(from, to, departmentId, teamId));
    }

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('SELF_VIEW') or hasAuthority('DASHBOARD_VIEW')")
    @Operation(summary = "Personal dashboard for the signed-in employee")
    public ApiResponse<MyDashboardResponse> me() {
        return ApiResponse.ok(dashboardService.me());
    }
}
