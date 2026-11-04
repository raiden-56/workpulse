package com.workpulse.devices;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRepository extends JpaRepository<Device, UUID>, JpaSpecificationExecutor<Device> {

    Optional<Device> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Device> findByOrganizationIdAndMachineId(UUID organizationId, String machineId);

    List<Device> findByOrganizationIdAndEmployeeId(UUID organizationId, UUID employeeId);

    List<Device> findByOrganizationIdAndEmployeeIdIn(UUID organizationId, Collection<UUID> employeeIds);

    long countByOrganizationId(UUID organizationId);

    long countByOrganizationIdAndStatus(UUID organizationId, DeviceStatus status);

    long countByOrganizationIdAndStatusAndHealth(UUID organizationId, DeviceStatus status, DeviceHealth health);

    long countByOrganizationIdAndStatusAndLastSeenAtAfter(UUID organizationId, DeviceStatus status, Instant after);

    @Modifying
    @Query("update Device d set d.health = :health where d.status = :status and d.health <> :health and (d.lastSeenAt is null or d.lastSeenAt < :cutoff)")
    int markStaleDevices(@Param("status") DeviceStatus status, @Param("cutoff") Instant cutoff, @Param("health") DeviceHealth health);
}
