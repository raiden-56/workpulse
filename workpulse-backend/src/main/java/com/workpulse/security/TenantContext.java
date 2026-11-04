package com.workpulse.security;

import com.workpulse.exception.ApiException;

import java.util.UUID;

/**
 * Request-scoped organisation context. Set by the authentication filters, cleared at the end
 * of the request. Super admins select an organisation with the {@code X-Organization-Id} header.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(UUID organizationId) {
        CURRENT.set(organizationId);
    }

    public static UUID getOrNull() {
        return CURRENT.get();
    }

    public static UUID require() {
        UUID id = CURRENT.get();
        if (id == null) {
            throw ApiException.badRequest("Organization context is required (X-Organization-Id header for super admins)");
        }
        return id;
    }

    public static void clear() {
        CURRENT.remove();
    }
}
