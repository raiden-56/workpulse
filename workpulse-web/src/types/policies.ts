export type PolicyLevel = 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';

export interface CollectionWindow {
  days?: number[];
  from?: string;
  to?: string;
  tz?: string;
}

export interface PolicyResponse {
  id: string;
  name: string;
  level: PolicyLevel;
  targetId?: string | null;
  isDefault: boolean;
  workingHours: Record<string, unknown>;
  collectionWindows: CollectionWindow[];
  idleThresholdSeconds: number;
  samplingIntervalSeconds: number;
  collectWindowTitles: boolean;
  collectInputSummary: boolean;
  sensitiveAppExclusions: string[];
  dataCategories: string[];
  retentionDays: number;
  employeeNotice?: string | null;
  minAgentVersion?: string | null;
  version: number;
  status: string;
  updatedAt?: string | null;
}

export interface EffectivePolicyResponse {
  policyId?: string | null;
  name: string;
  version: number;
  resolvedFrom: string;
  samplingIntervalSeconds: number;
  idleThresholdSeconds: number;
  workingHours: Record<string, unknown>;
  collectionWindows: CollectionWindow[];
  collectWindowTitles: boolean;
  collectInputSummary: boolean;
  sensitiveAppExclusions: string[];
  dataCategories: string[];
  employeeNotice?: string | null;
  retentionDays: number;
  minAgentVersion?: string | null;
}
