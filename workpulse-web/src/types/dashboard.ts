import type { AppUsage, LiveStatusResponse, TimelineSummary } from './activity';
import type { DeviceResponse } from './devices';
import type { EffectivePolicyResponse } from './policies';

export interface Headcount {
  total: number;
  active: number;
  onLeave: number;
  inactive: number;
}

export interface Presence {
  online: number;
  activeApplication: number;
  focusSession: number;
  meeting: number;
  idle: number;
  onBreak: number;
  locked: number;
  offline: number;
  unknown: number;
}

export interface DeviceStats {
  total: number;
  approved: number;
  pending: number;
  revoked: number;
  connected: number;
  disconnected: number;
  healthy: number;
  degraded: number;
  offline: number;
}

export interface AttendanceStats {
  presentToday: number;
  expectedToday: number;
  presenceRate: number;
  employeesWithSessionsInRange: number;
}

export interface Engagement {
  productiveSeconds: number;
  developmentSeconds: number;
  communicationSeconds: number;
  meetingSeconds: number;
  researchSeconds: number;
  neutralSeconds: number;
  unproductiveSeconds: number;
  unclassifiedSeconds: number;
  totalForegroundSeconds: number;
}

export interface TopApplication {
  processName: string;
  appName?: string | null;
  category?: string | null;
  seconds: number;
  employees: number;
}

export interface DailyTrend {
  day: string;
  activeEmployees: number;
  foregroundHours: number;
  idleEvents: number;
}

export interface DepartmentBreakdown {
  id: string;
  name: string;
  headcount: number;
  online: number;
  focusOrActive: number;
  idle: number;
  offline: number;
}

export interface RecentActivity {
  employeeId: string;
  employeeName: string;
  type: string;
  occurredAt: string;
  detail?: string | null;
}

export interface AnomalySummary {
  open: number;
  underReview: number;
  highSeverity: number;
  detectionEnabled: boolean;
}

export interface DashboardOverviewResponse {
  from: string;
  to: string;
  timezone: string;
  demo: boolean;
  scopeLevel: string;
  headcount: Headcount;
  presence: Presence;
  devices: DeviceStats;
  attendance: AttendanceStats;
  engagement: Engagement;
  topApplications: TopApplication[];
  daily: DailyTrend[];
  departments: DepartmentBreakdown[];
  recentActivity: RecentActivity[];
  anomalies: AnomalySummary;
}

export interface DashboardQuery {
  from?: string;
  to?: string;
  departmentId?: string;
  teamId?: string;
}

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  fullName: string;
  designation?: string | null;
  departmentName?: string | null;
  teamName?: string | null;
  managerName?: string | null;
  roleProfile?: string | null;
}

export interface MyDashboardResponse {
  hasEmployeeProfile: boolean;
  date: string;
  timezone: string;
  employee?: EmployeeSummary | null;
  status?: LiveStatusResponse | null;
  today?: TimelineSummary | null;
  topApplicationsToday: AppUsage[];
  weekly: DailyTrend[];
  devices: DeviceResponse[];
  policy?: EffectivePolicyResponse | null;
}
