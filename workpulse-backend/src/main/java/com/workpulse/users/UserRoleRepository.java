package com.workpulse.users;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    @EntityGraph(attributePaths = {"role", "role.permissions"})
    List<UserRole> findByUserId(UUID userId);

    @Modifying
    void deleteByUserId(UUID userId);
}
