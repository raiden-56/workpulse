package com.workpulse.audit;

import com.workpulse.security.DevicePrincipal;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;
import java.util.UUID;

/**
 * Writes audit and data-access records. Uses REQUIRES_NEW so that an audit row survives even if the
 * surrounding business transaction is rolled back after the fact was observed (e.g. failed logins).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final DataAccessLogRepository dataAccessLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String entityType, UUID entityId, Map<String, Object> before, Map<String, Object> after) {
        AuditLog entry = new AuditLog();
        entry.setOrganizationId(TenantContext.getOrNull());
        SecurityUtils.currentUser().ifPresentOrElse(user -> {
            entry.setActorUserId(user.getUserId());
            entry.setActorType(user.isGuest() ? "GUEST" : "USER");
            entry.setActorLabel(user.getEmail());
            if (entry.getOrganizationId() == null) {
                entry.setOrganizationId(user.getOrganizationId());
            }
        }, () -> SecurityUtils.currentDevice().ifPresentOrElse(device -> {
            entry.setActorType("DEVICE");
            entry.setActorLabel(device.hostname());
            entry.setOrganizationId(device.organizationId());
        }, () -> entry.setActorType("SYSTEM")));
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setBeforeState(before);
        entry.setAfterState(after);
        HttpServletRequest request = currentRequest();
        if (request != null) {
            entry.setIpAddress(clientIp(request));
            entry.setUserAgent(trim(request.getHeader("User-Agent"), 255));
        }
        auditLogRepository.save(entry);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSystem(UUID organizationId, String action, String entityType, UUID entityId, Map<String, Object> after) {
        AuditLog entry = new AuditLog();
        entry.setOrganizationId(organizationId);
        entry.setActorType("SYSTEM");
        entry.setActorLabel("system");
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setAfterState(after);
        auditLogRepository.save(entry);
    }

    /** Logs that the current principal read data about {@code subjectEmployeeId}. Self-reads are not logged. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordDataAccess(String resource, String action, UUID subjectEmployeeId, Map<String, Object> detail) {
        UserPrincipal user = SecurityUtils.currentUser().orElse(null);
        if (user == null || (subjectEmployeeId != null && subjectEmployeeId.equals(user.getEmployeeId()))) {
            return;
        }
        DataAccessLog entry = new DataAccessLog();
        entry.setOrganizationId(TenantContext.getOrNull() != null ? TenantContext.getOrNull() : user.getOrganizationId());
        entry.setActorUserId(user.getUserId());
        entry.setActorType(user.isGuest() ? "GUEST" : "USER");
        entry.setSubjectEmployeeId(subjectEmployeeId);
        entry.setResource(resource);
        entry.setAction(action);
        entry.setDetail(detail == null ? Map.of() : detail);
        dataAccessLogRepository.save(entry);
    }

    public static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return trim(forwarded.split(",")[0].trim(), 64);
        }
        return trim(request.getRemoteAddr(), 64);
    }

    public static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest();
        }
        return null;
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    @SuppressWarnings("unused")
    private static String describe(DevicePrincipal device) {
        return device.hostname();
    }
}
