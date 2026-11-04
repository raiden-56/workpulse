package com.workpulse.activity;

import com.workpulse.activity.dto.ActivityDtos.LiveStatusResponse;
import com.workpulse.activity.dto.ActivityDtos.LiveSummary;
import com.workpulse.activity.dto.ActivityDtos.TimelineResponse;
import com.workpulse.applications.ApplicationCatalogService;
import com.workpulse.audit.AuditService;
import com.workpulse.departments.Department;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.employees.EmploymentStatus;
import com.workpulse.exception.ApiException;
import com.workpulse.organizations.OrganizationRepository;
import com.workpulse.security.AccessScopeService;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import com.workpulse.teams.Team;
import com.workpulse.teams.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ActivityQueryService {

    private final LiveStatusRepository liveStatusRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final DeviceRepository deviceRepository;
    private final OrganizationRepository organizationRepository;
    private final ActivityEventJdbcRepository eventRepository;
    private final TimelineDerivationService derivationService;
    private final ApplicationCatalogService catalog;
    private final AccessScopeService accessScopeService;
    private final AuditService auditService;

    public record LiveFilter(String q, UUID departmentId, UUID teamId, ActivityState status) {}

    @Transactional(readOnly = true)
    public Page<LiveStatusResponse> live(LiveFilter filter, Pageable pageable) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID org = TenantContext.require();
        Optional<Set<UUID>> visible = accessScopeService.visibleEmployeeIds(principal);
        List<Employee> employees = employeeRepository.findByOrganizationId(org).stream()
                .filter(e -> e.getEmploymentStatus() == EmploymentStatus.ACTIVE || e.getEmploymentStatus() == EmploymentStatus.ON_LEAVE)
                .filter(e -> visible.map(ids -> ids.contains(e.getId())).orElse(true))
                .filter(e -> filter.departmentId() == null || filter.departmentId().equals(e.getDepartmentId()))
                .filter(e -> filter.teamId() == null || filter.teamId().equals(e.getTeamId()))
                .toList();
        List<LiveStatusResponse> rows = buildRows(org, employees).stream()
                .filter(r -> filter.status() == null || r.status() == filter.status())
                .filter(r -> filter.q() == null || filter.q().isBlank() || matches(r, filter.q()))
                .sorted(Comparator.comparing((LiveStatusResponse r) -> rank(r.status())).thenComparing(LiveStatusResponse::employeeName))
                .toList();
        auditService.recordDataAccess("LIVE_MONITORING", "LIST", null, Map.of("count", rows.size()));
        int from = (int) Math.min(pageable.getOffset(), rows.size());
        int to = Math.min(from + pageable.getPageSize(), rows.size());
        return new PageImpl<>(rows.subList(from, to), pageable, rows.size());
    }

    @Transactional(readOnly = true)
    public LiveSummary liveSummary() {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID org = TenantContext.require();
        Optional<Set<UUID>> visible = accessScopeService.visibleEmployeeIds(principal);
        List<Employee> employees = employeeRepository.findByOrganizationId(org).stream()
                .filter(e -> e.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .filter(e -> visible.map(ids -> ids.contains(e.getId())).orElse(true)).toList();
        Map<String, Long> byStatus = new HashMap<>();
        for (ActivityState s : ActivityState.values()) {
            byStatus.put(s.name(), 0L);
        }
        Map<UUID, LiveStatus> statuses = statusesFor(org, employees);
        for (Employee e : employees) {
            LiveStatus s = statuses.get(e.getId());
            String key = s == null ? ActivityState.OFFLINE.name() : s.getStatus().name();
            byStatus.merge(key, 1L, Long::sum);
        }
        return new LiveSummary(employees.size(), byStatus);
    }

    @Transactional(readOnly = true)
    public TimelineResponse timeline(UUID employeeId, LocalDate date) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID org = TenantContext.require();
        UUID target = employeeId == null ? principal.getEmployeeId() : employeeId;
        if (target == null) {
            throw ApiException.badRequest("employeeId is required");
        }
        if (!target.equals(principal.getEmployeeId())) {
            if (!principal.hasPermission("ACTIVITY_VIEW")) {
                throw ApiException.notFound("Employee", target);
            }
            accessScopeService.assertCanView(principal, target);
        }
        Employee employee = employeeRepository.findByIdAndOrganizationId(target, org).orElseThrow(() -> ApiException.notFound("Employee", target));
        String tz = organizationRepository.findById(org).map(o -> o.getTimezone()).orElse("UTC");
        ZoneId zone = ZoneId.of(tz);
        LocalDate day = date == null ? LocalDate.now(zone) : date;
        Instant start = day.atStartOfDay(zone).toInstant();
        Instant end = day.plusDays(1).atStartOfDay(zone).toInstant();
        List<ActivityEventRecord> events = eventRepository.findForEmployee(org, target, start, end);
        TimelineDerivationService.Derived derived = derivationService.derive(events, start, end, Instant.now(),
                p -> catalog.find(p).map(a -> new TimelineDerivationService.AppInfo(a.getDisplayName(), a.getDefaultCategory())).orElse(null));
        auditService.recordDataAccess("ACTIVITY_TIMELINE", "VIEW", target, Map.of("date", day.toString()));
        return new TimelineResponse(employee.getId(), employee.getFullName(), day, tz, derived.intervals(), derived.summary(), derived.topApplications());
    }

    public List<LiveStatusResponse> buildRows(UUID org, List<Employee> employees) {
        Map<UUID, Department> departments = departmentRepository.findByOrganizationIdOrderByNameAsc(org).stream()
                .collect(Collectors.toMap(Department::getId, Function.identity()));
        Map<UUID, Team> teams = teamRepository.findByOrganizationIdOrderByNameAsc(org).stream()
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        Map<UUID, LiveStatus> statuses = statusesFor(org, employees);
        Set<UUID> deviceIds = statuses.values().stream().map(LiveStatus::getDeviceId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Device> devices = deviceIds.isEmpty() ? Map.of()
                : deviceRepository.findAllById(deviceIds).stream().collect(Collectors.toMap(Device::getId, Function.identity()));
        Instant now = Instant.now();
        return employees.stream().map(e -> {
            LiveStatus s = statuses.get(e.getId());
            Department d = e.getDepartmentId() == null ? null : departments.get(e.getDepartmentId());
            Team t = e.getTeamId() == null ? null : teams.get(e.getTeamId());
            Device dev = s == null || s.getDeviceId() == null ? null : devices.get(s.getDeviceId());
            boolean online = s != null && s.getStatus() != ActivityState.OFFLINE;
            return new LiveStatusResponse(e.getId(), e.getEmployeeCode(), e.getFullName(), e.getDepartmentId(), d == null ? null : d.getName(),
                    e.getTeamId(), t == null ? null : t.getName(), s == null ? ActivityState.OFFLINE : s.getStatus(),
                    s == null ? null : s.getForegroundApp(), s == null ? null : s.getForegroundProcess(),
                    dev == null ? null : dev.getId(), dev == null ? null : dev.getHostname(), dev == null ? null : dev.getHealth().name(),
                    dev == null ? null : dev.getAgentVersion(), dev == null ? null : dev.getLastSyncAt(),
                    online ? s.getSessionStartedAt() : null,
                    online && s.getSessionStartedAt() != null ? java.time.Duration.between(s.getSessionStartedAt(), now).getSeconds() : null,
                    s == null ? null : s.getSinceAt(), s == null ? "No agent data" : s.getReason());
        }).toList();
    }

    private Map<UUID, LiveStatus> statusesFor(UUID org, List<Employee> employees) {
        if (employees.isEmpty()) {
            return Map.of();
        }
        return liveStatusRepository.findByOrganizationIdAndEmployeeIdIn(org, employees.stream().map(Employee::getId).toList()).stream()
                .collect(Collectors.toMap(LiveStatus::getEmployeeId, Function.identity()));
    }

    private static boolean matches(LiveStatusResponse r, String q) {
        String needle = q.toLowerCase();
        return r.employeeName().toLowerCase().contains(needle)
                || (r.employeeCode() != null && r.employeeCode().toLowerCase().contains(needle))
                || (r.foregroundApp() != null && r.foregroundApp().toLowerCase().contains(needle))
                || (r.deviceName() != null && r.deviceName().toLowerCase().contains(needle))
                || (r.departmentName() != null && r.departmentName().toLowerCase().contains(needle))
                || (r.teamName() != null && r.teamName().toLowerCase().contains(needle));
    }

    private static int rank(ActivityState s) {
        return switch (s) {
            case FOCUS_SESSION -> 0;
            case ACTIVE_APPLICATION -> 1;
            case MEETING -> 2;
            case IDLE -> 3;
            case BREAK -> 4;
            case LOCKED -> 5;
            case UNKNOWN -> 6;
            case OFFLINE -> 7;
        };
    }
}
