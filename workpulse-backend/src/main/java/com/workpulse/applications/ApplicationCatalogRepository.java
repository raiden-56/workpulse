package com.workpulse.applications;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationCatalogRepository extends JpaRepository<ApplicationCatalog, UUID> {

    Optional<ApplicationCatalog> findByProcessNameIgnoreCase(String processName);

    List<ApplicationCatalog> findByProcessNameIn(Collection<String> processNames);

    List<ApplicationCatalog> findAllByOrderByDisplayNameAsc();
}
