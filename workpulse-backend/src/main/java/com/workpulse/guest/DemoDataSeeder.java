package com.workpulse.guest;

import com.workpulse.activity.ActivityEventJdbcRepository;
import com.workpulse.activity.ActivityEventRecord;
import com.workpulse.activity.ActivityEventType;
import com.workpulse.activity.LiveStatusService;
import com.workpulse.audit.AuditService;
import com.workpulse.common.util.HashUtil;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.departments.Department;
import com.workpulse.departments.DepartmentRepository;
import com.workpulse.devices.AgentVersion;
import com.workpulse.devices.AgentVersionRepository;
import com.workpulse.devices.Device;
import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.devices.DeviceStatus;
import com.workpulse.devices.DeviceToken;
import com.workpulse.devices.DeviceTokenRepository;
import com.workpulse.employees.Employee;
import com.workpulse.employees.EmployeeRepository;
import com.workpulse.employees.EmploymentStatus;
import com.workpulse.employees.ManagerAssignment;
import com.workpulse.employees.ManagerAssignmentRepository;
import com.workpulse.notifications.Notification;
import com.workpulse.notifications.NotificationRepository;
import com.workpulse.organizations.Organization;
import com.workpulse.organizations.OrganizationRepository;
import com.workpulse.organizations.OrganizationService;
import com.workpulse.policies.MonitoringPolicy;
import com.workpulse.policies.MonitoringPolicyRepository;
import com.workpulse.policies.PolicyLevel;
import com.workpulse.teams.Team;
import com.workpulse.teams.TeamRepository;
import com.workpulse.users.Role;
import com.workpulse.users.RoleRepository;
import com.workpulse.users.User;
import com.workpulse.users.UserRepository;
import com.workpulse.users.UserRole;
import com.workpulse.users.UserRoleRepository;
import com.workpulse.users.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Generates the clearly-labelled simulated organisation used by Guest Mode. Every record is marked
 * through the organisation's {@code is_demo} flag and the generated names, emails and hostnames use
 * reserved demo domains. Activity is produced through the same event types the real agent uses, and
 * live status / sessions are derived with the real {@link LiveStatusService}.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class DemoDataSeeder implements ApplicationRunner {

    public static final String DEMO_PASSWORD = "Demo!2026pass";
    public static final String PERSONA_EMPLOYEE_CODE = "NW-1004";
    public static final String PERSONA_TEAM_LEAD_CODE = "NW-1001";
    public static final String PERSONA_MANAGER_CODE = "NW-1000";

    public record DemoUser(String roleCode, String label, String email) {}

    public static final List<DemoUser> DEMO_USERS = List.of(
            new DemoUser("ORG_ADMIN", "Organisation Admin", "demo.admin@workpulse.demo"),
            new DemoUser("IT_ADMIN", "IT Administrator", "demo.it@workpulse.demo"),
            new DemoUser("HR_ADMIN", "HR Administrator", "demo.hr@workpulse.demo"),
            new DemoUser("DEPT_MANAGER", "Department Manager (Engineering)", "demo.manager@workpulse.demo"),
            new DemoUser("TEAM_LEAD", "Team Lead (Platform)", "demo.lead@workpulse.demo"),
            new DemoUser("EMPLOYEE", "Employee", "demo.employee@workpulse.demo"),
            new DemoUser("AUDITOR", "Auditor", "demo.auditor@workpulse.demo"));

    public record SeedResult(int employees, long events) {}

    private static final String[] FIRST = {"Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Neha", "Karthik", "Meera", "Arjun", "Divya",
            "Sanjay", "Pooja", "Rahul", "Sneha", "Aditya", "Kavya", "Nikhil", "Riya", "Siddharth", "Isha", "Elena", "Marcus", "Sofia", "Daniel",
            "Hannah", "Lucas", "Amira", "Tomas", "Yuki", "Chloe", "Omar", "Lena", "Felix", "Zara", "Mateo", "Ingrid", "Ravi", "Tanvi", "Dev", "Nisha",
            "Harsh", "Lakshmi", "Varun", "Anjali", "Manish", "Shreya", "Kabir", "Aisha", "Ethan", "Maya"};
    private static final String[] LAST = {"Sharma", "Patel", "Mehta", "Iyer", "Reddy", "Nair", "Kulkarni", "Desai", "Joshi", "Menon",
            "Rao", "Singh", "Gupta", "Bose", "Chawla", "Verma", "Pillai", "Shetty", "Mishra", "Das", "Fischer", "Okafor", "Rossi", "Nguyen",
            "Schmidt", "Almeida", "Haddad", "Novak", "Tanaka", "Moreau", "Khan", "Berg", "Weber", "Costa", "Silva", "Larsen", "Bhat", "Saxena",
            "Agarwal", "Chandra", "Kapoor", "Hegde", "Banerjee", "Ghosh", "Mathur", "Trivedi", "Qureshi", "Fernandes", "Walker", "Hughes"};

    private record TeamSpec(String department, String team, String roleProfile, String[] designations, String[] apps, int[] weights) {}

    private static final TeamSpec[] TEAMS = {
            new TeamSpec("Engineering", "Platform", "DEVELOPER", new String[]{"Senior Software Engineer", "Software Engineer", "Staff Engineer"},
                    new String[]{"code.exe", "idea64.exe", "windowsterminal.exe", "chrome.exe", "ms-teams.exe", "slack.exe", "postman.exe", "docker desktop.exe"},
                    new int[]{30, 20, 12, 15, 8, 8, 4, 3}),
            new TeamSpec("Engineering", "Mobile", "DEVELOPER", new String[]{"Mobile Engineer", "Senior Mobile Engineer"},
                    new String[]{"code.exe", "rider64.exe", "chrome.exe", "ms-teams.exe", "slack.exe", "figma.exe"},
                    new int[]{35, 25, 15, 10, 8, 7}),
            new TeamSpec("Engineering", "Data", "ANALYST", new String[]{"Data Engineer", "Data Analyst", "Analytics Lead"},
                    new String[]{"pycharm64.exe", "dbeaver.exe", "excel.exe", "chrome.exe", "ms-teams.exe", "powerpnt.exe"},
                    new int[]{30, 20, 18, 14, 10, 8}),
            new TeamSpec("Product", "Design", "DESIGNER", new String[]{"Product Designer", "UX Researcher"},
                    new String[]{"figma.exe", "chrome.exe", "notion.exe", "ms-teams.exe", "slack.exe", "powerpnt.exe"},
                    new int[]{45, 15, 12, 12, 8, 8}),
            new TeamSpec("Product", "Product Management", "PRODUCT", new String[]{"Product Manager", "Senior Product Manager"},
                    new String[]{"notion.exe", "chrome.exe", "ms-teams.exe", "excel.exe", "powerpnt.exe", "outlook.exe", "slack.exe"},
                    new int[]{20, 18, 22, 12, 10, 10, 8}),
            new TeamSpec("Customer Success", "Support", "SUPPORT", new String[]{"Support Engineer", "Support Specialist"},
                    new String[]{"chrome.exe", "ms-teams.exe", "outlook.exe", "slack.exe", "notepad++.exe", "excel.exe"},
                    new int[]{35, 20, 18, 12, 8, 7}),
            new TeamSpec("Customer Success", "Onboarding", "SUPPORT", new String[]{"Onboarding Specialist", "Implementation Consultant"},
                    new String[]{"ms-teams.exe", "chrome.exe", "outlook.exe", "powerpnt.exe", "excel.exe", "notion.exe"},
                    new int[]{30, 22, 18, 12, 10, 8}),
            new TeamSpec("Finance", "Accounts", "FINANCE", new String[]{"Accountant", "Financial Analyst", "Finance Manager"},
                    new String[]{"excel.exe", "saplogon.exe", "outlook.exe", "chrome.exe", "ms-teams.exe", "acrobat.exe"},
                    new int[]{38, 20, 15, 12, 8, 7}),
            new TeamSpec("People Operations", "HR Ops", "HR", new String[]{"HR Business Partner", "Recruiter", "People Operations Specialist"},
                    new String[]{"outlook.exe", "chrome.exe", "ms-teams.exe", "excel.exe", "winword.exe", "acrobat.exe"},
                    new int[]{25, 25, 18, 12, 12, 8}),
            new TeamSpec("Sales", "Enterprise Sales", "SALES", new String[]{"Account Executive", "Sales Development Representative", "Solutions Consultant"},
                    new String[]{"outlook.exe", "ms-teams.exe", "chrome.exe", "powerpnt.exe", "excel.exe", "zoom.exe"},
                    new int[]{25, 25, 20, 12, 10, 8}),
    };

    private final WorkPulseProperties properties;
    private final OrganizationRepository organizationRepository;
    private final OrganizationService organizationService;
    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final EmployeeRepository employeeRepository;
    private final ManagerAssignmentRepository managerAssignmentRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final AgentVersionRepository agentVersionRepository;
    private final MonitoringPolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final NotificationRepository notificationRepository;
    private final ActivityEventJdbcRepository eventRepository;
    private final LiveStatusService liveStatusService;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        if (!properties.demo().enabled() || organizationRepository.findFirstByDemoTrue().isPresent()) {
            return;
        }
        long startedAt = System.currentTimeMillis();
        SeedResult result = seed();
        log.info("Demo organisation seeded with {} employees and {} activity events in {} ms",
                result.employees(), result.events(), System.currentTimeMillis() - startedAt);
    }

    @Transactional
    public SeedResult reseed() {
        organizationRepository.findFirstByDemoTrue().ifPresent(org -> purge(org.getId()));
        return seed();
    }

    @Transactional
    public SeedResult seed() {
        Random random = new Random(20261104L);
        // Reuse the organisation row on reseed so guest tokens issued before a reset stay valid.
        Organization org = organizationRepository.findFirstByDemoTrue().orElseGet(Organization::new);
        org.setName("Northwind Analytics (Demo)");
        org.setSlug(properties.demo().organizationSlug());
        org.setCode("DEMO");
        org.setTimezone("Asia/Kolkata");
        org.setDemo(true);
        org.setSettings(Map.of("demo", true, "generatedAt", Instant.now().toString()));
        org = organizationRepository.save(org);
        organizationService.createDefaults(org);
        final UUID orgId = org.getId();
        ZoneId zone = ZoneId.of(org.getTimezone());

        if (agentVersionRepository.findByVersion("1.0.0").isEmpty()) {
            AgentVersion v = new AgentVersion();
            v.setVersion("1.0.0");
            v.setChannel("STABLE");
            v.setReleaseNotes("Initial WorkPulse agent release");
            agentVersionRepository.save(v);
        }

        Map<String, Department> departments = new HashMap<>();
        Map<String, Team> teams = new HashMap<>();
        for (TeamSpec spec : TEAMS) {
            Department d = departments.computeIfAbsent(spec.department(), name -> {
                Department dep = new Department();
                dep.setOrganizationId(orgId);
                dep.setName(name);
                dep.setCode(name.substring(0, Math.min(3, name.length())).toUpperCase());
                return departmentRepository.save(dep);
            });
            Team t = new Team();
            t.setOrganizationId(orgId);
            t.setDepartmentId(d.getId());
            t.setName(spec.team());
            String letters = spec.team().replaceAll("[^A-Za-z]", "");
            t.setCode(letters.substring(0, Math.min(4, letters.length())).toUpperCase());
            teams.put(spec.team(), teamRepository.save(t));
        }

        MonitoringPolicy eng = new MonitoringPolicy();
        eng.setOrganizationId(orgId);
        eng.setName("Engineering policy");
        eng.setLevel(PolicyLevel.DEPARTMENT);
        eng.setTargetId(departments.get("Engineering").getId());
        eng.setIdleThresholdSeconds(600);
        eng.setSamplingIntervalSeconds(10);
        eng.setCollectionWindows(List.of(Map.of("days", List.of(1, 2, 3, 4, 5), "from", "08:00", "to", "21:00", "tz", org.getTimezone())));
        eng.setSensitiveAppExclusions(List.of("keepass.exe", "1password.exe", "bitwarden.exe", "signal.exe"));
        eng.setDataCategories(List.of("FOREGROUND_APPLICATION", "IDLE_TIME", "SESSION_STATE", "INPUT_SUMMARY", "DEVICE_HEALTH"));
        eng.setRetentionDays(180);
        eng.setEmployeeNotice("Engineering devices report foreground applications and idle periods between 08:00 and 21:00 on working days.");
        policyRepository.save(eng);

        MonitoringPolicy support = new MonitoringPolicy();
        support.setOrganizationId(orgId);
        support.setName("Support team policy");
        support.setLevel(PolicyLevel.TEAM);
        support.setTargetId(teams.get("Support").getId());
        support.setIdleThresholdSeconds(180);
        support.setSamplingIntervalSeconds(5);
        support.setCollectionWindows(List.of(Map.of("days", List.of(1, 2, 3, 4, 5, 6), "from", "07:00", "to", "22:00", "tz", org.getTimezone())));
        support.setDataCategories(List.of("FOREGROUND_APPLICATION", "IDLE_TIME", "SESSION_STATE", "DEVICE_HEALTH"));
        support.setRetentionDays(120);
        support.setEmployeeNotice("Support workstations are sampled every 5 seconds during shift hours to support service-level reporting.");
        policyRepository.save(support);

        int employeeCount = Math.max(TEAMS.length, properties.demo().employeeCount());
        List<Employee> employees = new ArrayList<>();
        List<TeamSpec> specOf = new ArrayList<>();
        Map<String, Employee> teamLeads = new HashMap<>();
        Map<String, Employee> deptHeads = new HashMap<>();
        for (int i = 0; i < employeeCount; i++) {
            TeamSpec spec = TEAMS[i % TEAMS.length];
            Employee e = new Employee();
            e.setOrganizationId(orgId);
            e.setEmployeeCode("NW-" + (1000 + i));
            e.setFirstName(FIRST[i % FIRST.length]);
            e.setLastName(LAST[(i * 7 + i / FIRST.length) % LAST.length]);
            String local = (e.getFirstName() + "." + e.getLastName() + (i >= FIRST.length ? i : "")).toLowerCase().replaceAll("[^a-z0-9.]", "");
            e.setWorkEmail(local + "@northwind-demo.example");
            boolean lead = !teamLeads.containsKey(spec.team());
            boolean head = lead && !deptHeads.containsKey(spec.department());
            e.setDesignation(head ? "Head of " + spec.department() : lead ? spec.team() + " Lead"
                    : spec.designations()[random.nextInt(spec.designations().length)]);
            e.setDepartmentId(departments.get(spec.department()).getId());
            e.setTeamId(teams.get(spec.team()).getId());
            e.setJoiningDate(LocalDate.now(zone).minusDays(120 + random.nextInt(1500)));
            e.setRoleProfile(spec.roleProfile());
            e.setEmploymentStatus(i == employeeCount - 2 ? EmploymentStatus.ON_LEAVE : EmploymentStatus.ACTIVE);
            e = employeeRepository.save(e);
            employees.add(e);
            specOf.add(spec);
            if (lead) {
                teamLeads.put(spec.team(), e);
                teams.get(spec.team()).setLeadEmployeeId(e.getId());
            }
            if (head) {
                deptHeads.put(spec.department(), e);
                departments.get(spec.department()).setHeadEmployeeId(e.getId());
            }
        }
        for (int i = 0; i < employees.size(); i++) {
            Employee e = employees.get(i);
            Employee lead = teamLeads.get(specOf.get(i).team());
            Employee head = deptHeads.get(specOf.get(i).department());
            Employee manager = e.getId().equals(lead.getId()) ? (e.getId().equals(head.getId()) ? null : head) : lead;
            if (manager != null) {
                ManagerAssignment m = new ManagerAssignment();
                m.setOrganizationId(orgId);
                m.setEmployeeId(e.getId());
                m.setManagerEmployeeId(manager.getId());
                managerAssignmentRepository.save(m);
            }
        }

        Employee managerEmployee = byCode(employees, PERSONA_MANAGER_CODE, employees.get(0));
        Employee leadEmployee = byCode(employees, PERSONA_TEAM_LEAD_CODE, employees.get(0));
        Employee plainEmployee = byCode(employees, PERSONA_EMPLOYEE_CODE, employees.get(employees.size() - 1));
        for (DemoUser du : DEMO_USERS) {
            User u = new User();
            u.setOrganizationId(orgId);
            u.setEmail(du.email());
            u.setDisplayName(du.label() + " (Demo)");
            u.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
            u.setPasswordChangedAt(Instant.now());
            u.setStatus(UserStatus.ACTIVE);
            switch (du.roleCode()) {
                case "DEPT_MANAGER" -> u.setEmployeeId(managerEmployee.getId());
                case "TEAM_LEAD" -> u.setEmployeeId(leadEmployee.getId());
                case "EMPLOYEE" -> u.setEmployeeId(plainEmployee.getId());
                default -> { }
            }
            u = userRepository.save(u);
            Role role = roleRepository.findByCode(du.roleCode()).orElseThrow();
            UserRole ur = new UserRole();
            ur.setUserId(u.getId());
            ur.setRole(role);
            if ("DEPT_MANAGER".equals(du.roleCode())) {
                ur.setDepartmentId(departments.get("Engineering").getId());
            }
            if ("TEAM_LEAD".equals(du.roleCode())) {
                ur.setTeamId(teams.get("Platform").getId());
            }
            userRoleRepository.save(ur);
            if ("ORG_ADMIN".equals(du.roleCode()) || "IT_ADMIN".equals(du.roleCode())) {
                seedNotifications(orgId, u.getId());
            }
        }

        List<Device> devices = new ArrayList<>();
        for (int i = 0; i < employees.size(); i++) {
            Employee e = employees.get(i);
            Device d = new Device();
            d.setOrganizationId(orgId);
            d.setEmployeeId(e.getId());
            d.setHostname("NW-LT-" + e.getEmployeeCode().substring(3));
            d.setMachineId(HashUtil.sha256Hex("demo-machine-" + e.getEmployeeCode()).substring(0, 40));
            d.setOsName("Windows 11 Enterprise");
            d.setOsVersion(random.nextInt(10) < 8 ? "10.0.26100" : "10.0.22631");
            d.setAgentVersion(random.nextInt(10) < 8 ? "1.0.0" : "0.9.4");
            d.setStatus(i == employees.size() - 1 ? DeviceStatus.PENDING : i == employees.size() - 3 ? DeviceStatus.REVOKED : DeviceStatus.APPROVED);
            d.setRegisteredAt(Instant.now().minus(Duration.ofDays(30 + random.nextInt(200))));
            if (d.getStatus() == DeviceStatus.APPROVED) {
                d.setApprovedAt(d.getRegisteredAt().plus(Duration.ofHours(2)));
            }
            if (d.getStatus() == DeviceStatus.REVOKED) {
                d.setRevokedAt(Instant.now().minus(Duration.ofDays(3)));
            }
            d.setMetadata(Map.of("cpu", "Intel Core i7-1365U", "memoryMb", 16384, "domainJoined", true));
            d = deviceRepository.save(d);
            DeviceToken token = new DeviceToken();
            token.setDevice(d);
            token.setTokenHash(HashUtil.sha256Hex("demo-token-" + d.getId()));
            deviceTokenRepository.save(token);
            devices.add(d);
        }

        long events = 0;
        ZonedDateTime now = ZonedDateTime.now(zone);
        LocalDate today = now.toLocalDate();
        int days = Math.max(1, properties.demo().seedDays());
        for (int i = 0; i < employees.size(); i++) {
            Employee e = employees.get(i);
            Device d = devices.get(i);
            if (d.getStatus() != DeviceStatus.APPROVED || e.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
                continue;
            }
            TeamSpec spec = specOf.get(i);
            Instant lastSeen = null;
            for (int back = days - 1; back >= 0; back--) {
                LocalDate day = today.minusDays(back);
                if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    continue;
                }
                if (random.nextInt(100) < 6) {
                    continue; // absent
                }
                if (back == 0 && i % 9 == 7) {
                    continue; // has not started yet today (never one of the persona employees)
                }
                List<ActivityEventRecord> dayEvents = generateDay(random, orgId, d, e, spec, day, zone, back == 0 ? now : null);
                if (dayEvents.isEmpty()) {
                    continue;
                }
                events += eventRepository.insertBatch(dayEvents);
                liveStatusService.apply(d, dayEvents);
                lastSeen = dayEvents.get(dayEvents.size() - 1).occurredAt();
            }
            d.setLastSeenAt(lastSeen);
            d.setLastSyncAt(lastSeen);
            boolean seenToday = lastSeen != null && lastSeen.isAfter(today.atStartOfDay(zone).toInstant());
            d.setHealth(seenToday ? (i % 11 == 6 ? DeviceHealth.DEGRADED : DeviceHealth.HEALTHY) : DeviceHealth.OFFLINE);
            deviceRepository.save(d);
        }

        auditService.recordSystem(orgId, "DEMO_DATA_SEEDED", "ORGANIZATION", orgId,
                Map.of("employees", employees.size(), "events", events, "days", days));
        return new SeedResult(employees.size(), events);
    }

    private static Employee byCode(List<Employee> employees, String code, Employee fallback) {
        return employees.stream().filter(e -> code.equals(e.getEmployeeCode())).findFirst().orElse(fallback);
    }

    private List<ActivityEventRecord> generateDay(Random random, UUID orgId, Device device, Employee employee, TeamSpec spec,
                                                  LocalDate day, ZoneId zone, ZonedDateTime cutoff) {
        List<ActivityEventRecord> out = new ArrayList<>();
        UUID sessionId = UUID.randomUUID();
        long[] seq = {0};
        ZonedDateTime start = day.atTime(LocalTime.of(9, 0)).atZone(zone).plusMinutes(random.nextInt(75) - 25);
        ZonedDateTime end = day.atTime(LocalTime.of(18, 0)).atZone(zone).plusMinutes(random.nextInt(150) - 60);
        if (cutoff != null && end.isAfter(cutoff)) {
            end = cutoff;
        }
        if (cutoff != null && start.isAfter(cutoff)) {
            return out;
        }
        add(out, orgId, device, employee, sessionId, seq, ActivityEventType.AGENT_STARTED, start.minusMinutes(2),
                Map.of("agentVersion", device.getAgentVersion(), "hostname", device.getHostname()));
        add(out, orgId, device, employee, sessionId, seq, ActivityEventType.SESSION_START, start,
                Map.of("windowsUser", "NORTHWIND\\" + employee.getWorkEmail().split("@")[0], "sessionKind", "CONSOLE"));

        ZonedDateTime t = start.plusSeconds(20);
        ZonedDateTime lunch = day.atTime(LocalTime.of(13, 0)).atZone(zone).plusMinutes(random.nextInt(40) - 20);
        boolean hadLunch = false;
        List<ZonedDateTime> meetingTimes = new ArrayList<>();
        int meetings = 1 + random.nextInt(3);
        for (int m = 0; m < meetings; m++) {
            meetingTimes.add(day.atTime(LocalTime.of(10 + random.nextInt(7), random.nextInt(4) * 15)).atZone(zone));
        }
        while (t.isBefore(end)) {
            if (!hadLunch && !t.isBefore(lunch)) {
                int minutes = 35 + random.nextInt(25);
                if (random.nextBoolean()) {
                    add(out, orgId, device, employee, sessionId, seq, ActivityEventType.SESSION_LOCK, t, Map.of());
                    t = t.plusMinutes(minutes);
                    if (t.isAfter(end)) {
                        break;
                    }
                    add(out, orgId, device, employee, sessionId, seq, ActivityEventType.SESSION_UNLOCK, t, Map.of());
                } else {
                    add(out, orgId, device, employee, sessionId, seq, ActivityEventType.BREAK_START, t, Map.of("breakType", "DECLARED", "note", "Lunch"));
                    t = t.plusMinutes(minutes);
                    if (t.isAfter(end)) {
                        break;
                    }
                    add(out, orgId, device, employee, sessionId, seq, ActivityEventType.BREAK_END, t, Map.of("breakType", "DECLARED"));
                }
                hadLunch = true;
                t = t.plusSeconds(15);
                continue;
            }
            ZonedDateTime meetingAt = null;
            for (ZonedDateTime mt : meetingTimes) {
                if (!t.isBefore(mt) && t.isBefore(mt.plusMinutes(5))) {
                    meetingAt = mt;
                }
            }
            if (meetingAt != null) {
                meetingTimes.remove(meetingAt);
                ZonedDateTime blockEnd = t.plusMinutes(25 + random.nextInt(40));
                if (blockEnd.isAfter(end)) {
                    blockEnd = end;
                }
                add(out, orgId, device, employee, sessionId, seq, ActivityEventType.FOREGROUND_APP, t,
                        foreground("ms-teams.exe", "Microsoft Teams", Duration.between(t, blockEnd).toMillis()));
                t = blockEnd.plusSeconds(10);
                continue;
            }
            String process = pick(random, spec.apps(), spec.weights());
            int minutes = 4 + random.nextInt(spec.roleProfile().equals("DEVELOPER") ? 42 : 24);
            ZonedDateTime blockEnd = t.plusMinutes(minutes);
            if (blockEnd.isAfter(end)) {
                blockEnd = end;
            }
            add(out, orgId, device, employee, sessionId, seq, ActivityEventType.FOREGROUND_APP, t,
                    foreground(process, null, Duration.between(t, blockEnd).toMillis()));
            t = blockEnd.plusSeconds(5 + random.nextInt(20));
            if (random.nextInt(100) < 18 && t.isBefore(end)) {
                int idleMinutes = 5 + random.nextInt(18);
                add(out, orgId, device, employee, sessionId, seq, ActivityEventType.IDLE_START, t,
                        Map.of("lastInputAt", t.minusMinutes(5).toInstant().toString(), "thresholdSeconds", 300));
                t = t.plusMinutes(idleMinutes);
                if (t.isAfter(end)) {
                    break;
                }
                add(out, orgId, device, employee, sessionId, seq, ActivityEventType.IDLE_END, t, Map.of("idleSeconds", idleMinutes * 60L + 300));
                t = t.plusSeconds(10);
            }
        }
        if (cutoff == null || end.isBefore(cutoff.minusMinutes(3))) {
            add(out, orgId, device, employee, sessionId, seq, ActivityEventType.SESSION_END, end, Map.of("reason", "LOGOFF"));
        } else {
            add(out, orgId, device, employee, sessionId, seq, ActivityEventType.AGENT_HEARTBEAT, end,
                    Map.of("queueDepth", 0, "collectorConnected", true, "uiConnected", true));
        }
        return out;
    }

    private static Map<String, Object> foreground(String process, String appName, long durationMs) {
        Map<String, Object> p = new HashMap<>();
        p.put("processName", process);
        if (appName != null) {
            p.put("appName", appName);
        }
        p.put("pid", 1000 + Math.abs(process.hashCode() % 9000));
        p.put("durationMs", durationMs);
        return p;
    }

    private static void add(List<ActivityEventRecord> out, UUID orgId, Device device, Employee employee, UUID sessionId, long[] seq,
                            ActivityEventType type, ZonedDateTime at, Map<String, Object> payload) {
        out.add(new ActivityEventRecord(null, orgId, device.getId(), employee.getId(), UUID.randomUUID(), type, at.toInstant(),
                at.toInstant(), ++seq[0], sessionId, device.getAgentVersion(), payload));
    }

    private static String pick(Random random, String[] values, int[] weights) {
        int total = 0;
        for (int w : weights) {
            total += w;
        }
        int r = random.nextInt(total);
        for (int i = 0; i < values.length; i++) {
            r -= weights[i];
            if (r < 0) {
                return values[i];
            }
        }
        return values[values.length - 1];
    }

    private void seedNotifications(UUID orgId, UUID userId) {
        String[][] items = {
                {"AGENT_DISCONNECTED", "MEDIUM", "Agent offline on NW-LT-1047", "No heartbeat received for 3 hours. The device may be powered off."},
                {"AGENT_UPDATE_REQUIRED", "LOW", "5 devices run agent 0.9.4", "Agent 1.0.0 is available; devices will update at the next idle window."},
                {"POLICY_CHANGED", "LOW", "Engineering policy updated", "Idle threshold raised to 10 minutes for the Engineering department."},
                {"DEVICE_PENDING", "LOW", "New device awaiting approval", "A new workstation registered by an employee is pending IT approval."},
        };
        int hours = 1;
        for (String[] it : items) {
            Notification n = new Notification();
            n.setOrganizationId(orgId);
            n.setUserId(userId);
            n.setType(it[0]);
            n.setSeverity(it[1]);
            n.setTitle(it[2]);
            n.setBody(it[3]);
            n.setCreatedAt(Instant.now().minus(Duration.ofHours(hours)));
            hours += 7;
            notificationRepository.save(n);
        }
    }

    /**
     * Removes the generated workforce data of the demo organisation, in dependency order. The
     * organisation row itself and its audit / guest-session history are kept.
     */
    @Transactional
    public void purge(UUID orgId) {
        jdbc.update("DELETE FROM guest_permissions WHERE guest_account_id IN (SELECT id FROM guest_accounts WHERE organization_id = ?)", orgId);
        jdbc.update("DELETE FROM guest_accounts WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM notifications WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM anomaly_reviews WHERE anomaly_id IN (SELECT id FROM anomaly_events WHERE organization_id = ?)", orgId);
        jdbc.update("DELETE FROM anomaly_events WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM employee_correction_requests WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM breaks WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM attendance_records WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM privacy_acknowledgements WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM data_deletion_requests WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM activity_intervals WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM live_status WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM employee_sessions WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM application_usage WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM activity_events WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM application_classifications WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM device_tokens WHERE device_id IN (SELECT id FROM devices WHERE organization_id = ?)", orgId);
        jdbc.update("DELETE FROM devices WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM employee_policy_assignments WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM monitoring_policies WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM users WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM manager_assignments WHERE organization_id = ?", orgId);
        jdbc.update("UPDATE departments SET head_employee_id = NULL WHERE organization_id = ?", orgId);
        jdbc.update("UPDATE teams SET lead_employee_id = NULL WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM employees WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM teams WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM departments WHERE organization_id = ?", orgId);
        jdbc.update("DELETE FROM shifts WHERE organization_id = ?", orgId);
    }
}
