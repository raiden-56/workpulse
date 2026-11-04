import { useAuth } from '@/hooks/useAuth';
import { OverviewDashboard } from './OverviewDashboard';
import { HrDashboard } from './HrDashboard';
import { ItDashboard } from './ItDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';
import { AuditorDashboard } from './AuditorDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';

/** Picks the dashboard composition for the signed-in principal (or the demo guest's persona). */
export function DashboardRouter() {
  const { dashboardKind } = useAuth();
  switch (dashboardKind) {
    case 'superAdmin':
      return <SuperAdminDashboard />;
    case 'executive':
      return <OverviewDashboard variant="executive" />;
    case 'manager':
      return <OverviewDashboard variant="manager" />;
    case 'teamLead':
      return <OverviewDashboard variant="teamLead" />;
    case 'hr':
      return <HrDashboard />;
    case 'it':
      return <ItDashboard />;
    case 'auditor':
      return <AuditorDashboard />;
    case 'employee':
    default:
      return <EmployeeDashboard />;
  }
}
