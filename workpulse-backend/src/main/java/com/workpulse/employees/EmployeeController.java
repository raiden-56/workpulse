package com.workpulse.employees;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.employees.dto.EmployeeDtos.AssignDepartmentRequest;
import com.workpulse.employees.dto.EmployeeDtos.AssignManagerRequest;
import com.workpulse.employees.dto.EmployeeDtos.AssignTeamRequest;
import com.workpulse.employees.dto.EmployeeDtos.CreateEmployeeRequest;
import com.workpulse.employees.dto.EmployeeDtos.EmployeeFilter;
import com.workpulse.employees.dto.EmployeeDtos.EmployeeResponse;
import com.workpulse.employees.dto.EmployeeDtos.UpdateEmployeeRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/employees")
@RequiredArgsConstructor
@Tag(name = "Employees", description = "Employee directory and organisation structure assignments")
public class EmployeeController {

    private static final Set<String> SORTABLE = Set.of("lastName", "firstName", "employeeCode", "workEmail", "joiningDate", "designation", "employmentStatus");

    private final EmployeeService employeeService;

    @GetMapping
    @PreAuthorize("hasAuthority('EMPLOYEE_VIEW')")
    @Operation(summary = "Search the employee directory within the caller's scope")
    public ApiResponse<List<EmployeeResponse>> list(@RequestParam(required = false) String q,
                                                    @RequestParam(required = false) UUID departmentId,
                                                    @RequestParam(required = false) UUID teamId,
                                                    @RequestParam(required = false) EmploymentStatus status,
                                                    @RequestParam(required = false) String roleProfile,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "25") int size,
                                                    @RequestParam(defaultValue = "lastName,asc") String sort) {
        String[] parts = sort.split(",");
        String property = SORTABLE.contains(parts[0]) ? parts[0] : "lastName";
        Sort.Direction direction = parts.length > 1 && parts[1].equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(direction, property).and(Sort.by("firstName")));
        return ApiResponse.page(employeeService.list(new EmployeeFilter(q, departmentId, teamId, status, roleProfile), pageable));
    }

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('SELF_VIEW')")
    public ApiResponse<EmployeeResponse> me() {
        return ApiResponse.ok(employeeService.me());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('EMPLOYEE_VIEW')")
    public ApiResponse<EmployeeResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(employeeService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('EMPLOYEE_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EmployeeResponse> create(@Valid @RequestBody CreateEmployeeRequest request) {
        return ApiResponse.ok(employeeService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('EMPLOYEE_UPDATE')")
    public ApiResponse<EmployeeResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateEmployeeRequest request) {
        return ApiResponse.ok(employeeService.update(id, request));
    }

    @PostMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('EMPLOYEE_DELETE')")
    public ApiResponse<EmployeeResponse> deactivate(@PathVariable UUID id) {
        return ApiResponse.ok(employeeService.deactivate(id));
    }

    @PutMapping("/{id}/manager")
    @PreAuthorize("hasAuthority('EMPLOYEE_UPDATE')")
    public ApiResponse<EmployeeResponse> assignManager(@PathVariable UUID id, @Valid @RequestBody AssignManagerRequest request) {
        return ApiResponse.ok(employeeService.assignManager(id, request.managerEmployeeId()));
    }

    @PutMapping("/{id}/department")
    @PreAuthorize("hasAuthority('EMPLOYEE_UPDATE')")
    public ApiResponse<EmployeeResponse> assignDepartment(@PathVariable UUID id, @Valid @RequestBody AssignDepartmentRequest request) {
        return ApiResponse.ok(employeeService.assignDepartment(id, request.departmentId()));
    }

    @PutMapping("/{id}/team")
    @PreAuthorize("hasAuthority('EMPLOYEE_UPDATE')")
    public ApiResponse<EmployeeResponse> assignTeam(@PathVariable UUID id, @Valid @RequestBody AssignTeamRequest request) {
        return ApiResponse.ok(employeeService.assignTeam(id, request.teamId()));
    }
}
