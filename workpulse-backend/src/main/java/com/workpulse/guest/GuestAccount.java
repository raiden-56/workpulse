package com.workpulse.guest;

import com.workpulse.common.entity.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Invited, time-boxed external stakeholder (consultant, auditor, client reviewer). */
@Entity
@Table(name = "guest_accounts")
@Getter
@Setter
public class GuestAccount extends TenantEntity {

    @Column(nullable = false)
    private String email;

    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(name = "guest_type", nullable = false, length = 20)
    private String guestType = "AUTHORIZED";

    @Column(name = "invited_by")
    private UUID invitedBy;

    @Column(name = "invitation_hash", length = 64)
    private String invitationHash;

    @Column(nullable = false, length = 20)
    private String status = "INVITED";

    @Column(name = "scope_type", nullable = false, length = 20)
    private String scopeType = "ORGANIZATION";

    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(name = "can_export", nullable = false)
    private boolean canExport = false;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "user_id")
    private UUID userId;
}
