package com.workpulse.security;

import java.util.Set;
import java.util.UUID;

/**
 * The effective data scope of a principal: which employees it may see.
 */
public record AccessScope(ScopeLevel level, Set<UUID> departmentIds, Set<UUID> teamIds, UUID employeeId) {

    public static AccessScope global() {
        return new AccessScope(ScopeLevel.GLOBAL, Set.of(), Set.of(), null);
    }

    public static AccessScope organization() {
        return new AccessScope(ScopeLevel.ORGANIZATION, Set.of(), Set.of(), null);
    }

    public static AccessScope self(UUID employeeId) {
        return new AccessScope(ScopeLevel.SELF, Set.of(), Set.of(), employeeId);
    }

    public boolean isWide() {
        return level == ScopeLevel.GLOBAL || level == ScopeLevel.ORGANIZATION;
    }
}
