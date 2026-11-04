package com.workpulse.guest;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GuestAccountRepository extends JpaRepository<GuestAccount, UUID> {

    Page<GuestAccount> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId, Pageable pageable);

    Optional<GuestAccount> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<GuestAccount> findByInvitationHash(String invitationHash);
}
