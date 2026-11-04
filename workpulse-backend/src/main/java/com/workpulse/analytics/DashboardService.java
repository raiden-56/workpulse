package com.workpulse.analytics;

import com.workpulse.activity.ActivityEventJdbcRepository;
import com.workpulse.activity.ActivityEventRecord;
import com.workpulse.activity.ActivityQueryService;
import com.workpulse.activity.ActivityState;
import com.workpulse.activity.EmployeeSessionRepository;
import com.workpulse.activity.LiveStatus;
import com.workpulse.activity.LiveStatusRepository;
import com.workpulse.activity.dto.ActivityDtos.LiveStatusResponse;
import com.workpulse.activity.dto.ActivityDtos.TimelineResponse;
import com.workpulse.analytics.dto.DashboardDtos.Anomalies;
import com.workpulse.analytics.dto.DashboardDtos.Attendance;
import com.workpulse.analytics.dto.DashboardDtos.DailyTrend;
import com.workpulse.analytics.dto.DashboardDtos.DashboardOverviewResponse;
import com.workpulse.analytics.dto.DashboardDtos.DepartmentBreakdown;
import com.workpulse.analytics.dto.DashboardDtos.Devices;
import com.workpulse.analytics.dto.DashboardDtos.EmployeeSummary;
import com.workpulse.analytics.dto.DashboardDtos.Engagement;
import com.workpulse.analytics.dto.DashboardDtos.Headcount;
import com.workpulse.analytics.dto.DashboardDtos.MyDashboardResponse;
import com.workpulse.analytics.dto.DashboardDtos.Presence;
import com.workpulse.analytics.dto.DashboardDtos.RecentActivity;
import com.workpulse.analytics.dto.DashboardDtos.TopApplication;
import com.workpulse.applications.ApplicationCatalogService;
import com.workpulse.applications.ApplicationCategory;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.departments.Department;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.devices.DeviceService;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.devices.dto.DeviceDtos.DeviceResponse;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.employees.EmploymentStatus;
import com.workpulse.employees.ManagerAssignmentRepository;
import com.workpulse.exception.ApiException;
import com.workpulse.organizations.Organization;
import com.workpulse.organizations.OrganizationRepository;
import com.workpulse.policies.PolicyService;
import com.workpulse.security.AccessScopeService;
import com.workpulse.security.SecurityUtils;
import com.workpulse.security.TenantContext;
import com.workpulse.security.UserPrincipal;
import com.workpulse.teams.Team;
import com.workpulse.teams.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageImpl;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Executive and personal dashboards, computed from live state, sessions and raw events.
 * Everything is scoped to the caller's visibility and the selected filters.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceService deviceService;
    private final LiveStatusRepository liveStatusRepository;
    private final EmployeeSessionRepository sessionRepository;
    private final ActivityEventJdbcRepository eventRepository;
    private final ActivityQueryService activityQueryService;
    private final ApplicationCatalogService catalog;
    private final OrganizationRepository organizationRepository;
    private final ManagerAssignmentRepository managerAssignmentRepository;
    private final PolicyService policyService;
    private final AccessScopeService accessScopeService;
    private final WorkPulseProperties properties;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public DashboardOverviewResponse overview(LocalDate from, LocalDate to, UUID departmentId, UUID teamId) {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID org = TenantContext.require();
        Organization organization = organizationRepository.findById(org)
                .orElseThrow(() -> ApiException.notFound("Organization", org));
        ZoneId zone = ZoneId.of(organization.getTimezone());
        LocalDate today = LocalDate.now(zone);
        LocalDate rangeTo = to == null ? today : to;
        LocalDate rangeFrom = from == null ? rangeTo.minusDays(6) : from;
        if (rangeFrom.isAfter(rangeTo)) {
            LocalDate tmp = rangeFrom;
            rangeFrom = rangeTo;
            rangeTo = tmp;
        }
        if (rangeTo.toEpochDay() - rangeFrom.toEpochDay() > 92) {
            rangeFrom = rangeTo.minusDays(92);
        }
        Instant start = rangeFrom.atStartOfDay(zone).toInstant();
        Instant end = rangeTo.plusDays(1).atStartOfDay(zone).toInstant();
        Instant todayStart = today.atStartOfDay(zone).toInstant();
        Instant todayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();

        Optional<Set<UUID>> visible = accessScopeService.visibleEmployeeIds(principal);
        List<Employee> all = employeeRepository.findByOrganizationId(org);
        List<Employee> scoped = all.stream()
                .filter(e -> visible.map(ids -> ids.contains(e.getId())).orElse(true))
                .filter(e -> departmentId == null || departmentId.equals(e.getDepartmentId()))
                .filter(e -> teamId == null || teamId.equals(e.getTeamId()))
                .toList();
        Set<UUID> scopedIds = scoped.stream().map(Employee::getId).collect(Collectors.toSet());
        boolean wholeOrg = visible.isEmpty() && departmentId == null && teamId == null;
        Set<UUID> idsParam = wholeOrg ? null : scopedIds;

        Headcount headcount = new Headcount(scoped.size(),
                scoped.stream().filter(e -> e.getEmploymentStatus() == EmploymentStatus.ACTIVE).count(),
                scoped.stream().filter(e -> e.getEmploymentStatus() == EmploymentStatus.ON_LEAVE).count(),
                scoped.stream().filter(e -> e.getEmploymentStatus() == EmploymentStatus.INACTIVE || e.getEmploymentStatus() == EmploymentStatus.TERMINATED).count());

        Map<UUID, LiveStatus> statuses = scopedIds.isEmpty() ? Map.of()
                : liveStatusRepository.findByOrganizationIdAndEmployeeIdIn(org, scopedIds).stream()
                .collect(Collectors.toMap(LiveStatus::getEmployeeId, Function.identity()));
        Map<ActivityState, Long> byState = new EnumMap<>(ActivityState.class);
        for (Employee e : scoped) {
            if (e.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
                continue;
            }
            LiveStatus s = statuses.get(e.getId());
            byState.merge(s == null ? ActivityState.OFFLINE : s.getStatus(), 1L, Long::sum);
        }
        long offline = byState.getOrDefault(ActivityState.OFFLINE, 0L);
        long activeEmployees = headcount.active();
        Presence presence = new Presence(activeEmployees - offline,
                byState.getOrDefault(ActivityState.ACTIVE_APPLICATION, 0L), byState.getOrDefault(ActivityState.FOCUS_SESSION, 0L),
                byState.getOrDefault(ActivityState.MEETING, 0L), byState.getOrDefault(ActivityState.IDLE, 0L),
                byState.getOrDefault(ActivityState.BREAK, 0L), byState.getOrDefault(ActivityState.LOCKED, 0L),
                offline, byState.getOrDefault(ActivityState.UNKNOWN, 0L));

        Devices devices = deviceStats(org, idsParam);

        long presentToday = wholeOrg ? sessionRepository.countDistinctEmployeesActiveBetween(org, todayStart, todayEnd)
                : scopedIds.isEmpty() ? 0 : sessionRepository.countDistinctEmployeesActiveBetweenIn(org, scopedIds, todayStart, todayEnd);
        long inRange = wholeOrg ? sessionRepository.countDistinctEmployeesActiveBetween(org, start, end)
                : scopedIds.isEmpty() ? 0 : sessionRepository.countDistinctEmployeesActiveBetweenIn(org, scopedIds, start, end);
        Attendance attendance = new Attendance(presentToday, activeEmployees,
                activeEmployees == 0 ? 0 : Math.round(1000.0 * presentToday / activeEmployees) / 10.0, inRange);

        List<ActivityEventJdbcRepository.AppDurationRow> appRows = eventRepository.aggregateForegroundByApp(org, idsParam, start, end, 200);
        Map<ApplicationCategory, Long> byCategory = new EnumMap<>(ApplicationCategory.class);
        long unclassified = 0;
        long total = 0;
        List<TopApplication> top = new ArrayList<>();
        for (ActivityEventJdbcRepository.AppDurationRow row : appRows) {
            long seconds = row.durationMs() / 1000;
            total += seconds;
            if (catalog.isClassified(row.processName())) {
                byCategory.merge(catalog.categoryOf(row.processName()), seconds, Long::sum);
            } else {
                unclassified += seconds;
            }
            if (top.size() < 10) {
                top.add(new TopApplication(row.processName(), catalog.displayNameOf(row.processName(), row.appName()),
                        catalog.find(row.processName()).map(a -> a.getDefaultCategory().name()).orElse("UNCLASSIFIED"), seconds, row.employees()));
            }
        }
        Engagement engagement = new Engagement(byCategory.getOrDefault(ApplicationCategory.PRODUCTIVE, 0L),
                byCategory.getOrDefault(ApplicationCategory.DEVELOPMENT, 0L), byCategory.getOrDefault(ApplicationCategory.COMMUNICATION, 0L),
                byCategory.getOrDefault(ApplicationCategory.MEETING, 0L), byCategory.getOrDefault(ApplicationCategory.RESEARCH, 0L),
                byCategory.getOrDefault(ApplicationCategory.NEUTRAL, 0L) + byCategory.getOrDefault(ApplicationCategory.CUSTOM, 0L),
                byCategory.getOrDefault(ApplicationCategory.UNPRODUCTIVE, 0L), unclassified, total);

        List<DailyTrend> daily = eventRepository.dailyActivity(org, idsParam, start, end, organization.getTimezone()).stream()
                .map(r -> new DailyTrend(r.day(), r.activeEmployees(), Math.round(r.foregroundMs() / 36000.0) / 100.0, r.idleEvents()))
                .toList();

        Map<UUID, Department> departments = departmentRepository.findByOrganizationIdOrderByNameAsc(org).stream()
                .collect(Collectors.toMap(Department::getId, Function.identity()));
        Map<UUID, List<Employee>> byDept = scoped.stream()
                .filter(e -> e.getDepartmentId() != null && e.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .collect(Collectors.groupingBy(Employee::getDepartmentId));
        List<DepartmentBreakdown> breakdown = byDept.entrySet().stream()
                .filter(en -> departments.containsKey(en.getKey()))
                .map(en -> {
                    long on = 0;
                    long act = 0;
                    long idl = 0;
                    long off = 0;
                    for (Employee e : en.getValue()) {
                        LiveStatus s = statuses.get(e.getId());
                        ActivityState st = s == null ? ActivityState.OFFLINE : s.getStatus();
                        if (st == ActivityState.OFFLINE) {
                            off++;
                        } else {
                            on++;
                        }
                        if (st == ActivityState.ACTIVE_APPLICATION || st == ActivityState.FOCUS_SESSION || st == ActivityState.MEETING) {
                            act++;
                        }
                        if (st == ActivityState.IDLE) {
                            idl++;
                        }
                    }
                    return new DepartmentBreakdown(en.getKey(), departments.get(en.getKey()).getName(), en.getValue().size(), on, act, idl, off);
                })
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();

        Map<UUID, Employee> byId = scoped.stream().collect(Collectors.toMap(Employee::getId, Function.identity()));
        List<RecentActivity> recent = eventRepository.findRecent(org, idsParam, 15).stream()
                .filter(r -> r.employeeId() != null && byId.containsKey(r.employeeId()))
                .map(r -> new RecentActivity(r.employeeId(), byId.get(r.employeeId()).getFullName(), r.eventType().name(), r.occurredAt(), describe(r)))
                .toList();

        Anomalies anomalies = anomalySummary(org, idsParam);

        return new DashboardOverviewResponse(start, end, organization.getTimezone(), organization.isDemo(),
                principal.getScope() == null ? "ORGANIZATION" : principal.getScope().level().name(),
                headcount, presence, devices, attendance, engagement, top, daily, breakdown, recent, anomalies);
    }

    @Transactional(readOnly = true)
    public MyDashboardResponse me() {
        UserPrincipal principal = SecurityUtils.requireUser();
        UUID org = TenantContext.require();
        Organization organization = organizationRepository.findById(org)
                .orElseThrow(() -> ApiException.notFound("Organization", org));
        ZoneId zone = ZoneId.of(organization.getTimezone());
        LocalDate today = LocalDate.now(zone);
        if (principal.getEmployeeId() == null) {
            return new MyDashboardResponse(false, today, organization.getTimezone(), null, null, null, List.of(), List.of(), List.of(), null);
        }
        Employee employee = employeeRepository.findByIdAndOrganizationId(principal.getEmployeeId(), org).orElse(null);
        if (employee == null) {
            return new MyDashboardResponse(false, today, organization.getTimezone(), null, null, null, List.of(), List.of(), List.of(), null);
        }
        String departmentName = employee.getDepartmentId() == null ? null
                : departmentRepository.findById(employee.getDepartmentId()).map(Department::getName).orElse(null);
        String teamName = employee.getTeamId() == null ? null : teamRepository.findById(employee.getTeamId()).map(Team::getName).orElse(null);
        String managerName = managerAssignmentRepository.findFirstByEmployeeIdAndEffectiveToIsNullOrderByEffectiveFromDesc(employee.getId())
                .flatMap(a -> employeeRepository.findById(a.getManagerEmployeeId())).map(Employee::getFullName).orElse(null);
        EmployeeSummary summary = new EmployeeSummary(employee.getId(), employee.getEmployeeCode(), employee.getFullName(), employee.getDesignation(),
                departmentName, teamName, managerName, employee.getRoleProfile());
        LiveStatusResponse status = activityQueryService.buildRows(org, List.of(employee)).get(0);
        TimelineResponse timeline = activityQueryService.timeline(employee.getId(), today);
        Instant weekStart = today.minusDays(6).atStartOfDay(zone).toInstant();
        Instant tomorrow = today.plusDays(1).atStartOfDay(zone).toInstant();
        List<DailyTrend> weekly = eventRepository.dailyActivity(org, Set.of(employee.getId()), weekStart, tomorrow, organization.getTimezone()).stream()
                .map(r -> new DailyTrend(r.day(), r.activeEmployees(), Math.round(r.foregroundMs() / 36000.0) / 100.0, r.idleEvents()))
                .toList();
        List<DeviceResponse> devices = deviceService.toResponses(
                new PageImpl<>(deviceRepository.findByOrganizationIdAndEmployeeId(org, employee.getId()))).getContent();
        return new MyDashboardResponse(true, today, organization.getTimezone(), summary, status, timeline.summary(), timeline.topApplications(),
                weekly, devices, policyService.effectiveFor(org, employee.getId()));
    }

    private Devices deviceStats(UUID org, Set<UUID> employeeIds) {
        Instant connectedCutoff = Instant.now().minus(properties.agent().offlineAfter());
        List<Device> devices;
        if (employeeIds == null) {
            devices = deviceRepository.findAll().stream().filter(d -> org.equals(d.getOrganizationId())).toList();
        } else if (employeeIds.isEmpty()) {
            devices = List.of();
        } else {
            devices = deviceRepository.findByOrganizationIdAndEmployeeIdIn(org, employeeIds);
        }
        long approved = devices.stream().filter(d -> d.getStatus() == DeviceStatus.APPROVED).count();
        long connected = devices.stream().filter(d -> d.getStatus() == DeviceStatus.APPROVED && d.getLastSeenAt() != null
                && d.getLastSeenAt().isAfter(connectedCutoff)).count();
        return new Devices(devices.size(), approved,
                devices.stream().filter(d -> d.getStatus() == DeviceStatus.PENDING).count(),
                devices.stream().filter(d -> d.getStatus() == DeviceStatus.REVOKED).count(),
                connected, approved - connected,
                devices.stream().filter(d -> d.getStatus() == DeviceStatus.APPROVED && d.getHealth() == DeviceHealth.HEALTHY).count(),
                devices.stream().filter(d -> d.getStatus() == DeviceStatus.APPROVED && d.getHealth() == DeviceHealth.DEGRADED).count(),
                devices.stream().filter(d -> d.getStatus() == DeviceStatus.APPROVED && d.getHealth() == DeviceHealth.OFFLINE).count());
    }

    private Anomalies anomalySummary(UUID org, Set<UUID> employeeIds) {
        String base = "SELECT count(*) FILTER (WHERE status = 'NEW') AS open_count, "
                + "count(*) FILTER (WHERE status = 'UNDER_REVIEW') AS review_count, "
                + "count(*) FILTER (WHERE severity = 'HIGH' AND status IN ('NEW','UNDER_REVIEW')) AS high_count "
                + "FROM anomaly_events WHERE organization_id = ?";
        Map<String, Object> row;
        if (employeeIds == null) {
            row = jdbc.queryForMap(base, org);
        } else if (employeeIds.isEmpty()) {
            return new Anomalies(0, 0, 0, false);
        } else {
            row = jdbc.queryForMap(base + " AND employee_id = ANY(?)", org, employeeIds.toArray(new UUID[0]));
        }
        return new Anomalies(((Number) row.get("open_count")).longValue(), ((Number) row.get("review_count")).longValue(),
                ((Number) row.get("high_count")).longValue(), false);
    }

    private static String describe(ActivityEventRecord r) {
        return switch (r.eventType()) {
            case SESSION_START -> "Signed in";
            case SESSION_END -> "Signed out";
            case SESSION_LOCK -> "Locked workstation";
            case SESSION_UNLOCK -> "Unlocked workstation";
            case IDLE_START -> "Became idle";
            case IDLE_END -> "Resumed after " + r.payloadLong("idleSeconds", 0) / 60 + " min idle";
            case BREAK_START -> "Started a break";
            case BREAK_END -> "Ended a break";
            case AGENT_STARTED -> "Agent started";
            case AGENT_STOPPED -> "Agent stopped";
            default -> r.eventType().name();
        };
    }
}
