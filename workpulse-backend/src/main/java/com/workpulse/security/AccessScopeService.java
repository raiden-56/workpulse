package com.workpulse.security;

import com.workpulse.employees.EmployeeRepository;
import com.workpulse.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Translates a principal's {@link AccessScope} into the concrete set of employee ids it may see.
 * {@link Optional#empty()} means "every employee in the organisation" (ORGANIZATION / GLOBAL scope).
 */
@Service
@RequiredArgsConstructor
public class AccessScopeService {

    private final EmployeeRepository employeeRepository;

    public Optional<Set<UUID>> visibleEmployeeIds(UserPrincipal principal) {
        AccessScope scope = principal.getScope();
        if (scope == null || scope.isWide()) {
            return Optional.empty();
        }
        UUID organizationId = TenantContext.require();
        Set<UUID> ids = new HashSet<>();
        if (scope.level() == ScopeLevel.SELF) {
            if (principal.getEmployeeId() != null) {
                ids.add(principal.getEmployeeId());
            }
            return Optional.of(ids);
        }
        List<UUID> inScope = employeeRepository.findIdsInScope(organizationId,
                scope.departmentIds().isEmpty() ? List.of(new UUID(0, 0)) : scope.departmentIds(),
                scope.teamIds().isEmpty() ? List.of(new UUID(0, 0)) : scope.teamIds());
        ids.addAll(inScope);
        if (principal.getEmployeeId() != null) {
            ids.add(principal.getEmployeeId());
        }
        return Optional.of(ids);
    }

    public boolean canView(UserPrincipal principal, UUID employeeId) {
        if (employeeId == null) {
            return false;
        }
        if (employeeId.equals(principal.getEmployeeId())) {
            return true;
        }
        return visibleEmployeeIds(principal).map(ids -> ids.contains(employeeId)).orElse(true);
    }

    /** Throws NOT_FOUND (never FORBIDDEN) so that out-of-scope records do not leak their existence. */
    public void assertCanView(UserPrincipal principal, UUID employeeId) {
        if (!canView(principal, employeeId)) {
            throw ApiException.notFound("Employee", employeeId);
        }
    }
}
