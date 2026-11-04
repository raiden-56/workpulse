export type ManualBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'note'; text: string };

export interface ManualSection {
  id: string;
  title: string;
  category: 'Introduction' | 'Getting started' | 'Role guides' | 'Desktop agent' | 'Concepts' | 'Privacy & security' | 'FAQ';
  summary: string;
  blocks: ManualBlock[];
}

export const MANUAL: ManualSection[] = [
  {
    id: 'what-is-workpulse',
    title: 'What is WorkPulse?',
    category: 'Introduction',
    summary: 'An employee activity, attendance and productivity analytics platform built around transparency.',
    blocks: [
      { type: 'p', text: 'WorkPulse helps organisations understand how working hours are spent: which applications are used, when people are present, how devices and agents are behaving, and where unusual patterns deserve a human look.' },
      { type: 'p', text: 'It deliberately distinguishes between a computer being online, an application being actively used, idle periods, meetings, breaks and focus sessions. Mouse movement or keyboard input is never treated as productivity on its own.' },
      { type: 'ul', items: ['Web management portal for managers, HR, IT, auditors and employees.', 'A visible Windows desktop agent that collects only authorised activity signals.', 'A backend that classifies activity with a transparent reason for every state.'] },
    ],
  },
  {
    id: 'why-organisations-use-it',
    title: 'Why organisations use it',
    category: 'Introduction',
    summary: 'Accurate workforce insight, transparent monitoring and evidence-based reviews.',
    blocks: [
      { type: 'ul', items: ['Understand application engagement by role instead of guessing from login times.', 'Keep attendance and session records that employees can see and challenge.', 'Spot agent, device and integrity problems early with supporting evidence.', 'Meet data-minimisation and purpose-limitation expectations with configurable policies and retention.'] },
      { type: 'note', text: 'WorkPulse never ranks employees by a single productivity score and never penalises anyone automatically.' },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    category: 'Getting started',
    summary: 'From first sign-in to a configured organisation in five steps.',
    blocks: [
      { type: 'steps', items: ['Sign in with the account your administrator invited you with, or activate it from the invitation link.', 'Organisation admins: create departments and teams under Departments & teams.', 'Add employees to the directory (or import them in Phase 3) and link portal accounts to employee records.', 'Install the desktop agent on company workstations; employees sign in once to register the device.', 'Review the monitoring policy and the employee notice under Monitoring policies and Privacy & data.'] },
    ],
  },
  {
    id: 'login-and-guest-mode',
    title: 'Login and Guest Mode',
    category: 'Getting started',
    summary: 'Signing in, resetting passwords and exploring the demo organisation.',
    blocks: [
      { type: 'h', text: 'Signing in' },
      { type: 'p', text: 'Use your work email and password. Sessions use short-lived access tokens that refresh automatically; after a long period of inactivity you are asked to sign in again. Forgot password sends reset instructions if the account exists.' },
      { type: 'h', text: 'Guest Mode' },
      { type: 'p', text: 'Choose Continue as Guest on the sign-in page to explore a simulated organisation with generated employees, devices and activity. Pick a persona (executive, department manager, team lead, HR, IT, employee or auditor) to see that role\'s dashboards. Guest sessions are read-only and expire automatically; a DEMO badge and watermark stay visible throughout.' },
      { type: 'p', text: 'Demo role accounts let you sign in as a real user inside the demo organisation to try write actions on simulated data.' },
      { type: 'note', text: 'Nothing in Guest Mode is real monitoring data. The demo organisation is regenerated on demand and isolated from every other tenant.' },
    ],
  },
  {
    id: 'employee-dashboard',
    title: 'Employee dashboard guide',
    category: 'Role guides',
    summary: 'Your own status, timeline, applications, devices and policy.',
    blocks: [
      { type: 'ul', items: ['Current status with the reason it was classified that way (for example "Visual Studio Code in the foreground for 32 min without idle").', 'Today at a glance: session duration separated from active, focus, meeting, idle, break and locked time.', 'Timeline strip for today and a seven-day trend of foreground hours.', 'Your registered devices and agent health.', 'The monitoring policy that applies to you, including the employee notice and retention period.'] },
      { type: 'p', text: 'Correction requests for misclassified intervals arrive with the privacy centre in Phase 11.' },
    ],
  },
  {
    id: 'manager-dashboard',
    title: 'Manager and team lead dashboard guide',
    category: 'Role guides',
    summary: 'Scoped presence, engagement and timelines for your department or team.',
    blocks: [
      { type: 'p', text: 'Department managers and team leads see the same overview as executives, scoped by the backend to the departments or teams bound to their role. The scope chip on the dashboard shows which level applies.' },
      { type: 'ul', items: ['Presence tiles: online, active/focus, idle, meetings, breaks, offline.', 'Engagement by application category and the top applications in the selected range.', 'Daily activity trend and department comparison.', 'Live monitoring with an employee drawer showing the explained timeline for any day.'] },
      { type: 'note', text: 'Attempting to open an employee outside your scope returns "not found", never a hint that the record exists.' },
    ],
  },
  {
    id: 'hr-dashboard',
    title: 'HR dashboard guide',
    category: 'Role guides',
    summary: 'Headcount, presence and the employee directory.',
    blocks: [
      { type: 'ul', items: ['Headcount, on-leave and inactive counts.', 'Present today and presence rate derived from logon sessions.', 'Employee directory with add, edit, deactivate and assignment of managers, departments and teams.', 'Attendance rules, shifts, breaks and corrections arrive with Phase 7.'] },
    ],
  },
  {
    id: 'it-dashboard',
    title: 'IT dashboard guide',
    category: 'Role guides',
    summary: 'Device inventory, approvals and agent health.',
    blocks: [
      { type: 'ul', items: ['Registered, connected, degraded/offline and pending counts.', 'Devices needing attention ordered by last contact.', 'Pending approvals: approve a device so its agent can start synchronising.', 'Agent version distribution; remote diagnostics and update management arrive with Phase 5.'] },
      { type: 'p', text: 'Revoking a device immediately blocks its token; buffered events stay on the workstation and are never silently discarded.' },
    ],
  },
  {
    id: 'super-admin-guide',
    title: 'Super Admin guide',
    category: 'Role guides',
    summary: 'Platform-level administration across organisations.',
    blocks: [
      { type: 'p', text: 'Super admins are not members of any organisation. Use the organisation switcher in the top bar (or Open on the platform dashboard) to view a tenant with global permissions; every request then carries that organisation\'s id.' },
      { type: 'ul', items: ['Create organisations; the first admin receives an activation link.', 'Monitor platform health: database, Redis and RabbitMQ.', 'Review the demo organisation and reset its data.'] },
    ],
  },
  {
    id: 'auditor-guide',
    title: 'Auditor guide',
    category: 'Role guides',
    summary: 'Read-only audit trail and access history.',
    blocks: [
      { type: 'p', text: 'Auditors can read the audit trail (administrative changes with before/after state), the data-access log (who looked at whose data), monitoring policies and privacy information. The role has no write permissions, and every read of employee data by an auditor is itself logged.' },
    ],
  },
  {
    id: 'agent-installation',
    title: 'Desktop agent installation',
    category: 'Desktop agent',
    summary: 'Installing the visible Windows agent and registering a workstation.',
    blocks: [
      { type: 'steps', items: ['Install the signed WorkPulse Agent package (the Windows service, the activity collector and the agent application).', 'After sign-in to Windows the WorkPulse Agent window and tray icon appear; it is always visible.', 'Sign in with your WorkPulse account. The agent registers this workstation and receives its monitoring policy.', 'Depending on policy, IT approves the device; until then events are buffered locally.', 'The agent home shows monitoring status, the current session, sync status and the policy notice at all times.'] },
      { type: 'p', text: 'The agent samples the foreground application roughly every 5 to 10 seconds, detects idle time and lock/unlock, and synchronises batches of events. When the network is unavailable events are stored in an encrypted local queue and sent later.' },
    ],
  },
  {
    id: 'agent-troubleshooting',
    title: 'Desktop agent troubleshooting',
    category: 'Desktop agent',
    summary: 'What to check when a device shows degraded or offline.',
    blocks: [
      { type: 'ul', items: ['Offline: the service has not sent a heartbeat. Check that the WorkPulse service is running and the workstation has network access.', 'Degraded: the collector is disconnected from the service or the local queue has a large backlog. Restarting the agent re-establishes the named-pipe connection.', 'Pending approval: ask IT to approve the device under Devices.', 'Revoked: the device was revoked by an administrator; re-registration needs a new approval.', 'Diagnostics in the agent show queue depth, dead-lettered events and the last errors.'] },
    ],
  },
  {
    id: 'application-usage',
    title: 'Application usage explained',
    category: 'Concepts',
    summary: 'How foreground samples become usage, categories and engagement.',
    blocks: [
      { type: 'p', text: 'The agent reports which process is in the foreground. Consecutive samples of the same application are merged into usage blocks; switching applications starts a new block. Blocks are then classified using the application catalogue and, from Phase 7, organisation overrides by role profile.' },
      { type: 'ul', items: ['Categories: productive, development, communication, meeting, research, neutral, unproductive and custom.', 'Classification depends on the role profile: an IDE is development for engineers; a spreadsheet is productive for finance.', 'Browsers are context dependent and default to neutral; browser sessions are never assumed unproductive.', 'Applications not in the catalogue are reported as unclassified, not unproductive.'] },
    ],
  },
  {
    id: 'attendance-calculation',
    title: 'Attendance calculation explained',
    category: 'Concepts',
    summary: 'Sessions, presence and how attendance differs from engagement.',
    blocks: [
      { type: 'p', text: 'A logon session starts when the agent reports a Windows sign-in and ends at sign-out, shutdown or when the agent stops. Presence today counts employees with at least one session overlapping the day in the organisation timezone.' },
      { type: 'p', text: 'Attendance duration is the span of sessions; active application engagement is the time an application was genuinely in use. The two are always shown separately so that a long session with little activity is visible as exactly that, and vice versa.' },
      { type: 'p', text: 'Shift rules, grace periods, late arrivals, early departures, overtime and correction workflows arrive with the attendance module in Phase 7.' },
    ],
  },
  {
    id: 'activity-classification',
    title: 'Activity classification explained',
    category: 'Concepts',
    summary: 'The eight states and the reasons behind them.',
    blocks: [
      { type: 'ul', items: ['Active: an application is in the foreground and input is recent.', 'Focus: the same application has been in the foreground for 25 minutes or more without idle time or switching.', 'Meeting: a meeting application such as Teams or Zoom is in the foreground.', 'Idle: no keyboard or mouse input beyond the policy threshold. People may be reading, thinking or in a conversation, so idle is informational, not a judgement.', 'Break: an employee-declared break.', 'Locked: the workstation is locked.', 'Offline: no agent session.', 'Unknown: waiting for data, for example right after sign-in or after a gap in agent events.'] },
      { type: 'p', text: 'Every classified interval and every live status carries a human-readable reason that is shown in tooltips, drawers and timelines. Long silences are shown as unknown rather than assuming the previous state continued.' },
    ],
  },
  {
    id: 'anomaly-detection',
    title: 'Anomaly detection explained',
    category: 'Concepts',
    summary: 'Integrity signals reviewed by people, never automatic penalties.',
    blocks: [
      { type: 'p', text: 'Phase 9 introduces rules that flag unusual patterns: repetitive mouse signals, highly regular input intervals, unexpectedly long idle periods, unusual application switching, abnormal session lengths and unusual agent disconnections.' },
      { type: 'ul', items: ['Each finding carries a score, a confidence level, supporting evidence, severity and timestamps.', 'Findings move through New, Under review, Explained, Resolved or Dismissed with reviewer comments.', 'Findings are conversation starters. WorkPulse never takes automatic action against an employee.'] },
    ],
  },
  {
    id: 'privacy-and-security',
    title: 'Privacy and security',
    category: 'Privacy & security',
    summary: 'Data minimisation, transparency and the security measures in place.',
    blocks: [
      { type: 'h', text: 'What is never collected' },
      { type: 'ul', items: ['Raw keystrokes, typed text or passwords.', 'Clipboard contents, screenshots or screen recordings.', 'File contents, private messages or email bodies.', 'URLs with query strings or mouse coordinates.'] },
      { type: 'h', text: 'How data is protected' },
      { type: 'ul', items: ['HTTPS everywhere; JWT access tokens with refresh-token rotation and reuse detection.', 'Role-based access control enforced by the backend, with organisation-level isolation.', 'Device tokens stored hashed; local agent buffers encrypted with keys protected by Windows DPAPI.', 'Audit logging of administrative changes and employee-data access.', 'Configurable retention per policy; expired data is deleted by scheduled jobs.'] },
      { type: 'p', text: 'Policies are configured to the least intrusive level that meets the organisation\'s legitimate purpose, with the employee notice visible in the agent and in the portal.' },
    ],
  },
  {
    id: 'reports-and-exports',
    title: 'Reports and exports',
    category: 'Concepts',
    summary: 'Scheduled for Phase 10.',
    blocks: [
      { type: 'p', text: 'Daily, weekly and monthly employee reports, attendance, application usage, device health, team, department, anomaly, overtime and workforce-trend reports will be available in CSV, PDF and Excel with permission-aware export controls. Every export is recorded in the audit trail.' },
    ],
  },
  {
    id: 'faq',
    title: 'Frequently asked questions',
    category: 'FAQ',
    summary: 'Short answers to common questions.',
    blocks: [
      { type: 'h', text: 'Does WorkPulse read what I type?' },
      { type: 'p', text: 'No. Only aggregate counts of input events are collected (and only if the policy enables them), never key codes or text.' },
      { type: 'h', text: 'Why does my status say idle when I was in a meeting room?' },
      { type: 'p', text: 'Idle means your workstation saw no input beyond the threshold. It is informational. Declaring a break in the agent, or the correction workflow arriving in Phase 11, lets you add context.' },
      { type: 'h', text: 'Who can see my activity?' },
      { type: 'p', text: 'Your manager and team lead within their scope, HR and organisation admins, and auditors in read-only mode. Every access is logged and visible under audit logs.' },
      { type: 'h', text: 'Why is a device pending?' },
      { type: 'p', text: 'Your organisation requires IT approval for new registrations. Events are buffered locally until the device is approved.' },
      { type: 'h', text: 'Is the demo real data?' },
      { type: 'p', text: 'No. Guest Mode uses a simulated organisation generated by the platform. It can be reset at any time.' },
    ],
  },
];
