package com.workpulse.policies;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EmployeePolicyAssignmentRepository extends JpaRepository<EmployeePolicyAssignment, UUID> {

    Optional<EmployeePolicyAssignment> findFirstByEmployeeIdAndEffectiveToIsNullOrderByAssignedAtDesc(UUID employeeId);
}
