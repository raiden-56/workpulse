import { Button, Grid, Stack } from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useDashboardOverviewQuery } from '@/services/api/dashboardApi';
import { DateRangePicker } from '@/components/filters/DateRangePicker';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { PlannedModule } from '@/components/common/PlannedModule';
import { StatCard } from '@/components/common/StatCard';
import { PermissionGate } from '@/components/common/PermissionGate';
import { P } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { formatPercent } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { useOverviewFilters } from './useOverviewFilters';
import { AttendanceCard, DailyTrendPanel, DepartmentsPanel } from './widgets';

export function HrDashboard() {
  const { user } = useAuth();
  const filters = useOverviewFilters();
  const overview = useDashboardOverviewQuery(filters.query);
  const d = overview.data;

  return (
    <>
      <PageHeader
        title="HR dashboard"
        subtitle="Headcount, presence and the employee directory. Attendance rules, shifts and corrections arrive with Phase 7."
        eyebrow={user?.organizationName ?? undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to={ROUTES.employees} variant="outlined" size="small">
              Employee directory
            </Button>
            <PermissionGate permission={P.EMPLOYEE_CREATE} write>
              <Button component={RouterLink} to={`${ROUTES.employees}?new=1`} variant="contained" size="small" startIcon={<PersonAddAltOutlinedIcon />}>
                Add employee
              </Button>
            </PermissionGate>
          </Stack>
        }
      />
      <Stack sx={{ mb: 3 }}>
        <DateRangePicker value={filters.range} onChange={filters.setRange} timezone={filters.timezone} />
      </Stack>
      {overview.isLoading && <LoadingSkeleton variant="page" />}
      {overview.error ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> : null}
      {d && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard label="Headcount" value={d.headcount.total} hint={`${d.headcount.active} active`} tone="neutral" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard label="On leave" value={d.headcount.onLeave} hint={`${d.headcount.inactive} inactive`} tone="info" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard label="Present today" value={d.attendance.presentToday} hint={`of ${d.attendance.expectedToday} expected`} tone="positive" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard label="Presence rate" value={formatPercent(d.attendance.presenceRate)} hint={`${d.attendance.employeesWithSessionsInRange} with sessions in range`} tone="primary" />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <AttendanceCard data={d} />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <DailyTrendPanel data={d} />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <DepartmentsPanel data={d} />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <PlannedModule
              title="Attendance & timesheets"
              phase={7}
              description="Shift configuration, break tracking, late arrival and overtime calculations, attendance corrections with manager approvals and exports. Logon sessions are already being recorded, so history will be available on day one."
              compact
            />
          </Grid>
        </Grid>
      )}
    </>
  );
}
