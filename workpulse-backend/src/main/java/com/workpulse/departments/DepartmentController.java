package com.workpulse.departments;

import com.workpulse.audit.AuditService;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.security.TenantContext;
import com.workpulse.teams.TeamRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
@RequiredArgsConstructor
@Tag(name = "Departments")
public class DepartmentController {

    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditService auditService;

    public record DepartmentRequest(@NotBlank @Size(max = 120) String name, @Size(max = 32) String code,
                                    UUID parentId, UUID headEmployeeId) {}

    public record DepartmentResponse(UUID id, String name, String code, UUID parentId, UUID headEmployeeId, String status,
                                     long teamCount, long employeeCount) {}

    @GetMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_VIEW')")
    @Transactional(readOnly = true)
    public ApiResponse<List<DepartmentResponse>> list() {
        UUID org = TenantContext.require();
        return ApiResponse.ok(departmentRepository.findByOrganizationIdOrderByNameAsc(org).stream().map(this::toResponse).toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_VIEW')")
    @Transactional(readOnly = true)
    public ApiResponse<DepartmentResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(toResponse(load(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<DepartmentResponse> create(@Valid @RequestBody DepartmentRequest request) {
        UUID org = TenantContext.require();
        if (departmentRepository.existsByOrganizationIdAndNameIgnoreCase(org, request.name().trim())) {
            throw ApiException.conflict("A department with this name already exists");
        }
        Department d = new Department();
        d.setOrganizationId(org);
        apply(d, request);
        d = departmentRepository.save(d);
        auditService.record("DEPARTMENT_CREATED", "DEPARTMENT", d.getId(), null, Map.of("name", d.getName()));
        return ApiResponse.ok(toResponse(d));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    @Transactional
    public ApiResponse<DepartmentResponse> update(@PathVariable UUID id, @Valid @RequestBody DepartmentRequest request) {
        Department d = load(id);
        Map<String, Object> before = Map.of("name", d.getName());
        apply(d, request);
        auditService.record("DEPARTMENT_UPDATED", "DEPARTMENT", d.getId(), before, Map.of("name", d.getName()));
        return ApiResponse.ok(toResponse(d));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_DELETE')")
    @Transactional
    public ApiResponse<DepartmentResponse> archive(@PathVariable UUID id) {
        Department d = load(id);
        if (employeeRepository.countByOrganizationIdAndDepartmentId(d.getOrganizationId(), d.getId()) > 0) {
            throw ApiException.conflict("Reassign the department's employees before archiving it");
        }
        d.setStatus("ARCHIVED");
        auditService.record("DEPARTMENT_ARCHIVED", "DEPARTMENT", d.getId(), Map.of("status", "ACTIVE"), Map.of("status", "ARCHIVED"));
        return ApiResponse.ok(toResponse(d));
    }

    private void apply(Department d, DepartmentRequest request) {
        d.setName(request.name().trim());
        d.setCode(request.code());
        d.setParentId(request.parentId());
        d.setHeadEmployeeId(request.headEmployeeId());
    }

    private Department load(UUID id) {
        return departmentRepository.findByIdAndOrganizationId(id, TenantContext.require())
                .orElseThrow(() -> ApiException.notFound("Department", id));
    }

    private DepartmentResponse toResponse(Department d) {
        return new DepartmentResponse(d.getId(), d.getName(), d.getCode(), d.getParentId(), d.getHeadEmployeeId(), d.getStatus(),
                teamRepository.findByOrganizationIdAndDepartmentIdOrderByNameAsc(d.getOrganizationId(), d.getId()).size(),
                employeeRepository.countByOrganizationIdAndDepartmentId(d.getOrganizationId(), d.getId()));
    }
}
