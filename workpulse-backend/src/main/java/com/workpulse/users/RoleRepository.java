package com.workpulse.users;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    @EntityGraph(attributePaths = "permissions")
    Optional<Role> findByCode(String code);

    @EntityGraph(attributePaths = "permissions")
    List<Role> findByCodeIn(Collection<String> codes);

    @EntityGraph(attributePaths = "permissions")
    List<Role> findAllByOrderByCodeAsc();
}
