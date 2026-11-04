export type ActivityState =
  | 'ACTIVE_APPLICATION'
  | 'FOCUS_SESSION'
  | 'MEETING'
  | 'IDLE'
  | 'BREAK'
  | 'LOCKED'
  | 'OFFLINE'
  | 'UNKNOWN';

export const ACTIVITY_STATES: ActivityState[] = [
  'ACTIVE_APPLICATION',
  'FOCUS_SESSION',
  'MEETING',
  'IDLE',
  'BREAK',
  'LOCKED',
  'OFFLINE',
  'UNKNOWN',
];

export interface LiveStatusResponse {
  employeeId: string;
  employeeCode?: string | null;
  employeeName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  status: ActivityState;
  foregroundApp?: string | null;
  foregroundProcess?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceHealth?: string | null;
  agentVersion?: string | null;
  lastSyncAt?: string | null;
  sessionStartedAt?: string | null;
  sessionDurationSeconds?: number | null;
  sinceAt?: string | null;
  reason?: string | null;
}

export interface LiveSummary {
  total: number;
  byStatus: Record<string, number>;
}

export interface LiveQuery {
  q?: string;
  departmentId?: string;
  teamId?: string;
  status?: ActivityState;
  page?: number;
  size?: number;
}

export interface TimelineInterval {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  state: ActivityState;
  processName?: string | null;
  appName?: string | null;
  category?: string | null;
  reason?: string | null;
}

export interface TimelineSummary {
  sessionSeconds: number;
  activeSeconds: number;
  focusSeconds: number;
  meetingSeconds: number;
  idleSeconds: number;
  breakSeconds: number;
  lockedSeconds: number;
  unknownSeconds: number;
  firstEventAt?: string | null;
  lastEventAt?: string | null;
  applicationSwitches: number;
}

export interface AppUsage {
  processName: string;
  appName?: string | null;
  category?: string | null;
  durationSeconds: number;
}

export interface TimelineResponse {
  employeeId: string;
  employeeName: string;
  date: string;
  timezone: string;
  intervals: TimelineInterval[];
  summary: TimelineSummary;
  topApplications: AppUsage[];
}

export interface LiveStatusDelta {
  employeeId: string;
  status: ActivityState;
  foregroundApp?: string | null;
  foregroundProcess?: string | null;
  deviceId?: string | null;
  since?: string | null;
  sessionStartedAt?: string | null;
  reason?: string | null;
  updatedAt: string;
}
