package com.workpulse.devices;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "agent_versions")
@Getter
@Setter
public class AgentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 32)
    private String version;

    @Column(nullable = false, length = 20)
    private String channel = "STABLE";

    @Column(name = "release_notes", columnDefinition = "text")
    private String releaseNotes;

    @Column(name = "download_url", length = 500)
    private String downloadUrl;

    @Column(length = 64)
    private String sha256;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory = false;

    @Column(name = "released_at", nullable = false)
    private Instant releasedAt = Instant.now();
}
