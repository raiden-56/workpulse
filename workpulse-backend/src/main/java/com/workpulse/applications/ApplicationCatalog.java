package com.workpulse.applications;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Global application catalogue shared by all organisations. */
@Entity
@Table(name = "application_catalog")
@Getter
@Setter
public class ApplicationCatalog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "process_name", nullable = false, unique = true, length = 120)
    private String processName;

    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(length = 120)
    private String vendor;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_category", nullable = false, length = 30)
    private ApplicationCategory defaultCategory = ApplicationCategory.NEUTRAL;

    @Column(name = "icon_key", length = 60)
    private String iconKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
