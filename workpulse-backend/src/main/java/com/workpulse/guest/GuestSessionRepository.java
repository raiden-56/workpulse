package com.workpulse.guest;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.UUID;

public interface GuestSessionRepository extends JpaRepository<GuestSession, UUID> {

    long countByOrganizationIdAndStartedAtAfter(UUID organizationId, Instant after);
}
