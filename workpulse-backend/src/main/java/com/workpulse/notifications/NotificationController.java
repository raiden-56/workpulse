package com.workpulse.notifications;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.exception.ApiException;
import com.workpulse.security.SecurityUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications")
public class NotificationController {

    private final NotificationRepository repository;

    public record NotificationResponse(UUID id, String type, String severity, String title, String body, String entityType,
                                       UUID entityId, boolean read, Instant readAt, String resolutionStatus, Instant createdAt) {
        static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getSeverity(), n.getTitle(), n.getBody(), n.getEntityType(),
                    n.getEntityId(), n.isRead(), n.getReadAt(), n.getResolutionStatus(), n.getCreatedAt());
        }
    }

    @GetMapping
    @PreAuthorize("hasAuthority('NOTIFICATION_VIEW')")
    public ApiResponse<List<NotificationResponse>> list(@RequestParam(defaultValue = "false") boolean unreadOnly,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "20") int size) {
        UUID userId = SecurityUtils.requireUser().getUserId();
        PageRequest pageable = PageRequest.of(page, Math.min(size, 100));
        return ApiResponse.page((unreadOnly ? repository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId, pageable)
                : repository.findByUserIdOrderByCreatedAtDesc(userId, pageable)).map(NotificationResponse::from));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAuthority('NOTIFICATION_VIEW')")
    public ApiResponse<Map<String, Long>> unreadCount() {
        return ApiResponse.ok(Map.of("unread", repository.countByUserIdAndReadFalse(SecurityUtils.requireUser().getUserId())));
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("hasAuthority('NOTIFICATION_VIEW')")
    @Transactional
    public ApiResponse<NotificationResponse> markRead(@PathVariable UUID id) {
        Notification n = repository.findByIdAndUserId(id, SecurityUtils.requireUser().getUserId())
                .orElseThrow(() -> ApiException.notFound("Notification", id));
        n.setRead(true);
        n.setReadAt(Instant.now());
        return ApiResponse.ok(NotificationResponse.from(n));
    }

    @PostMapping("/read-all")
    @PreAuthorize("hasAuthority('NOTIFICATION_VIEW')")
    @Transactional
    public ApiResponse<Map<String, Integer>> readAll() {
        return ApiResponse.ok(Map.of("updated", repository.markAllRead(SecurityUtils.requireUser().getUserId(), Instant.now())));
    }
}
