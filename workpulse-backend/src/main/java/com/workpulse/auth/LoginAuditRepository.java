package com.workpulse.auth;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LoginAuditRepository extends JpaRepository<LoginAudit, UUID> {

    Page<LoginAudit> findByUserIdOrderByOccurredAtDesc(UUID userId, Pageable pageable);
}
