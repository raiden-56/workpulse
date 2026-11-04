package com.workpulse.audit;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.security.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Audit", description = "Audit trail and data-access history")
public class AuditController {

    private final AuditLogRepository auditLogRepository;
    private final DataAccessLogRepository dataAccessLogRepository;

    @GetMapping("/audit-logs")
    @PreAuthorize("hasAuthority('AUDIT_LOG_VIEW')")
    @Operation(summary = "Search the audit trail of the current organisation")
    public ApiResponse<List<AuditLogResponse>> auditLogs(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID actorUserId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        UUID organizationId = TenantContext.require();
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
            if (to != null) predicates.add(cb.lessThan(root.get("occurredAt"), to));
            if (action != null && !action.isBlank()) predicates.add(cb.equal(root.get("action"), action.trim().toUpperCase()));
            if (entityType != null && !entityType.isBlank()) predicates.add(cb.equal(root.get("entityType"), entityType.trim().toUpperCase()));
            if (actorUserId != null) predicates.add(cb.equal(root.get("actorUserId"), actorUserId));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("actorLabel")), like), cb.like(cb.lower(root.get("action")), like),
                        cb.like(cb.lower(root.get("entityType")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<AuditLog> result = auditLogRepository.findAll(spec,
                PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "occurredAt")));
        return ApiResponse.page(result.map(AuditLogResponse::from));
    }

    @GetMapping("/data-access-logs")
    @PreAuthorize("hasAuthority('AUDIT_LOG_VIEW')")
    @Operation(summary = "Who accessed which employee's data")
    public ApiResponse<List<DataAccessLogResponse>> dataAccessLogs(
            @RequestParam(required = false) UUID employeeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        UUID organizationId = TenantContext.require();
        PageRequest pageable = PageRequest.of(page, Math.min(size, 200));
        Page<DataAccessLog> result = employeeId != null
                ? dataAccessLogRepository.findBySubjectEmployeeIdOrderByOccurredAtDesc(employeeId, pageable)
                : dataAccessLogRepository.findByOrganizationIdOrderByOccurredAtDesc(organizationId, pageable);
        return ApiResponse.page(result.map(DataAccessLogResponse::from));
    }

    public record AuditLogResponse(UUID id, UUID actorUserId, String actorType, String actorLabel, String action,
                                   String entityType, UUID entityId, java.util.Map<String, Object> before,
                                   java.util.Map<String, Object> after, String ipAddress, Instant occurredAt) {
        static AuditLogResponse from(AuditLog a) {
            return new AuditLogResponse(a.getId(), a.getActorUserId(), a.getActorType(), a.getActorLabel(), a.getAction(),
                    a.getEntityType(), a.getEntityId(), a.getBeforeState(), a.getAfterState(), a.getIpAddress(), a.getOccurredAt());
        }
    }

    public record DataAccessLogResponse(UUID id, UUID actorUserId, String actorType, UUID subjectEmployeeId, String resource,
                                        String action, java.util.Map<String, Object> detail, Instant occurredAt) {
        static DataAccessLogResponse from(DataAccessLog d) {
            return new DataAccessLogResponse(d.getId(), d.getActorUserId(), d.getActorType(), d.getSubjectEmployeeId(),
                    d.getResource(), d.getAction(), d.getDetail(), d.getOccurredAt());
        }
    }
}
