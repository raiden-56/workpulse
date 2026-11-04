package com.workpulse.employees;

import com.workpulse.activity.LiveStatus;
import com.workpulse.activity.LiveStatusRepository;
import com.workpulse.audit.AuditService;
import com.workpulse.departments.Department;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.employees.dto.EmployeeDtos.CreateEmployeeRequest;
import com.workpulse.employees.dto.EmployeeDtos.EmployeeFilter;
import com.workpulse.employees.dto.EmployeeDtos.EmployeeResponse;
import com.workpulse.employees.dto.EmployeeDtos.UpdateEmployeeRequest;
import com.workpulse.exception.ApiException;
import com.workpulse.security.AccessScopeService;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import com.workpulse.shifts.Shift;
import com.workpulse.shifts.ShiftRepository;
import com.workpulse.teams.Team;
import com.workpulse.teams.TeamRepository;
import com.workpulse.users.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final ShiftRepository shiftRepository;
    private final DeviceRepository deviceRepository;
    private final LiveStatusRepository liveStatusRepository;
    private final ManagerAssignmentRepository managerAssignmentRepository;
    private final UserRepository userRepository;
    private final AccessScopeService accessScopeService;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Page<EmployeeResponse> list(EmployeeFilter filter, Pageable pageable) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID organizationId = TenantContext.require();
        Optional<Set<UUID>> visible = accessScopeService.visibleEmployeeIds(principal);
        if (visible.isPresent() && visible.get().isEmpty()) {
            return Page.empty(pageable);
        }
        Specification<Employee> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            visible.ifPresent(ids -> predicates.add(root.get("id").in(ids)));
            if (filter.departmentId() != null) predicates.add(cb.equal(root.get("departmentId"), filter.departmentId()));
            if (filter.teamId() != null) predicates.add(cb.equal(root.get("teamId"), filter.teamId()));
            if (filter.status() != null) predicates.add(cb.equal(root.get("employmentStatus"), filter.status()));
            if (filter.roleProfile() != null && !filter.roleProfile().isBlank()) {
                predicates.add(cb.equal(root.get("roleProfile"), filter.roleProfile().trim().toUpperCase()));
            }
            if (filter.q() != null && !filter.q().isBlank()) {
                String like = "%" + filter.q().trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(cb.concat(cb.concat(root.get("firstName"), " "), root.get("lastName"))), like),
                        cb.like(cb.lower(root.get("workEmail")), like),
                        cb.like(cb.lower(root.get("employeeCode")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("designation"), "")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<Employee> page = employeeRepository.findAll(spec, pageable);
        auditService.recordDataAccess("EMPLOYEE", "LIST", null, Map.of("count", page.getNumberOfElements()));
        return toResponses(page);
    }

    @Transactional(readOnly = true)
    public EmployeeResponse get(UUID id) {
        UserPrincipal principal = SecurityUtils.requireUser();
        Employee employee = load(id);
        accessScopeService.assertCanView(principal, employee.getId());
        auditService.recordDataAccess("EMPLOYEE", "VIEW", employee.getId(), Map.of());
        return toResponse(employee);
    }

    @Transactional(readOnly = true)
    public EmployeeResponse me() {
        UserPrincipal principal = SecurityUtils.requireUser();
        if (principal.getEmployeeId() == null) {
            throw ApiException.notFound("No employee profile is linked to this account");
        }
        return toResponse(load(principal.getEmployeeId()));
    }

    @Transactional
    public EmployeeResponse create(CreateEmployeeRequest request) {
        UUID organizationId = TenantContext.require();
        if (employeeRepository.existsByOrganizationIdAndEmployeeCode(organizationId, request.employeeCode().trim())) {
            throw ApiException.conflict("Employee code already exists");
        }
        if (employeeRepository.existsByOrganizationIdAndWorkEmailIgnoreCase(organizationId, request.workEmail().trim())) {
            throw ApiException.conflict("Work email already exists");
        }
        validateStructure(organizationId, request.departmentId(), request.teamId(), request.shiftId());
        Employee e = new Employee();
        e.setOrganizationId(organizationId);
        e.setEmployeeCode(request.employeeCode().trim());
        e.setFirstName(request.firstName().trim());
        e.setLastName(request.lastName().trim());
        e.setWorkEmail(request.workEmail().trim().toLowerCase());
        e.setDesignation(request.designation());
        e.setDepartmentId(request.departmentId());
        e.setTeamId(request.teamId());
        e.setShiftId(request.shiftId() != null ? request.shiftId()
                : shiftRepository.findFirstByOrganizationIdAndDefaultShiftTrue(organizationId).map(Shift::getId).orElse(null));
        e.setJoiningDate(request.joiningDate());
        e.setRoleProfile(request.roleProfile() == null || request.roleProfile().isBlank() ? "GENERAL" : request.roleProfile().trim().toUpperCase());
        e = employeeRepository.save(e);
        if (request.managerEmployeeId() != null) {
            assignManagerInternal(e, request.managerEmployeeId());
        }
        auditService.record("EMPLOYEE_CREATED", "EMPLOYEE", e.getId(), null, snapshot(e));
        return toResponse(e);
    }

    @Transactional
    public EmployeeResponse update(UUID id, UpdateEmployeeRequest request) {
        Employee e = load(id);
        Map<String, Object> before = snapshot(e);
        if (!e.getWorkEmail().equalsIgnoreCase(request.workEmail().trim())
                && employeeRepository.existsByOrganizationIdAndWorkEmailIgnoreCase(e.getOrganizationId(), request.workEmail().trim())) {
            throw ApiException.conflict("Work email already exists");
        }
        validateStructure(e.getOrganizationId(), request.departmentId(), request.teamId(), request.shiftId());
        e.setFirstName(request.firstName().trim());
        e.setLastName(request.lastName().trim());
        e.setWorkEmail(request.workEmail().trim().toLowerCase());
        e.setDesignation(request.designation());
        e.setDepartmentId(request.departmentId());
        e.setTeamId(request.teamId());
        e.setShiftId(request.shiftId());
        e.setJoiningDate(request.joiningDate());
        if (request.employmentStatus() != null) {
            e.setEmploymentStatus(request.employmentStatus());
        }
        if (request.roleProfile() != null && !request.roleProfile().isBlank()) {
            e.setRoleProfile(request.roleProfile().trim().toUpperCase());
        }
        auditService.record("EMPLOYEE_UPDATED", "EMPLOYEE", e.getId(), before, snapshot(e));
        return toResponse(e);
    }

    @Transactional
    public EmployeeResponse deactivate(UUID id) {
        Employee e = load(id);
        Map<String, Object> before = snapshot(e);
        e.setEmploymentStatus(EmploymentStatus.INACTIVE);
        liveStatusRepository.findById(e.getId()).ifPresent(s -> {
            s.setStatus(com.workpulse.activity.ActivityState.OFFLINE);
            s.setReason("Employee deactivated");
        });
        auditService.record("EMPLOYEE_DEACTIVATED", "EMPLOYEE", e.getId(), before, snapshot(e));
        return toResponse(e);
    }

    @Transactional
    public EmployeeResponse assignManager(UUID id, UUID managerEmployeeId) {
        Employee e = load(id);
        assignManagerInternal(e, managerEmployeeId);
        auditService.record("EMPLOYEE_MANAGER_ASSIGNED", "EMPLOYEE", e.getId(), null, Map.of("managerEmployeeId", managerEmployeeId.toString()));
        return toResponse(e);
    }

    @Transactional
    public EmployeeResponse assignDepartment(UUID id, UUID departmentId) {
        Employee e = load(id);
        validateStructure(e.getOrganizationId(), departmentId, null, null);
        Map<String, Object> before = snapshot(e);
        e.setDepartmentId(departmentId);
        if (e.getTeamId() != null) {
            Team team = teamRepository.findById(e.getTeamId()).orElse(null);
            if (team == null || !departmentId.equals(team.getDepartmentId())) {
                e.setTeamId(null);
            }
        }
        auditService.record("EMPLOYEE_DEPARTMENT_ASSIGNED", "EMPLOYEE", e.getId(), before, snapshot(e));
        return toResponse(e);
    }

    @Transactional
    public EmployeeResponse assignTeam(UUID id, UUID teamId) {
        Employee e = load(id);
        Team team = teamRepository.findByIdAndOrganizationId(teamId, e.getOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Team", teamId));
        Map<String, Object> before = snapshot(e);
        e.setTeamId(team.getId());
        e.setDepartmentId(team.getDepartmentId());
        auditService.record("EMPLOYEE_TEAM_ASSIGNED", "EMPLOYEE", e.getId(), before, snapshot(e));
        return toResponse(e);
    }

    private void assignManagerInternal(Employee e, UUID managerEmployeeId) {
        if (managerEmployeeId.equals(e.getId())) {
            throw ApiException.badRequest("An employee cannot be their own manager");
        }
        employeeRepository.findByIdAndOrganizationId(managerEmployeeId, e.getOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Employee", managerEmployeeId));
        managerAssignmentRepository.findFirstByEmployeeIdAndEffectiveToIsNullOrderByEffectiveFromDesc(e.getId())
                .ifPresent(current -> current.setEffectiveTo(LocalDate.now()));
        ManagerAssignment assignment = new ManagerAssignment();
        assignment.setOrganizationId(e.getOrganizationId());
        assignment.setEmployeeId(e.getId());
        assignment.setManagerEmployeeId(managerEmployeeId);
        assignment.setCreatedBy(SecurityUtils.currentUserIdOrNull());
        managerAssignmentRepository.save(assignment);
    }

    private void validateStructure(UUID organizationId, UUID departmentId, UUID teamId, UUID shiftId) {
        if (departmentId != null) {
            departmentRepository.findByIdAndOrganizationId(departmentId, organizationId)
                    .orElseThrow(() -> ApiException.notFound("Department", departmentId));
        }
        if (teamId != null) {
            Team team = teamRepository.findByIdAndOrganizationId(teamId, organizationId)
                    .orElseThrow(() -> ApiException.notFound("Team", teamId));
            if (departmentId != null && !team.getDepartmentId().equals(departmentId)) {
                throw ApiException.badRequest("Team does not belong to the selected department");
            }
        }
        if (shiftId != null) {
            shiftRepository.findByIdAndOrganizationId(shiftId, organizationId)
                    .orElseThrow(() -> ApiException.notFound("Shift", shiftId));
        }
    }

    private Employee load(UUID id) {
        return employeeRepository.findByIdAndOrganizationId(id, TenantContext.require())
                .orElseThrow(() -> ApiException.notFound("Employee", id));
    }

    private static Map<String, Object> snapshot(Employee e) {
        Map<String, Object> m = new HashMap<>();
        m.put("employeeCode", e.getEmployeeCode());
        m.put("name", e.getFullName());
        m.put("workEmail", e.getWorkEmail());
        m.put("designation", e.getDesignation());
        m.put("departmentId", e.getDepartmentId() == null ? null : e.getDepartmentId().toString());
        m.put("teamId", e.getTeamId() == null ? null : e.getTeamId().toString());
        m.put("employmentStatus", e.getEmploymentStatus().name());
        m.put("roleProfile", e.getRoleProfile());
        return m;
    }

    public EmployeeResponse toResponse(Employee e) {
        return toResponses(new org.springframework.data.domain.PageImpl<>(List.of(e))).getContent().get(0);
    }

    public Page<EmployeeResponse> toResponses(Page<Employee> page) {
        List<Employee> employees = page.getContent();
        if (employees.isEmpty()) {
            return page.map(x -> null);
        }
        UUID organizationId = employees.get(0).getOrganizationId();
        Map<UUID, Department> departments = departmentRepository.findByOrganizationIdOrderByNameAsc(organizationId).stream()
                .collect(Collectors.toMap(Department::getId, Function.identity()));
        Map<UUID, Team> teams = teamRepository.findByOrganizationIdOrderByNameAsc(organizationId).stream()
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        Map<UUID, Shift> shifts = shiftRepository.findByOrganizationIdOrderByNameAsc(organizationId).stream()
                .collect(Collectors.toMap(Shift::getId, Function.identity()));
        Set<UUID> ids = employees.stream().map(Employee::getId).collect(Collectors.toSet());
        Map<UUID, Long> deviceCounts = deviceRepository.findByOrganizationIdAndEmployeeIdIn(organizationId, ids).stream()
                .collect(Collectors.groupingBy(d -> d.getEmployeeId(), Collectors.counting()));
        Map<UUID, LiveStatus> statuses = liveStatusRepository.findByOrganizationIdAndEmployeeIdIn(organizationId, ids).stream()
                .collect(Collectors.toMap(LiveStatus::getEmployeeId, Function.identity()));
        Map<UUID, UUID> managerIds = new HashMap<>();
        for (Employee e : employees) {
            managerAssignmentRepository.findFirstByEmployeeIdAndEffectiveToIsNullOrderByEffectiveFromDesc(e.getId())
                    .ifPresent(a -> managerIds.put(e.getId(), a.getManagerEmployeeId()));
        }
        Map<UUID, Employee> managers = managerIds.isEmpty() ? Map.of()
                : employeeRepository.findByOrganizationIdAndIdIn(organizationId, managerIds.values()).stream()
                .collect(Collectors.toMap(Employee::getId, Function.identity()));
        return page.map(e -> {
            Department d = e.getDepartmentId() == null ? null : departments.get(e.getDepartmentId());
            Team t = e.getTeamId() == null ? null : teams.get(e.getTeamId());
            Shift s = e.getShiftId() == null ? null : shifts.get(e.getShiftId());
            UUID managerId = managerIds.get(e.getId());
            Employee manager = managerId == null ? null : managers.get(managerId);
            LiveStatus live = statuses.get(e.getId());
            return new EmployeeResponse(e.getId(), e.getEmployeeCode(), e.getFirstName(), e.getLastName(), e.getFullName(),
                    e.getWorkEmail(), e.getDesignation(), e.getDepartmentId(), d == null ? null : d.getName(),
                    e.getTeamId(), t == null ? null : t.getName(), managerId, manager == null ? null : manager.getFullName(),
                    e.getShiftId(), s == null ? null : s.getName(), e.getJoiningDate(), e.getEmploymentStatus(), e.getRoleProfile(),
                    deviceCounts.getOrDefault(e.getId(), 0L), live == null ? "OFFLINE" : live.getStatus().name(),
                    userRepository.findByEmployeeId(e.getId()).isPresent());
        });
    }
}
