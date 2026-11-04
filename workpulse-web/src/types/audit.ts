import type { PageQuery } from './api';

export interface AuditLogResponse {
  id: string;
  actorUserId?: string | null;
  actorType: string;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  occurredAt: string;
}

export interface AuditLogQuery extends PageQuery {
  from?: string;
  to?: string;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  q?: string;
}

export interface DataAccessLogResponse {
  id: string;
  actorUserId?: string | null;
  actorType: string;
  subjectEmployeeId?: string | null;
  resource: string;
  action: string;
  detail?: Record<string, unknown>;
  occurredAt: string;
}

export interface DataAccessLogQuery extends PageQuery {
  employeeId?: string;
}
