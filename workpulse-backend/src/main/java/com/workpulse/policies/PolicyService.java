package com.workpulse.policies;

import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;
import com.workpulse.policies.dto.PolicyDtos.PolicyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PolicyService {

    private final MonitoringPolicyRepository policyRepository;
    private final EmployeePolicyAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;

    @Transactional(readOnly = true)
    public List<PolicyResponse> list(UUID organizationId) {
        return policyRepository.findByOrganizationIdOrderByLevelAscNameAsc(organizationId).stream().map(PolicyResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PolicyResponse get(UUID organizationId, UUID id) {
        return policyRepository.findByIdAndOrganizationId(id, organizationId).map(PolicyResponse::from)
                .orElseThrow(() -> ApiException.notFound("Policy", id));
    }

    /**
     * Resolution order: explicit employee assignment → EMPLOYEE-level policy → TEAM → DEPARTMENT →
     * organisation default → built-in least-intrusive fallback.
     */
    @Transactional(readOnly = true)
    public EffectivePolicyResponse effectiveFor(UUID organizationId, UUID employeeId) {
        Employee employee = employeeId == null ? null
                : employeeRepository.findByIdAndOrganizationId(employeeId, organizationId).orElse(null);
        if (employee != null) {
            Optional<EmployeePolicyAssignment> assignment =
                    assignmentRepository.findFirstByEmployeeIdAndEffectiveToIsNullOrderByAssignedAtDesc(employee.getId());
            if (assignment.isPresent()) {
                Optional<MonitoringPolicy> p = policyRepository.findByIdAndOrganizationId(assignment.get().getPolicyId(), organizationId)
                        .filter(x -> "ACTIVE".equals(x.getStatus()));
                if (p.isPresent()) {
                    return EffectivePolicyResponse.from(p.get(), "ASSIGNMENT");
                }
            }
            Optional<MonitoringPolicy> byEmployee = policyRepository
                    .findFirstByOrganizationIdAndLevelAndTargetIdAndStatus(organizationId, PolicyLevel.EMPLOYEE, employee.getId(), "ACTIVE");
            if (byEmployee.isPresent()) {
                return EffectivePolicyResponse.from(byEmployee.get(), "EMPLOYEE");
            }
            if (employee.getTeamId() != null) {
                Optional<MonitoringPolicy> byTeam = policyRepository
                        .findFirstByOrganizationIdAndLevelAndTargetIdAndStatus(organizationId, PolicyLevel.TEAM, employee.getTeamId(), "ACTIVE");
                if (byTeam.isPresent()) {
                    return EffectivePolicyResponse.from(byTeam.get(), "TEAM");
                }
            }
            if (employee.getDepartmentId() != null) {
                Optional<MonitoringPolicy> byDept = policyRepository
                        .findFirstByOrganizationIdAndLevelAndTargetIdAndStatus(organizationId, PolicyLevel.DEPARTMENT, employee.getDepartmentId(), "ACTIVE");
                if (byDept.isPresent()) {
                    return EffectivePolicyResponse.from(byDept.get(), "DEPARTMENT");
                }
            }
        }
        return policyRepository.findFirstByOrganizationIdAndDefaultPolicyTrue(organizationId)
                .map(p -> EffectivePolicyResponse.from(p, "ORGANIZATION"))
                .orElseGet(PolicyService::builtInFallback);
    }

    private static EffectivePolicyResponse builtInFallback() {
        return new EffectivePolicyResponse(null, "Built-in least-intrusive policy", 0, "BUILT_IN", 10, 300,
                Map.of("from", "09:00", "to", "18:00", "days", List.of(1, 2, 3, 4, 5)),
                List.of(Map.of("days", List.of(1, 2, 3, 4, 5), "from", "08:00", "to", "20:00", "tz", "UTC")),
                false, false, List.of(), List.of("FOREGROUND_APPLICATION", "IDLE_TIME", "SESSION_STATE"),
                "Application usage and idle time are recorded during working hours.", 90, "1.0.0");
    }
}
