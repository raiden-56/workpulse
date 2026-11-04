export interface GuestPersona {
  code: string;
  label: string;
  description: string;
  roleCode: string;
}

export interface DemoCredential {
  roleCode: string;
  label: string;
  email: string;
  password: string;
}

export interface GuestConfigResponse {
  enabled: boolean;
  organizationName?: string | null;
  personas: GuestPersona[];
  sessionTtlMinutes: number;
  notice: string;
  demoLogins: DemoCredential[];
}

export interface GuestResetResponse {
  message: string;
  employees: number;
  events: number;
}
