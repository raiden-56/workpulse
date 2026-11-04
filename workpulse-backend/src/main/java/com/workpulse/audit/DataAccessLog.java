package com.workpulse.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Records who looked at which employee's data. */
@Entity
@Table(name = "data_access_logs")
@Getter
@Setter
public class DataAccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Column(name = "actor_type", nullable = false, length = 20)
    private String actorType = "USER";

    @Column(name = "subject_employee_id")
    private UUID subjectEmployeeId;

    @Column(nullable = false, length = 40)
    private String resource;

    @Column(nullable = false, length = 20)
    private String action;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> detail = new HashMap<>();

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();
}
