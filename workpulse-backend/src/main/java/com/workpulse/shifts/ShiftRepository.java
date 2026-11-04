package com.workpulse.shifts;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShiftRepository extends JpaRepository<Shift, UUID> {

    List<Shift> findByOrganizationIdOrderByNameAsc(UUID organizationId);

    Optional<Shift> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Shift> findFirstByOrganizationIdAndDefaultShiftTrue(UUID organizationId);
}
