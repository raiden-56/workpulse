package com.workpulse.policies;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MonitoringPolicyRepository extends JpaRepository<MonitoringPolicy, UUID> {

    List<MonitoringPolicy> findByOrganizationIdOrderByLevelAscNameAsc(UUID organizationId);

    Optional<MonitoringPolicy> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<MonitoringPolicy> findFirstByOrganizationIdAndDefaultPolicyTrue(UUID organizationId);

    Optional<MonitoringPolicy> findFirstByOrganizationIdAndLevelAndTargetIdAndStatus(UUID organizationId, PolicyLevel level, UUID targetId, String status);
}
