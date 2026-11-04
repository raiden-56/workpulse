import { Box, Button, Chip, Grid, Link, List, ListItem, ListItemText, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import WifiTetheringOutlinedIcon from '@mui/icons-material/WifiTetheringOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import CoffeeOutlinedIcon from '@mui/icons-material/CoffeeOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { DonutChart } from '@/components/charts/DonutChart';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { EmptyState } from '@/components/common/EmptyState';
import { StaggerGroup, StaggerItem } from '@/components/common/MotionPage';
import { Panel } from '@/components/common/Panel';
import { StatCard } from '@/components/common/StatCard';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/constants/status';
import { ROUTES } from '@/constants/routes';
import type { DashboardOverviewResponse } from '@/types/dashboard';
import { formatDateTime, formatDuration, formatHours, formatPercent, humanize } from '@/utils/format';

export function PresenceKpis({ data, loading }: { data?: DashboardOverviewResponse; loading: boolean }) {
  const p = data?.presence;
  const h = data?.headcount;
  const tiles = [
    { label: 'Employees', value: h?.total ?? 0, hint: h ? `${h.active} active · ${h.onLeave} on leave` : undefined, icon: <PeopleOutlinedIcon />, tone: 'neutral' as const, to: ROUTES.employees },
    { label: 'Online now', value: p?.online ?? 0, hint: h ? `of ${h.active} active employees` : undefined, icon: <WifiTetheringOutlinedIcon />, tone: 'positive' as const, to: ROUTES.live },
    { label: 'Active / focus', value: (p?.activeApplication ?? 0) + (p?.focusSession ?? 0), hint: p ? `${p.focusSession} in focus sessions` : undefined, icon: <BoltOutlinedIcon />, tone: 'primary' as const, to: ROUTES.live },
    { label: 'Idle', value: p?.idle ?? 0, hint: 'No input beyond threshold', icon: <HourglassEmptyOutlinedIcon />, tone: 'warning' as const, to: `${ROUTES.live}?status=IDLE` },
    { label: 'In meetings', value: p?.meeting ?? 0, hint: 'Meeting app in foreground', icon: <VideocamOutlinedIcon />, tone: 'info' as const, to: `${ROUTES.live}?status=MEETING` },
    { label: 'On break', value: p?.onBreak ?? 0, hint: p ? `${p.locked} locked` : undefined, icon: <CoffeeOutlinedIcon />, tone: 'neutral' as const, to: `${ROUTES.live}?status=BREAK` },
    { label: 'Offline', value: p?.offline ?? 0, hint: p ? `${p.unknown} awaiting data` : undefined, icon: <PowerSettingsNewOutlinedIcon />, tone: 'critical' as const, to: `${ROUTES.live}?status=OFFLINE` },
    { label: 'Devices connected', value: data ? `${data.devices.connected}/${data.devices.approved}` : '0', hint: data ? `${data.devices.pending} pending · ${data.devices.degraded} degraded` : undefined, icon: <DevicesOutlinedIcon />, tone: 'neutral' as const, to: ROUTES.devices },
  ];
  return (
    <Grid container spacing={2}>
      <StaggerGroup>
        {tiles.map((t) => (
          <Grid key={t.label} size={{ xs: 6, sm: 4, md: 3 }}>
            <StaggerItem>
              <KpiLink to={t.to}>
                <StatCard label={t.label} value={t.value} hint={t.hint} icon={t.icon} tone={t.tone} loading={loading} />
              </KpiLink>
            </StaggerItem>
          </Grid>
        ))}
      </StaggerGroup>
    </Grid>
  );
}

function KpiLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Box component={RouterLink} to={to} sx={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      {children}
    </Box>
  );
}

export function AttendanceCard({ data }: { data: DashboardOverviewResponse }) {
  const a = data.attendance;
  return (
    <Panel title="Attendance today" subtitle="Employees with a logon session so far today">
      <Stack direction="row" spacing={3} alignItems="baseline">
        <Typography variant="h2" className="wp-tabular">
          {a.presentToday}
          <Typography component="span" variant="h5" color="text.secondary">
            {' '}
            / {a.expectedToday}
          </Typography>
        </Typography>
        <Chip size="small" label={`${formatPercent(a.presenceRate)} present`} color={a.presenceRate >= 80 ? 'success' : a.presenceRate >= 50 ? 'warning' : 'default'} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {a.employeesWithSessionsInRange} employees had sessions in the selected range. Shift rules, late arrivals and overtime arrive with the attendance module (Phase 7).
      </Typography>
    </Panel>
  );
}

export function DeviceHealthCard({ data }: { data: DashboardOverviewResponse }) {
  const d = data.devices;
  const rows = [
    { label: 'Healthy', value: d.healthy, color: '#4E8866' },
    { label: 'Degraded', value: d.degraded, color: '#C18B43' },
    { label: 'Offline', value: d.offline, color: '#B75E56' },
    { label: 'Pending approval', value: d.pending, color: '#8A8F8B' },
  ];
  return (
    <Panel title="Agent health" subtitle={`${d.total} registered devices`} actions={<Button size="small" component={RouterLink} to={ROUTES.devices}>Manage</Button>}>
      <Stack spacing={1}>
        {rows.map((r) => (
          <Stack key={r.label} direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: r.color }} />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {r.label}
            </Typography>
            <Typography variant="body2" className="wp-tabular">
              {r.value}
            </Typography>
          </Stack>
        ))}
        <Box sx={{ display: 'flex', height: 8, borderRadius: 1, overflow: 'hidden', bgcolor: 'var(--wp-surface-muted)', mt: 1 }} aria-hidden>
          {rows.map((r) => (d.total ? <Box key={r.label} sx={{ width: `${(r.value / d.total) * 100}%`, bgcolor: r.color }} /> : null))}
        </Box>
      </Stack>
    </Panel>
  );
}

export function AnomalyCard({ data }: { data: DashboardOverviewResponse }) {
  const a = data.anomalies;
  return (
    <Panel title="Anomaly alerts" subtitle="Human-reviewed integrity signals">
      {a.detectionEnabled ? (
        <Stack direction="row" spacing={3}>
          <StatInline label="Open" value={a.open} />
          <StatInline label="Under review" value={a.underReview} />
          <StatInline label="High severity" value={a.highSeverity} />
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Stack direction="row" spacing={3}>
            <StatInline label="Open" value={a.open} />
            <StatInline label="Under review" value={a.underReview} />
          </Stack>
          <Chip size="small" variant="outlined" label="Detection rules enabled in Phase 9" sx={{ alignSelf: 'flex-start' }} />
          <Typography variant="caption" color="text.secondary">
            Findings will carry evidence, confidence and a review workflow. Nothing is ever penalised automatically.
          </Typography>
        </Stack>
      )}
    </Panel>
  );
}

function StatInline({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography variant="h4" className="wp-tabular">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export function EngagementPanel({ data }: { data: DashboardOverviewResponse }) {
  const e = data.engagement;
  const items = [
    { key: 'DEVELOPMENT', value: e.developmentSeconds },
    { key: 'PRODUCTIVE', value: e.productiveSeconds },
    { key: 'COMMUNICATION', value: e.communicationSeconds },
    { key: 'MEETING', value: e.meetingSeconds },
    { key: 'RESEARCH', value: e.researchSeconds },
    { key: 'NEUTRAL', value: e.neutralSeconds },
    { key: 'UNPRODUCTIVE', value: e.unproductiveSeconds },
    { key: 'UNCLASSIFIED', value: e.unclassifiedSeconds },
  ].map((i) => ({ key: i.key, label: CATEGORY_LABELS[i.key] ?? humanize(i.key), value: i.value, color: CATEGORY_COLORS[i.key] }));
  return (
    <Panel title="Application engagement" subtitle="Foreground time by category (classification is configurable per role)">
      <DonutChart data={items} ariaLabel="Foreground time split by application category" centerValue={formatHours(e.totalForegroundSeconds)} centerLabel="foreground" />
      {e.unclassifiedSeconds > 0 && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {formatDuration(e.unclassifiedSeconds, { compact: true })} is unclassified: applications not yet in the catalogue are never assumed unproductive.
        </Typography>
      )}
    </Panel>
  );
}

export function TopApplicationsPanel({ data }: { data: DashboardOverviewResponse }) {
  return (
    <Panel title="Top applications" subtitle="Foreground time in the selected range">
      <HorizontalBarChart
        ariaLabel="Top applications by foreground time"
        data={data.topApplications.map((a) => ({ key: a.processName, label: a.appName ?? a.processName, seconds: a.seconds, category: a.category }))}
      />
    </Panel>
  );
}

export function DailyTrendPanel({ data, showEmployees = true }: { data: DashboardOverviewResponse; showEmployees?: boolean }) {
  return (
    <Panel title="Daily activity" subtitle="Foreground hours and active employees per day">
      <TrendLineChart data={data.daily} showEmployees={showEmployees} />
    </Panel>
  );
}

export function DepartmentsPanel({ data }: { data: DashboardOverviewResponse }) {
  return (
    <Panel title="Departments" subtitle="Current presence by department (no productivity rankings)" padded={false}>
      {data.departments.length === 0 ? (
        <EmptyState compact title="No departments in scope" />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Department</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Online</TableCell>
                <TableCell align="right">Active / focus / meeting</TableCell>
                <TableCell align="right">Idle</TableCell>
                <TableCell align="right">Offline</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.departments.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`${ROUTES.employees}?departmentId=${d.id}`} underline="hover">
                      {d.name}
                    </Link>
                  </TableCell>
                  <TableCell align="right" className="wp-tabular">{d.headcount}</TableCell>
                  <TableCell align="right" className="wp-tabular">{d.online}</TableCell>
                  <TableCell align="right" className="wp-tabular">{d.focusOrActive}</TableCell>
                  <TableCell align="right" className="wp-tabular">{d.idle}</TableCell>
                  <TableCell align="right" className="wp-tabular">{d.offline}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Panel>
  );
}

export function RecentActivityPanel({ data }: { data: DashboardOverviewResponse }) {
  return (
    <Panel title="Recent activity" subtitle="Latest session and state events" padded={false}>
      {data.recentActivity.length === 0 ? (
        <EmptyState compact title="No recent events" />
      ) : (
        <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {data.recentActivity.map((r, idx) => (
            <ListItem key={`${r.employeeId}-${r.occurredAt}-${idx}`} divider={idx < data.recentActivity.length - 1}>
              <ListItemText
                primary={
                  <Link component={RouterLink} to={ROUTES.employee(r.employeeId)} underline="hover" color="inherit">
                    {r.employeeName}
                  </Link>
                }
                secondary={`${r.detail ?? humanize(r.type)} · ${formatDateTime(r.occurredAt, data.timezone)}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Panel>
  );
}
