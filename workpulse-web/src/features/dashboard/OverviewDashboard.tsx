import { Button, Chip, Grid, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useDashboardOverviewQuery } from '@/services/api/dashboardApi';
import { DateRangePicker } from '@/components/filters/DateRangePicker';
import { DepartmentTeamFilter } from '@/components/filters/DepartmentTeamFilter';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { useOverviewFilters } from './useOverviewFilters';
import { AnomalyCard, AttendanceCard, DailyTrendPanel, DepartmentsPanel, DeviceHealthCard, EngagementPanel, PresenceKpis, RecentActivityPanel, TopApplicationsPanel } from './widgets';

interface OverviewDashboardProps {
  variant: 'executive' | 'manager' | 'teamLead';
}

const TITLES: Record<OverviewDashboardProps['variant'], { title: string; subtitle: string }> = {
  executive: { title: 'Executive dashboard', subtitle: 'Organisation-wide presence, engagement and device health. Every number comes from agent events in the selected range.' },
  manager: { title: 'Department dashboard', subtitle: 'Presence, engagement and activity for the departments you manage.' },
  teamLead: { title: 'Team dashboard', subtitle: 'Presence, engagement and activity for your team.' },
};

export function OverviewDashboard({ variant }: OverviewDashboardProps) {
  const { user } = useAuth();
  const filters = useOverviewFilters();
  const overview = useDashboardOverviewQuery(filters.query, { refetchOnMountOrArgChange: 30 });
  const copy = TITLES[variant];

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        eyebrow={user?.organizationName ?? undefined}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {overview.data && <Chip size="small" variant="outlined" label={`Scope: ${overview.data.scopeLevel.toLowerCase()}`} />}
            <Button component={RouterLink} to={ROUTES.live} variant="outlined" size="small">
              Live monitoring
            </Button>
          </Stack>
        }
      />
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 3 }} alignItems={{ lg: 'center' }}>
        <DateRangePicker value={filters.range} onChange={filters.setRange} timezone={filters.timezone} />
        <DepartmentTeamFilter departmentId={filters.departmentId} teamId={filters.teamId} onChange={filters.setStructure} hideDepartment={variant === 'teamLead'} />
      </Stack>

      {overview.isLoading && <LoadingSkeleton variant="page" />}
      {overview.error ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> : null}
      {overview.data && (
        <Stack spacing={3}>
          <PresenceKpis data={overview.data} loading={overview.isFetching && !overview.data} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <AttendanceCard data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DeviceHealthCard data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <AnomalyCard data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <DailyTrendPanel data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <EngagementPanel data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <TopApplicationsPanel data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <DepartmentsPanel data={overview.data} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <RecentActivityPanel data={overview.data} />
            </Grid>
          </Grid>
        </Stack>
      )}
    </>
  );
}
