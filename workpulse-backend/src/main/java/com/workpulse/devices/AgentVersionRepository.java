package com.workpulse.devices;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AgentVersionRepository extends JpaRepository<AgentVersion, UUID> {

    Optional<AgentVersion> findFirstByChannelOrderByReleasedAtDesc(String channel);

    Optional<AgentVersion> findByVersion(String version);
}
