package com.workpulse.activity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LiveStatusRepository extends JpaRepository<LiveStatus, UUID> {

    List<LiveStatus> findByOrganizationId(UUID organizationId);

    List<LiveStatus> findByOrganizationIdAndEmployeeIdIn(UUID organizationId, Collection<UUID> employeeIds);

    long countByOrganizationIdAndStatus(UUID organizationId, ActivityState status);

    @Query("select s.status, count(s) from LiveStatus s where s.organizationId = :org group by s.status")
    List<Object[]> countByStatus(@Param("org") UUID organizationId);

    @Query("select s.status, count(s) from LiveStatus s where s.organizationId = :org and s.employeeId in :ids group by s.status")
    List<Object[]> countByStatusForEmployees(@Param("org") UUID organizationId, @Param("ids") Collection<UUID> employeeIds);

    @Modifying
    @Query("update LiveStatus s set s.status = 'OFFLINE', s.reason = 'No agent events received recently', s.sinceAt = :now, s.updatedAt = :now "
            + "where s.status <> 'OFFLINE' and (s.lastEventAt is null or s.lastEventAt < :cutoff)")
    int markOffline(@Param("cutoff") Instant cutoff, @Param("now") Instant now);
}
