package com.workpulse.devices;

import com.workpulse.common.entity.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "devices")
@Getter
@Setter
public class Device extends TenantEntity {

    @Column(name = "employee_id")
    private UUID employeeId;

    @Column(nullable = false, length = 120)
    private String hostname;

    @Column(name = "machine_id", nullable = false, length = 128)
    private String machineId;

    @Column(name = "os_name", length = 80)
    private String osName;

    @Column(name = "os_version", length = 80)
    private String osVersion;

    @Column(name = "agent_version", length = 32)
    private String agentVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeviceStatus status = DeviceStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeviceHealth health = DeviceHealth.UNKNOWN;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "registered_at", nullable = false)
    private Instant registeredAt = Instant.now();

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "revoked_by")
    private UUID revokedBy;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> metadata = new HashMap<>();
}
