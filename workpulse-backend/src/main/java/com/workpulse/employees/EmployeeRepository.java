package com.workpulse.employees;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeRepository extends JpaRepository<Employee, UUID>, JpaSpecificationExecutor<Employee> {

    Optional<Employee> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Employee> findByOrganizationIdAndWorkEmailIgnoreCase(UUID organizationId, String workEmail);

    boolean existsByOrganizationIdAndEmployeeCode(UUID organizationId, String employeeCode);

    boolean existsByOrganizationIdAndWorkEmailIgnoreCase(UUID organizationId, String workEmail);

    List<Employee> findByOrganizationIdAndIdIn(UUID organizationId, Collection<UUID> ids);

    List<Employee> findByOrganizationId(UUID organizationId);

    long countByOrganizationId(UUID organizationId);

    long countByOrganizationIdAndEmploymentStatus(UUID organizationId, EmploymentStatus status);

    long countByOrganizationIdAndDepartmentId(UUID organizationId, UUID departmentId);

    long countByOrganizationIdAndTeamId(UUID organizationId, UUID teamId);

    @Query("select e.id from Employee e where e.organizationId = :org and (e.departmentId in :departmentIds or e.teamId in :teamIds)")
    List<UUID> findIdsInScope(@Param("org") UUID organizationId,
                              @Param("departmentIds") Collection<UUID> departmentIds,
                              @Param("teamIds") Collection<UUID> teamIds);
}
