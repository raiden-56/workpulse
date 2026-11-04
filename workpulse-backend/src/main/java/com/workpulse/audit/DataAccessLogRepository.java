package com.workpulse.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DataAccessLogRepository extends JpaRepository<DataAccessLog, UUID> {

    Page<DataAccessLog> findByOrganizationIdOrderByOccurredAtDesc(UUID organizationId, Pageable pageable);

    Page<DataAccessLog> findBySubjectEmployeeIdOrderByOccurredAtDesc(UUID subjectEmployeeId, Pageable pageable);
}
