package com.workpulse.employees;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ManagerAssignmentRepository extends JpaRepository<ManagerAssignment, UUID> {

    Optional<ManagerAssignment> findFirstByEmployeeIdAndEffectiveToIsNullOrderByEffectiveFromDesc(UUID employeeId);

    List<ManagerAssignment> findByManagerEmployeeIdAndEffectiveToIsNull(UUID managerEmployeeId);
}
