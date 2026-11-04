package com.workpulse.users;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    Page<User> findByOrganizationId(UUID organizationId, Pageable pageable);

    Optional<User> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<User> findByEmployeeId(UUID employeeId);

    long countByOrganizationId(UUID organizationId);
}
