package com.workpulse.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Current state of one employee, maintained from incoming agent events. */
@Entity
@Table(name = "live_status")
@Getter
@Setter
public class LiveStatus {

    @Id
    @Column(name = "employee_id")
    private UUID employeeId;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ActivityState status = ActivityState.OFFLINE;

    @Column(name = "foreground_process", length = 120)
    private String foregroundProcess;

    @Column(name = "foreground_app", length = 160)
    private String foregroundApp;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "since_at")
    private Instant sinceAt;

    @Column(name = "session_started_at")
    private Instant sessionStartedAt;

    @Column(name = "last_event_at")
    private Instant lastEventAt;

    @Column(length = 255)
    private String reason;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
