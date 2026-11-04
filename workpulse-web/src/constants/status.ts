import type { ActivityState } from '@/types/activity';
import type { DeviceHealth, DeviceStatus } from '@/types/devices';

export interface StatusMeta {
  label: string;
  color: string;
  description: string;
}

/** Status palette from docs/architecture/DESIGN_SYSTEM.md. Never conveyed by colour alone. */
export const ACTIVITY_STATUS_META: Record<ActivityState, StatusMeta> = {
  ACTIVE_APPLICATION: { label: 'Active', color: '#4E8866', description: 'An application is in the foreground and input is recent' },
  FOCUS_SESSION: { label: 'Focus', color: '#3F7A5A', description: 'Same application in the foreground for 25+ minutes without idle or switching' },
  MEETING: { label: 'Meeting', color: '#5B7A8C', description: 'A meeting application is in the foreground' },
  IDLE: { label: 'Idle', color: '#C18B43', description: 'No keyboard or mouse input beyond the policy threshold (may still be working away from the keyboard)' },
  BREAK: { label: 'Break', color: '#A89A6B', description: 'Employee-declared break' },
  LOCKED: { label: 'Locked', color: '#8A8F8B', description: 'Workstation locked' },
  OFFLINE: { label: 'Offline', color: '#B75E56', description: 'No agent session' },
  UNKNOWN: { label: 'Unknown', color: '#B8BDB9', description: 'Waiting for activity data' },
};

export const DEVICE_HEALTH_META: Record<DeviceHealth, StatusMeta> = {
  HEALTHY: { label: 'Healthy', color: '#4E8866', description: 'Agent heartbeat received recently' },
  DEGRADED: { label: 'Degraded', color: '#C18B43', description: 'Collector disconnected or sync backlog' },
  OFFLINE: { label: 'Offline', color: '#B75E56', description: 'No heartbeat received' },
  UNKNOWN: { label: 'Unknown', color: '#B8BDB9', description: 'Never reported' },
};

export const DEVICE_STATUS_META: Record<DeviceStatus, StatusMeta> = {
  PENDING: { label: 'Pending approval', color: '#C18B43', description: 'Registered, awaiting IT approval' },
  APPROVED: { label: 'Approved', color: '#4E8866', description: 'Authorised to synchronise activity' },
  REVOKED: { label: 'Revoked', color: '#B75E56', description: 'Access revoked by an administrator' },
  RETIRED: { label: 'Retired', color: '#8A8F8B', description: 'Decommissioned' },
};

export const CATEGORY_COLORS: Record<string, string> = {
  PRODUCTIVE: '#4E8866',
  DEVELOPMENT: '#3F7A5A',
  COMMUNICATION: '#6F8FA0',
  MEETING: '#5B7A8C',
  RESEARCH: '#7FA37A',
  NEUTRAL: '#A89A6B',
  UNPRODUCTIVE: '#B75E56',
  CUSTOM: '#8A8F8B',
  UNCLASSIFIED: '#B8BDB9',
};

export const CATEGORY_LABELS: Record<string, string> = {
  PRODUCTIVE: 'Productive',
  DEVELOPMENT: 'Development',
  COMMUNICATION: 'Communication',
  MEETING: 'Meetings',
  RESEARCH: 'Research',
  NEUTRAL: 'Neutral',
  UNPRODUCTIVE: 'Unproductive',
  CUSTOM: 'Custom',
  UNCLASSIFIED: 'Unclassified',
};

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#747C75',
  MEDIUM: '#C18B43',
  HIGH: '#B75E56',
};
