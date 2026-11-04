package com.workpulse.policies;

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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "monitoring_policies")
@Getter
@Setter
public class MonitoringPolicy extends TenantEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PolicyLevel level = PolicyLevel.ORGANIZATION;

    /** Department, team or employee id depending on {@link #level}; null for organisation level. */
    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "is_default", nullable = false)
    private boolean defaultPolicy = false;

    /** e.g. {"monday": {"from": "09:00", "to": "18:00"}, ...} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "working_hours", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> workingHours = new HashMap<>();

    /** [{"days": [1,2,3,4,5], "from": "08:00", "to": "20:00", "tz": "Asia/Kolkata"}] */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "collection_windows", columnDefinition = "jsonb", nullable = false)
    private List<Map<String, Object>> collectionWindows = new ArrayList<>();

    @Column(name = "idle_threshold_seconds", nullable = false)
    private int idleThresholdSeconds = 300;

    @Column(name = "sampling_interval_seconds", nullable = false)
    private int samplingIntervalSeconds = 10;

    @Column(name = "collect_window_titles", nullable = false)
    private boolean collectWindowTitles = false;

    @Column(name = "collect_input_summary", nullable = false)
    private boolean collectInputSummary = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sensitive_app_exclusions", columnDefinition = "jsonb", nullable = false)
    private List<String> sensitiveAppExclusions = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data_categories", columnDefinition = "jsonb", nullable = false)
    private List<String> dataCategories = new ArrayList<>();

    @Column(name = "retention_days", nullable = false)
    private int retentionDays = 180;

    @Column(name = "employee_notice", columnDefinition = "text")
    private String employeeNotice;

    @Column(name = "min_agent_version", length = 32)
    private String minAgentVersion;

    @Column(nullable = false)
    private int version = 1;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
}
