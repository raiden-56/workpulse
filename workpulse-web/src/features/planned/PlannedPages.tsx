import { PageHeader } from '@/components/common/PageHeader';
import { PlannedModule } from '@/components/common/PlannedModule';

export function AttendancePlannedPage() {
  return (
    <>
      <PageHeader title="Attendance & timesheets" subtitle="Daily, weekly and monthly attendance derived from agent sessions, with shifts, breaks, late arrivals, overtime and correction requests." />
      <PlannedModule
        title="Attendance module"
        phase={7}
        description="Attendance records are computed from logon sessions and classified intervals against the employee's shift. This phase adds the attendance tables, configurable rules (grace periods, overtime thresholds), break tracking, manager approvals for correction requests and CSV/PDF export. Sessions are already being collected today, so history will be available from day one."
      />
    </>
  );
}

export function ApplicationsPlannedPage() {
  return (
    <>
      <PageHeader title="Application usage analytics" subtitle="Daily, weekly and monthly application usage, switching patterns and configurable classification by role profile." />
      <PlannedModule
        title="Application analytics module"
        phase={7}
        description="Foreground application samples are already stored and summarised on dashboards and timelines. This phase adds organisation-level classification overrides per role profile (for example Chrome as productive for support staff), application switching analysis, team and department comparisons and exports. Browser activity will only ever be collected through authorised integrations with privacy exclusions."
      />
    </>
  );
}

export function AnomaliesPlannedPage() {
  return (
    <>
      <PageHeader title="Activity integrity & anomalies" subtitle="Rules-based detection of unusual patterns with evidence, severity and a human review workflow." />
      <PlannedModule
        title="Anomaly detection module"
        phase={9}
        description="Detects repetitive input signals, highly regular intervals, unexpectedly long idle periods, unusual switching, abnormal session lengths and unusual agent disconnections. Every finding carries a score, confidence and supporting evidence and moves through New, Under review, Explained, Resolved or Dismissed. Findings never penalise anyone automatically; they are starting points for a conversation."
      />
    </>
  );
}

export function ReportsPlannedPage() {
  return (
    <>
      <PageHeader title="Reports & exports" subtitle="Employee, attendance, application usage, device health, team, department, anomaly, overtime and workforce trend reports in CSV, PDF and Excel." />
      <PlannedModule
        title="Reporting module"
        phase={10}
        description="Report generation with date, employee and department filters and permission-aware export controls. Every export is recorded in the audit trail. Demo guests will be able to export sample reports from the simulated organisation."
      />
    </>
  );
}
