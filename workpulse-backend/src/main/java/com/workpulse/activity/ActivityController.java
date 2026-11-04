package com.workpulse.activity;

import com.workpulse.activity.dto.ActivityDtos.ActivityBatchRequest;
import com.workpulse.activity.dto.ActivityDtos.ActivityBatchResponse;
import com.workpulse.activity.dto.ActivityDtos.LiveStatusResponse;
import com.workpulse.activity.dto.ActivityDtos.LiveSummary;
import com.workpulse.activity.dto.ActivityDtos.TimelineResponse;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/activity")
@RequiredArgsConstructor
@Tag(name = "Activity", description = "Event ingestion, live workforce status and activity timelines")
public class ActivityController {

    private final ActivityIngestionService ingestionService;
    private final ActivityQueryService queryService;

    @PostMapping("/batch")
    @PreAuthorize("hasAuthority('DEVICE')")
    @Operation(summary = "Idempotent ingestion of a batch of agent events")
    public ApiResponse<ActivityBatchResponse> batch(@Valid @RequestBody ActivityBatchRequest request) {
        return ApiResponse.ok(ingestionService.ingest(SecurityUtils.requireDevice(), request));
    }

    @GetMapping("/live")
    @PreAuthorize("hasAuthority('LIVE_MONITORING_VIEW')")
    @Operation(summary = "Current status of every employee in the caller's scope (polling fallback for the WebSocket topic)")
    public ApiResponse<List<LiveStatusResponse>> live(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) UUID departmentId,
                                                      @RequestParam(required = false) UUID teamId,
                                                      @RequestParam(required = false) ActivityState status,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "50") int size) {
        return ApiResponse.page(queryService.live(new ActivityQueryService.LiveFilter(q, departmentId, teamId, status),
                PageRequest.of(page, Math.min(size, 200))));
    }

    @GetMapping("/live/summary")
    @PreAuthorize("hasAuthority('LIVE_MONITORING_VIEW') or hasAuthority('DASHBOARD_VIEW')")
    public ApiResponse<LiveSummary> liveSummary() {
        return ApiResponse.ok(queryService.liveSummary());
    }

    @GetMapping("/timeline")
    @PreAuthorize("hasAuthority('ACTIVITY_VIEW') or hasAuthority('SELF_VIEW')")
    @Operation(summary = "Classified activity intervals for one employee and day, with reasons")
    public ApiResponse<TimelineResponse> timeline(@RequestParam(required = false) UUID employeeId,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(queryService.timeline(employeeId, date));
    }
}
