package com.workpulse.devices;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    Optional<DeviceToken> findByTokenHashAndRevokedAtIsNull(String tokenHash);

    @Modifying
    @Query("update DeviceToken t set t.revokedAt = :now where t.device.id = :deviceId and t.revokedAt is null")
    int revokeAllForDevice(@Param("deviceId") UUID deviceId, @Param("now") Instant now);
}
