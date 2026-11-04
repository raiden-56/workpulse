package com.workpulse.devices;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.devices.dto.DeviceDtos.AssignDeviceEmployeeRequest;
import com.workpulse.devices.dto.DeviceDtos.DeviceFilter;
import com.workpulse.devices.dto.DeviceDtos.DeviceResponse;
import com.workpulse.devices.dto.DeviceDtos.DeviceSummary;
import com.workpulse.devices.dto.DeviceDtos.UpdateDeviceRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
@Tag(name = "Devices", description = "Device inventory, approval and revocation")
public class DeviceController {

    private static final Set<String> SORTABLE = Set.of("hostname", "status", "health", "lastSeenAt", "lastSyncAt", "registeredAt", "agentVersion");

    private final DeviceService deviceService;

    @GetMapping
    @PreAuthorize("hasAuthority('DEVICE_VIEW')")
    public ApiResponse<List<DeviceResponse>> list(@RequestParam(required = false) String q,
                                                  @RequestParam(required = false) DeviceStatus status,
                                                  @RequestParam(required = false) DeviceHealth health,
                                                  @RequestParam(required = false) UUID employeeId,
                                                  @RequestParam(required = false) UUID departmentId,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "25") int size,
                                                  @RequestParam(defaultValue = "lastSeenAt,desc") String sort) {
        String[] parts = sort.split(",");
        String property = SORTABLE.contains(parts[0]) ? parts[0] : "lastSeenAt";
        Sort.Direction direction = parts.length > 1 && parts[1].equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        PageRequest pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(direction, property));
        return ApiResponse.page(deviceService.list(new DeviceFilter(q, status, health, employeeId, departmentId), pageable));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('DEVICE_VIEW')")
    public ApiResponse<DeviceSummary> summary() {
        return ApiResponse.ok(deviceService.summary());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DEVICE_VIEW')")
    public ApiResponse<DeviceResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(deviceService.get(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DEVICE_UPDATE')")
    public ApiResponse<DeviceResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateDeviceRequest request) {
        return ApiResponse.ok(deviceService.update(id, request));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('DEVICE_APPROVE')")
    public ApiResponse<DeviceResponse> approve(@PathVariable UUID id) {
        return ApiResponse.ok(deviceService.approve(id));
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize("hasAuthority('DEVICE_DELETE')")
    public ApiResponse<DeviceResponse> revoke(@PathVariable UUID id) {
        return ApiResponse.ok(deviceService.revoke(id));
    }

    @PutMapping("/{id}/employee")
    @PreAuthorize("hasAuthority('DEVICE_UPDATE')")
    public ApiResponse<DeviceResponse> assignEmployee(@PathVariable UUID id, @Valid @RequestBody AssignDeviceEmployeeRequest request) {
        return ApiResponse.ok(deviceService.assignEmployee(id, request.employeeId()));
    }
}
