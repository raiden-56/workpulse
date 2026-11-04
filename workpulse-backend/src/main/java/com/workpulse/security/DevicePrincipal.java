package com.workpulse.security;

import java.util.UUID;

/** Authenticated desktop agent (device token). */
public record DevicePrincipal(UUID deviceId, UUID organizationId, UUID employeeId, String hostname, UUID tokenId) {

    public static final String AUTHORITY = "DEVICE";
}
