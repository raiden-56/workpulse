-- WorkPulse baseline schema. All timestamps are timestamptz (UTC).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- Identity and tenancy
-- =====================================================================
CREATE TABLE organizations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(160) NOT NULL,
    slug            varchar(64)  NOT NULL UNIQUE,
    code            varchar(32),
    timezone        varchar(64)  NOT NULL DEFAULT 'UTC',
    status          varchar(20)  NOT NULL DEFAULT 'ACTIVE',
    is_demo         boolean      NOT NULL DEFAULT false,
    settings        jsonb        NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid
);

CREATE TABLE roles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(40)  NOT NULL UNIQUE,
    name            varchar(80)  NOT NULL,
    description     varchar(255),
    scope_level     varchar(20)  NOT NULL,
    is_system       boolean      NOT NULL DEFAULT true,
    created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(64)  NOT NULL UNIQUE,
    resource        varchar(40)  NOT NULL,
    action          varchar(20)  NOT NULL,
    description     varchar(255)
);

CREATE TABLE role_permissions (
    role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id),
    email           varchar(255) NOT NULL UNIQUE,
    password_hash   varchar(100),
    display_name    varchar(160) NOT NULL,
    status          varchar(20)  NOT NULL DEFAULT 'INVITED',
    mfa_enabled     boolean      NOT NULL DEFAULT false,
    mfa_secret_enc  varchar(255),
    employee_id     uuid,
    last_login_at   timestamptz,
    password_changed_at timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid
);
CREATE INDEX ix_users_org ON users(organization_id);

CREATE TABLE departments (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations(id),
    name             varchar(120) NOT NULL,
    code             varchar(32),
    parent_id        uuid REFERENCES departments(id),
    head_employee_id uuid,
    status           varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    UNIQUE (organization_id, name)
);
CREATE INDEX ix_departments_org ON departments(organization_id);

CREATE TABLE teams (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations(id),
    department_id    uuid NOT NULL REFERENCES departments(id),
    name             varchar(120) NOT NULL,
    code             varchar(32),
    lead_employee_id uuid,
    status           varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    UNIQUE (organization_id, department_id, name)
);
CREATE INDEX ix_teams_org ON teams(organization_id);
CREATE INDEX ix_teams_department ON teams(department_id);

CREATE TABLE shifts (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        uuid NOT NULL REFERENCES organizations(id),
    name                   varchar(80) NOT NULL,
    start_time             time NOT NULL,
    end_time               time NOT NULL,
    timezone               varchar(64) NOT NULL DEFAULT 'UTC',
    working_days           jsonb NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
    grace_minutes          int NOT NULL DEFAULT 10,
    break_minutes          int NOT NULL DEFAULT 60,
    overtime_after_minutes int NOT NULL DEFAULT 540,
    is_default             boolean NOT NULL DEFAULT false,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    created_by             uuid,
    updated_by             uuid,
    UNIQUE (organization_id, name)
);

CREATE TABLE employees (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations(id),
    employee_code     varchar(40) NOT NULL,
    first_name        varchar(80) NOT NULL,
    last_name         varchar(80) NOT NULL,
    work_email        varchar(255) NOT NULL,
    designation       varchar(120),
    department_id     uuid REFERENCES departments(id),
    team_id           uuid REFERENCES teams(id),
    shift_id          uuid REFERENCES shifts(id),
    joining_date      date,
    employment_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    role_profile      varchar(40) NOT NULL DEFAULT 'GENERAL',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid,
    updated_by        uuid,
    UNIQUE (organization_id, employee_code),
    UNIQUE (organization_id, work_email)
);
CREATE INDEX ix_employees_org_department ON employees(organization_id, department_id);
CREATE INDEX ix_employees_org_team ON employees(organization_id, team_id);
CREATE INDEX ix_employees_name_trgm ON employees USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

ALTER TABLE users ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE departments ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_employee_id) REFERENCES employees(id);
ALTER TABLE teams ADD CONSTRAINT fk_teams_lead FOREIGN KEY (lead_employee_id) REFERENCES employees(id);

CREATE TABLE user_roles (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id       uuid NOT NULL REFERENCES roles(id),
    department_id uuid REFERENCES departments(id),
    team_id       uuid REFERENCES teams(id),
    granted_by    uuid,
    granted_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role_id, department_id, team_id)
);
CREATE INDEX ix_user_roles_user ON user_roles(user_id);

CREATE TABLE manager_assignments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id),
    employee_id         uuid NOT NULL REFERENCES employees(id),
    manager_employee_id uuid NOT NULL REFERENCES employees(id),
    assignment_type     varchar(20) NOT NULL DEFAULT 'LINE',
    effective_from      date NOT NULL DEFAULT CURRENT_DATE,
    effective_to        date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid
);
CREATE INDEX ix_manager_assignments_employee ON manager_assignments(employee_id);
CREATE INDEX ix_manager_assignments_manager ON manager_assignments(manager_employee_id);

CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  varchar(64) NOT NULL UNIQUE,
    family_id   uuid NOT NULL,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    replaced_by uuid,
    user_agent  varchar(255),
    ip_address  varchar(64),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE password_reset_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  varchar(64) NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_audit (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    organization_id uuid,
    email           varchar(255) NOT NULL,
    outcome         varchar(30) NOT NULL,
    ip_address      varchar(64),
    user_agent      varchar(255),
    occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_login_audit_user ON login_audit(user_id, occurred_at DESC);

-- =====================================================================
-- Devices and agents
-- =====================================================================
CREATE TABLE agent_versions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version       varchar(32) NOT NULL UNIQUE,
    channel       varchar(20) NOT NULL DEFAULT 'STABLE',
    release_notes text,
    download_url  varchar(500),
    sha256        varchar(64),
    is_mandatory  boolean NOT NULL DEFAULT false,
    released_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    employee_id     uuid REFERENCES employees(id),
    hostname        varchar(120) NOT NULL,
    machine_id      varchar(128) NOT NULL,
    os_name         varchar(80),
    os_version      varchar(80),
    agent_version   varchar(32),
    status          varchar(20) NOT NULL DEFAULT 'PENDING',
    health          varchar(20) NOT NULL DEFAULT 'UNKNOWN',
    last_seen_at    timestamptz,
    last_sync_at    timestamptz,
    registered_at   timestamptz NOT NULL DEFAULT now(),
    approved_by     uuid,
    approved_at     timestamptz,
    revoked_by      uuid,
    revoked_at      timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid,
    UNIQUE (organization_id, machine_id)
);
CREATE INDEX ix_devices_org_status ON devices(organization_id, status);
CREATE INDEX ix_devices_employee ON devices(employee_id);

CREATE TABLE device_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash  varchar(64) NOT NULL UNIQUE,
    issued_at   timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz,
    revoked_at  timestamptz,
    last_used_at timestamptz
);
CREATE INDEX ix_device_tokens_device ON device_tokens(device_id);

-- =====================================================================
-- Policies
-- =====================================================================
CREATE TABLE monitoring_policies (
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id            uuid NOT NULL REFERENCES organizations(id),
    name                       varchar(120) NOT NULL,
    level                      varchar(20) NOT NULL,
    target_id                  uuid,
    is_default                 boolean NOT NULL DEFAULT false,
    working_hours              jsonb NOT NULL DEFAULT '{}'::jsonb,
    collection_windows         jsonb NOT NULL DEFAULT '[]'::jsonb,
    idle_threshold_seconds     int NOT NULL DEFAULT 300,
    sampling_interval_seconds  int NOT NULL DEFAULT 10,
    collect_window_titles      boolean NOT NULL DEFAULT false,
    collect_input_summary      boolean NOT NULL DEFAULT true,
    sensitive_app_exclusions   jsonb NOT NULL DEFAULT '[]'::jsonb,
    data_categories            jsonb NOT NULL DEFAULT '[]'::jsonb,
    retention_days             int NOT NULL DEFAULT 180,
    employee_notice            text,
    min_agent_version          varchar(32),
    version                    int NOT NULL DEFAULT 1,
    status                     varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    created_by                 uuid,
    updated_by                 uuid,
    UNIQUE (organization_id, name)
);
CREATE INDEX ix_policies_org_level ON monitoring_policies(organization_id, level, target_id);

CREATE TABLE employee_policy_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    employee_id     uuid NOT NULL REFERENCES employees(id),
    policy_id       uuid NOT NULL REFERENCES monitoring_policies(id),
    assigned_by     uuid,
    assigned_at     timestamptz NOT NULL DEFAULT now(),
    effective_from  date NOT NULL DEFAULT CURRENT_DATE,
    effective_to    date
);
CREATE INDEX ix_policy_assignments_employee ON employee_policy_assignments(employee_id);

-- =====================================================================
-- Activity (high volume)
-- =====================================================================
CREATE TABLE activity_events (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    organization_id uuid NOT NULL,
    device_id       uuid NOT NULL,
    employee_id     uuid,
    event_id        uuid NOT NULL,
    event_type      varchar(40) NOT NULL,
    occurred_at     timestamptz NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now(),
    sequence        bigint,
    session_id      uuid,
    agent_version   varchar(32),
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, occurred_at),
    UNIQUE (device_id, event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX ix_activity_events_org_employee_time ON activity_events(organization_id, employee_id, occurred_at);
CREATE INDEX ix_activity_events_device_time ON activity_events(device_id, occurred_at);

CREATE TABLE application_catalog (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name     varchar(120) NOT NULL UNIQUE,
    display_name     varchar(160) NOT NULL,
    vendor           varchar(120),
    default_category varchar(30) NOT NULL DEFAULT 'NEUTRAL',
    icon_key         varchar(60),
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE application_classifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    application_id  uuid NOT NULL REFERENCES application_catalog(id),
    role_profile    varchar(40),
    category        varchar(30) NOT NULL,
    custom_label    varchar(80),
    policy_id       uuid REFERENCES monitoring_policies(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid,
    UNIQUE (organization_id, application_id, role_profile, policy_id)
);
CREATE INDEX ix_app_classifications_org ON application_classifications(organization_id);

CREATE TABLE application_usage (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    organization_id   uuid NOT NULL,
    employee_id       uuid NOT NULL,
    device_id         uuid NOT NULL,
    application_id    uuid,
    process_name      varchar(120) NOT NULL,
    started_at        timestamptz NOT NULL,
    ended_at          timestamptz NOT NULL,
    duration_seconds  int NOT NULL,
    window_title_hash varchar(64),
    PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);
CREATE INDEX ix_application_usage_org_employee ON application_usage(organization_id, employee_id, started_at);
CREATE INDEX ix_application_usage_org_app ON application_usage(organization_id, process_name, started_at);

-- Monthly partitions: previous month .. three months ahead, plus a default catch-all.
DO $$
DECLARE
    m date;
    start_month date := date_trunc('month', now())::date - interval '1 month';
    tbl text;
BEGIN
    FOR i IN 0..4 LOOP
        m := (start_month + (i || ' month')::interval)::date;
        FOREACH tbl IN ARRAY ARRAY['activity_events', 'application_usage'] LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                tbl || '_' || to_char(m, 'YYYYMM'), tbl, m, (m + interval '1 month')::date);
        END LOOP;
    END LOOP;
    EXECUTE 'CREATE TABLE IF NOT EXISTS activity_events_default PARTITION OF activity_events DEFAULT';
    EXECUTE 'CREATE TABLE IF NOT EXISTS application_usage_default PARTITION OF application_usage DEFAULT';
END $$;

CREATE TABLE employee_sessions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations(id),
    employee_id       uuid NOT NULL REFERENCES employees(id),
    device_id         uuid NOT NULL REFERENCES devices(id),
    agent_session_id  uuid,
    started_at        timestamptz NOT NULL,
    ended_at          timestamptz,
    end_reason        varchar(30),
    last_heartbeat_at timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_employee_sessions_employee_time ON employee_sessions(organization_id, employee_id, started_at DESC);
CREATE UNIQUE INDEX ux_employee_sessions_agent_session ON employee_sessions(device_id, agent_session_id) WHERE agent_session_id IS NOT NULL;

CREATE TABLE activity_intervals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    employee_id     uuid NOT NULL REFERENCES employees(id),
    session_id      uuid REFERENCES employee_sessions(id),
    started_at      timestamptz NOT NULL,
    ended_at        timestamptz NOT NULL,
    state           varchar(30) NOT NULL,
    application_id  uuid REFERENCES application_catalog(id),
    process_name    varchar(120),
    reason          varchar(255),
    confidence      numeric(4,3),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_activity_intervals_employee_time ON activity_intervals(organization_id, employee_id, started_at);

CREATE TABLE live_status (
    employee_id      uuid PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    organization_id  uuid NOT NULL REFERENCES organizations(id),
    status           varchar(30) NOT NULL DEFAULT 'OFFLINE',
    foreground_process varchar(120),
    foreground_app   varchar(160),
    device_id        uuid REFERENCES devices(id),
    session_id       uuid,
    since_at         timestamptz,
    session_started_at timestamptz,
    last_event_at    timestamptz,
    reason           varchar(255),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_live_status_org_status ON live_status(organization_id, status);

-- =====================================================================
-- Attendance
-- =====================================================================
CREATE TABLE attendance_records (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          uuid NOT NULL REFERENCES organizations(id),
    employee_id              uuid NOT NULL REFERENCES employees(id),
    work_date                date NOT NULL,
    shift_id                 uuid REFERENCES shifts(id),
    first_login_at           timestamptz,
    last_logout_at           timestamptz,
    total_session_seconds    int NOT NULL DEFAULT 0,
    active_seconds           int NOT NULL DEFAULT 0,
    idle_seconds             int NOT NULL DEFAULT 0,
    meeting_seconds          int NOT NULL DEFAULT 0,
    break_seconds            int NOT NULL DEFAULT 0,
    late_minutes             int NOT NULL DEFAULT 0,
    early_departure_minutes  int NOT NULL DEFAULT 0,
    overtime_minutes         int NOT NULL DEFAULT 0,
    status                   varchar(20) NOT NULL DEFAULT 'ABSENT',
    source                   varchar(20) NOT NULL DEFAULT 'AUTO',
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, employee_id, work_date)
);
CREATE INDEX ix_attendance_org_date ON attendance_records(organization_id, work_date);

CREATE TABLE breaks (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      uuid NOT NULL REFERENCES organizations(id),
    attendance_record_id uuid REFERENCES attendance_records(id) ON DELETE CASCADE,
    employee_id          uuid NOT NULL REFERENCES employees(id),
    started_at           timestamptz NOT NULL,
    ended_at             timestamptz,
    break_type           varchar(20) NOT NULL DEFAULT 'DECLARED',
    note                 varchar(255),
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_breaks_employee_time ON breaks(employee_id, started_at);

CREATE TABLE employee_correction_requests (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      uuid NOT NULL REFERENCES organizations(id),
    employee_id          uuid NOT NULL REFERENCES employees(id),
    request_type         varchar(20) NOT NULL,
    attendance_record_id uuid REFERENCES attendance_records(id),
    interval_id          uuid REFERENCES activity_intervals(id),
    requested_change     jsonb NOT NULL DEFAULT '{}'::jsonb,
    explanation          text NOT NULL,
    status               varchar(20) NOT NULL DEFAULT 'SUBMITTED',
    reviewed_by          uuid REFERENCES users(id),
    reviewed_at          timestamptz,
    reviewer_comment     text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_corrections_org_status ON employee_correction_requests(organization_id, status, created_at DESC);

-- =====================================================================
-- Anomalies and notifications
-- =====================================================================
CREATE TABLE anomaly_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    employee_id     uuid NOT NULL REFERENCES employees(id),
    device_id       uuid REFERENCES devices(id),
    rule_code       varchar(60) NOT NULL,
    category        varchar(40) NOT NULL,
    severity        varchar(10) NOT NULL,
    score           numeric(5,2) NOT NULL DEFAULT 0,
    confidence      numeric(4,3) NOT NULL DEFAULT 0,
    detected_at     timestamptz NOT NULL DEFAULT now(),
    window_start    timestamptz,
    window_end      timestamptz,
    evidence        jsonb NOT NULL DEFAULT '{}'::jsonb,
    status          varchar(20) NOT NULL DEFAULT 'NEW',
    assigned_to     uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_anomalies_org_status_time ON anomaly_events(organization_id, status, detected_at DESC);
CREATE INDEX ix_anomalies_employee ON anomaly_events(employee_id, detected_at DESC);

CREATE TABLE anomaly_reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anomaly_id  uuid NOT NULL REFERENCES anomaly_events(id) ON DELETE CASCADE,
    reviewer_id uuid NOT NULL REFERENCES users(id),
    action      varchar(30) NOT NULL,
    comment     text,
    from_status varchar(20),
    to_status   varchar(20),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid REFERENCES organizations(id),
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              varchar(40) NOT NULL,
    severity          varchar(10) NOT NULL DEFAULT 'LOW',
    title             varchar(160) NOT NULL,
    body              text,
    entity_type       varchar(40),
    entity_id         uuid,
    is_read           boolean NOT NULL DEFAULT false,
    read_at           timestamptz,
    assigned_to       uuid REFERENCES users(id),
    resolution_status varchar(20) NOT NULL DEFAULT 'OPEN',
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- =====================================================================
-- Privacy, guests, audit
-- =====================================================================
CREATE TABLE privacy_acknowledgements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    employee_id     uuid NOT NULL REFERENCES employees(id),
    policy_id       uuid NOT NULL REFERENCES monitoring_policies(id),
    policy_version  int NOT NULL,
    acknowledged_at timestamptz NOT NULL DEFAULT now(),
    ip_address      varchar(64),
    user_agent      varchar(255)
);
CREATE INDEX ix_privacy_ack_employee ON privacy_acknowledgements(employee_id);

CREATE TABLE data_deletion_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    employee_id     uuid NOT NULL REFERENCES employees(id),
    requested_by    uuid REFERENCES users(id),
    reason          text,
    status          varchar(20) NOT NULL DEFAULT 'PENDING',
    scheduled_for   timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guest_accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    email           varchar(255) NOT NULL,
    display_name    varchar(160) NOT NULL,
    guest_type      varchar(20) NOT NULL DEFAULT 'AUTHORIZED',
    invited_by      uuid REFERENCES users(id),
    invitation_hash varchar(64),
    status          varchar(20) NOT NULL DEFAULT 'INVITED',
    scope_type      varchar(20) NOT NULL DEFAULT 'ORGANIZATION',
    scope_id        uuid,
    can_export      boolean NOT NULL DEFAULT false,
    expires_at      timestamptz NOT NULL,
    activated_at    timestamptz,
    revoked_at      timestamptz,
    user_id         uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, email)
);

CREATE TABLE guest_permissions (
    guest_account_id uuid NOT NULL REFERENCES guest_accounts(id) ON DELETE CASCADE,
    permission_id    uuid NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (guest_account_id, permission_id)
);

CREATE TABLE guest_sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_account_id uuid REFERENCES guest_accounts(id) ON DELETE CASCADE,
    guest_type       varchar(20) NOT NULL,
    organization_id  uuid NOT NULL REFERENCES organizations(id),
    persona          varchar(30),
    started_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    ended_at         timestamptz,
    ip_address       varchar(64),
    user_agent       varchar(255)
);
CREATE INDEX ix_guest_sessions_org_started ON guest_sessions(organization_id, started_at DESC);

CREATE TABLE data_access_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid,
    actor_user_id       uuid,
    actor_type          varchar(20) NOT NULL DEFAULT 'USER',
    subject_employee_id uuid,
    resource            varchar(40) NOT NULL,
    action              varchar(20) NOT NULL,
    detail              jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_data_access_logs_org_time ON data_access_logs(organization_id, occurred_at DESC);
CREATE INDEX ix_data_access_logs_subject ON data_access_logs(subject_employee_id, occurred_at DESC);

CREATE TABLE audit_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid,
    actor_user_id   uuid,
    actor_type      varchar(20) NOT NULL DEFAULT 'USER',
    actor_label     varchar(255),
    action          varchar(60) NOT NULL,
    entity_type     varchar(40) NOT NULL,
    entity_id       uuid,
    before_state    jsonb,
    after_state     jsonb,
    ip_address      varchar(64),
    user_agent      varchar(255),
    occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_org_time ON audit_logs(organization_id, occurred_at DESC);
CREATE INDEX ix_audit_logs_entity ON audit_logs(entity_type, entity_id);
