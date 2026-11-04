package com.workpulse.analytics.dto;

import com.workpulse.activity.dto.ActivityDtos.AppUsage;
import com.workpulse.activity.dto.ActivityDtos.LiveStatusResponse;
import com.workpulse.activity.dto.ActivityDtos.TimelineSummary;
import com.workpulse.devices.dto.DeviceDtos.DeviceResponse;
import com.workpulse.policies.dto.PolicyDtos.EffectivePolicyResponse;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class DashboardDtos {

    private DashboardDtos() {}

    public record Headcount(long total, long active, long onLeave, long inactive) {}

    public record Presence(long online, long activeApplication, long focusSession, long meeting, long idle, long onBreak,
                           long locked, long offline, long unknown) {}

    public record Devices(long total, long approved, long pending, long revoked, long connected, long disconnected,
                          long healthy, long degraded, long offline) {}

    public record Attendance(long presentToday, long expectedToday, double presenceRate, long employeesWithSessionsInRange) {}

    public record Engagement(long productiveSeconds, long developmentSeconds, long communicationSeconds, long meetingSeconds,
                             long researchSeconds, long neutralSeconds, long unproductiveSeconds, long unclassifiedSeconds,
                             long totalForegroundSeconds) {}

    public record TopApplication(String processName, String appName, String category, long seconds, long employees) {}

    public record DailyTrend(LocalDate day, long activeEmployees, double foregroundHours, long idleEvents) {}

    public record DepartmentBreakdown(UUID id, String name, long headcount, long online, long focusOrActive, long idle, long offline) {}

    public record RecentActivity(UUID employeeId, String employeeName, String type, Instant occurredAt, String detail) {}

    public record Anomalies(long open, long underReview, long highSeverity, boolean detectionEnabled) {}

    public record DashboardOverviewResponse(Instant from, Instant to, String timezone, boolean demo, String scopeLevel,
                                            Headcount headcount, Presence presence, Devices devices, Attendance attendance,
                                            Engagement engagement, List<TopApplication> topApplications, List<DailyTrend> daily,
                                            List<DepartmentBreakdown> departments, List<RecentActivity> recentActivity,
                                            Anomalies anomalies) {}

    public record EmployeeSummary(UUID id, String employeeCode, String fullName, String designation, String departmentName,
                                  String teamName, String managerName, String roleProfile) {}

    public record MyDashboardResponse(boolean hasEmployeeProfile, LocalDate date, String timezone, EmployeeSummary employee,
                                      LiveStatusResponse status, TimelineSummary today, List<AppUsage> topApplicationsToday,
                                      List<DailyTrend> weekly, List<DeviceResponse> devices, EffectivePolicyResponse policy) {}
}
