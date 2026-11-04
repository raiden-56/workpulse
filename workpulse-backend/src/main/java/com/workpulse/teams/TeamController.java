package com.workpulse.teams;

import com.workpulse.audit.AuditService;
import com.workpulse.common.api.ApiResponse;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.security.TenantContext;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teams")
@RequiredArgsConstructor
@Tag(name = "Teams")
public class TeamController {

    private final TeamRepository teamRepository;
    private final DepartmentRepository departmentRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditService auditService;

    public record TeamRequest(@NotBlank @Size(max = 120) String name, @Size(max = 32) String code,
                              @NotNull UUID departmentId, UUID leadEmployeeId) {}

    public record TeamResponse(UUID id, String name, String code, UUID departmentId, String departmentName,
                               UUID leadEmployeeId, String status, long employeeCount) {}

    @GetMapping
    @PreAuthorize("hasAuthority('TEAM_VIEW')")
    @Transactional(readOnly = true)
    public ApiResponse<List<TeamResponse>> list(@RequestParam(required = false) UUID departmentId) {
        UUID org = TenantContext.require();
        List<Team> teams = departmentId == null
                ? teamRepository.findByOrganizationIdOrderByNameAsc(org)
                : teamRepository.findByOrganizationIdAndDepartmentIdOrderByNameAsc(org, departmentId);
        return ApiResponse.ok(teams.stream().map(this::toResponse).toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('TEAM_VIEW')")
    @Transactional(readOnly = true)
    public ApiResponse<TeamResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(toResponse(load(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('TEAM_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<TeamResponse> create(@Valid @RequestBody TeamRequest request) {
        UUID org = TenantContext.require();
        departmentRepository.findByIdAndOrganizationId(request.departmentId(), org)
                .orElseThrow(() -> ApiException.notFound("Department", request.departmentId()));
        if (teamRepository.existsByOrganizationIdAndDepartmentIdAndNameIgnoreCase(org, request.departmentId(), request.name().trim())) {
            throw ApiException.conflict("A team with this name already exists in the department");
        }
        Team t = new Team();
        t.setOrganizationId(org);
        apply(t, request);
        t = teamRepository.save(t);
        auditService.record("TEAM_CREATED", "TEAM", t.getId(), null, Map.of("name", t.getName()));
        return ApiResponse.ok(toResponse(t));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('TEAM_UPDATE')")
    @Transactional
    public ApiResponse<TeamResponse> update(@PathVariable UUID id, @Valid @RequestBody TeamRequest request) {
        Team t = load(id);
        departmentRepository.findByIdAndOrganizationId(request.departmentId(), t.getOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Department", request.departmentId()));
        Map<String, Object> before = Map.of("name", t.getName(), "departmentId", t.getDepartmentId().toString());
        apply(t, request);
        auditService.record("TEAM_UPDATED", "TEAM", t.getId(), before, Map.of("name", t.getName(), "departmentId", t.getDepartmentId().toString()));
        return ApiResponse.ok(toResponse(t));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('TEAM_DELETE')")
    @Transactional
    public ApiResponse<TeamResponse> archive(@PathVariable UUID id) {
        Team t = load(id);
        if (employeeRepository.countByOrganizationIdAndTeamId(t.getOrganizationId(), t.getId()) > 0) {
            throw ApiException.conflict("Reassign the team's employees before archiving it");
        }
        t.setStatus("ARCHIVED");
        auditService.record("TEAM_ARCHIVED", "TEAM", t.getId(), Map.of("status", "ACTIVE"), Map.of("status", "ARCHIVED"));
        return ApiResponse.ok(toResponse(t));
    }

    private void apply(Team t, TeamRequest request) {
        t.setName(request.name().trim());
        t.setCode(request.code());
        t.setDepartmentId(request.departmentId());
        t.setLeadEmployeeId(request.leadEmployeeId());
    }

    private Team load(UUID id) {
        return teamRepository.findByIdAndOrganizationId(id, TenantContext.require())
                .orElseThrow(() -> ApiException.notFound("Team", id));
    }

    private TeamResponse toResponse(Team t) {
        String departmentName = departmentRepository.findById(t.getDepartmentId()).map(d -> d.getName()).orElse(null);
        return new TeamResponse(t.getId(), t.getName(), t.getCode(), t.getDepartmentId(), departmentName, t.getLeadEmployeeId(),
                t.getStatus(), employeeRepository.countByOrganizationIdAndTeamId(t.getOrganizationId(), t.getId()));
    }
}
