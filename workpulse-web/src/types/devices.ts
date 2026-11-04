import type { PageQuery } from './api';

export type DeviceStatus = 'PENDING' | 'APPROVED' | 'REVOKED' | 'RETIRED';
export type DeviceHealth = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export const DEVICE_STATUSES: DeviceStatus[] = ['PENDING', 'APPROVED', 'REVOKED', 'RETIRED'];
export const DEVICE_HEALTHS: DeviceHealth[] = ['HEALTHY', 'DEGRADED', 'OFFLINE', 'UNKNOWN'];

export interface DeviceResponse {
  id: string;
  hostname: string;
  machineId: string;
  osName?: string | null;
  osVersion?: string | null;
  agentVersion?: string | null;
  status: DeviceStatus;
  health: DeviceHealth;
  employeeId?: string | null;
  employeeName?: string | null;
  departmentName?: string | null;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  registeredAt: string;
  approvedAt?: string | null;
  revokedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DeviceSummary {
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

export interface DeviceQuery extends PageQuery {
  q?: string;
  status?: DeviceStatus;
  health?: DeviceHealth;
  employeeId?: string;
  departmentId?: string;
}
