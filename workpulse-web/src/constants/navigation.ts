import type { SvgIconComponent } from '@mui/icons-material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import CorporateFareOutlinedIcon from '@mui/icons-material/CorporateFareOutlined';
import { P } from './permissions';
import { ROUTES } from './routes';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: SvgIconComponent;
  /** Any of these permissions grants visibility. Undefined = always visible. */
  permission?: string | string[];
  /** Module scaffolded but planned for a later phase. */
  planned?: boolean;
  section: 'overview' | 'workforce' | 'governance' | 'account';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: ROUTES.dashboard, icon: DashboardOutlinedIcon, permission: [P.DASHBOARD_VIEW, P.SELF_VIEW], section: 'overview' },
  { id: 'live', label: 'Live monitoring', path: ROUTES.live, icon: SensorsOutlinedIcon, permission: P.LIVE_MONITORING_VIEW, section: 'overview' },
  { id: 'employees', label: 'Employees', path: ROUTES.employees, icon: PeopleOutlinedIcon, permission: P.EMPLOYEE_VIEW, section: 'workforce' },
  { id: 'organization', label: 'Departments & teams', path: ROUTES.organization, icon: AccountTreeOutlinedIcon, permission: P.DEPARTMENT_VIEW, section: 'workforce' },
  { id: 'devices', label: 'Devices', path: ROUTES.devices, icon: DevicesOutlinedIcon, permission: P.DEVICE_VIEW, section: 'workforce' },
  { id: 'attendance', label: 'Attendance', path: ROUTES.attendance, icon: EventAvailableOutlinedIcon, permission: P.ATTENDANCE_VIEW, planned: true, section: 'workforce' },
  { id: 'applications', label: 'Applications', path: ROUTES.applications, icon: AppsOutlinedIcon, permission: P.APPLICATION_USAGE_VIEW, planned: true, section: 'workforce' },
  { id: 'anomalies', label: 'Anomalies', path: ROUTES.anomalies, icon: WarningAmberOutlinedIcon, permission: P.ANOMALY_VIEW, planned: true, section: 'workforce' },
  { id: 'reports', label: 'Reports', path: ROUTES.reports, icon: AssessmentOutlinedIcon, permission: P.REPORT_VIEW, planned: true, section: 'workforce' },
  { id: 'organizations', label: 'Organisations', path: ROUTES.organizations, icon: CorporateFareOutlinedIcon, permission: P.ORGANIZATION_CREATE, section: 'governance' },
  { id: 'users', label: 'Users & roles', path: ROUTES.users, icon: ManageAccountsOutlinedIcon, permission: P.USER_VIEW, section: 'governance' },
  { id: 'policies', label: 'Monitoring policies', path: ROUTES.policies, icon: PolicyOutlinedIcon, permission: P.POLICY_VIEW, section: 'governance' },
  { id: 'audit', label: 'Audit logs', path: ROUTES.audit, icon: HistoryOutlinedIcon, permission: P.AUDIT_LOG_VIEW, section: 'governance' },
  { id: 'notifications', label: 'Notifications', path: ROUTES.notifications, icon: NotificationsOutlinedIcon, permission: P.NOTIFICATION_VIEW, section: 'account' },
  { id: 'privacy', label: 'Privacy & data', path: ROUTES.privacy, icon: ShieldOutlinedIcon, permission: [P.PRIVACY_VIEW, P.SELF_VIEW, P.POLICY_VIEW], section: 'account' },
  { id: 'settings', label: 'Settings', path: ROUTES.settings, icon: SettingsOutlinedIcon, section: 'account' },
  { id: 'help', label: 'Help centre', path: ROUTES.help, icon: HelpOutlineOutlinedIcon, section: 'account' },
];

export const NAV_SECTION_LABELS: Record<NavItem['section'], string> = {
  overview: 'Overview',
  workforce: 'Workforce',
  governance: 'Governance',
  account: 'Account',
};
