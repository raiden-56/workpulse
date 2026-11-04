package com.workpulse.activity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeSessionRepository extends JpaRepository<EmployeeSession, UUID> {

    Optional<EmployeeSession> findByDeviceIdAndAgentSessionId(UUID deviceId, UUID agentSessionId);

    Optional<EmployeeSession> findFirstByDeviceIdAndEndedAtIsNullOrderByStartedAtDesc(UUID deviceId);

    List<EmployeeSession> findByOrganizationIdAndEmployeeIdAndStartedAtBetweenOrderByStartedAtAsc(
            UUID organizationId, UUID employeeId, Instant from, Instant to);

    @Query("select count(distinct s.employeeId) from EmployeeSession s where s.organizationId = :org and s.startedAt < :to and (s.endedAt is null or s.endedAt > :from)")
    long countDistinctEmployeesActiveBetween(@Param("org") UUID organizationId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("select count(distinct s.employeeId) from EmployeeSession s where s.organizationId = :org and s.employeeId in :ids and s.startedAt < :to and (s.endedAt is null or s.endedAt > :from)")
    long countDistinctEmployeesActiveBetweenIn(@Param("org") UUID organizationId, @Param("ids") Collection<UUID> employeeIds,
                                               @Param("from") Instant from, @Param("to") Instant to);
}
