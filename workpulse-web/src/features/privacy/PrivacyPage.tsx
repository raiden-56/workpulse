import { Alert, Chip, Grid, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { useEffectivePolicyQuery } from '@/services/api/policiesApi';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { KeyValueList, Panel } from '@/components/common/Panel';
import { PlannedModule } from '@/components/common/PlannedModule';
import { formatDuration, humanize } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';

const COLLECTED: Record<string, string> = {
  FOREGROUND_APPLICATION: 'Which application is in the foreground, sampled at the policy interval and merged into usage blocks.',
  IDLE_TIME: 'When no keyboard or mouse input has been seen for longer than the idle threshold, and when input resumes.',
  SESSION_STATE: 'Windows sign-in, sign-out, lock and unlock events.',
  INPUT_SUMMARY: 'Aggregate counts of keyboard and mouse events per interval. Never key codes, text or coordinates.',
  DEVICE_HEALTH: 'Agent version, heartbeat and synchronisation status of the workstation.',
};

const NEVER = ['Raw keystrokes or typed text', 'Passwords or credentials', 'Clipboard contents', 'Screenshots or screen recordings', 'File contents or documents', 'Private messages, emails or chat bodies', 'Web page URLs with query strings', 'Mouse coordinates'];

export function PrivacyPage() {
  const { user } = useAuth();
  const policy = useEffectivePolicyQuery(undefined);

  return (
    <>
      <PageHeader title="Privacy & data" subtitle="What WorkPulse collects about you, why, and for how long. This page reflects the monitoring policy that applies to you." />
      {policy.isLoading && <LoadingSkeleton variant="page" />}
      {policy.error ? <ErrorState error={policy.error} onRetry={() => policy.refetch()} /> : null}
      {policy.data && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Alert severity="info" variant="outlined" icon={false}>
              <Typography variant="subtitle2">Monitoring notice · {policy.data.name} (v{policy.data.version})</Typography>
              <Typography variant="body2">{policy.data.employeeNotice ?? 'Application usage and idle time are recorded during working hours.'}</Typography>
            </Alert>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Panel title="What is collected" subtitle="Only the categories enabled by your policy">
              <List dense>
                {policy.data.dataCategories.map((c) => (
                  <ListItem key={c} alignItems="flex-start">
                    <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                      <CheckCircleOutlineIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={humanize(c)} secondary={COLLECTED[c] ?? 'Collected as configured by your organisation.'} />
                  </ListItem>
                ))}
              </List>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Never collected
              </Typography>
              <List dense>
                {NEVER.map((n) => (
                  <ListItem key={n}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <BlockOutlinedIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={n} />
                  </ListItem>
                ))}
              </List>
            </Panel>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              <Panel title="Policy parameters">
                <KeyValueList
                  items={[
                    { label: 'Applies to', value: user?.employeeId ? 'You (resolved from ' + policy.data.resolvedFrom.toLowerCase() + ' level)' : 'Organisation default' },
                    { label: 'Sampling interval', value: `${policy.data.samplingIntervalSeconds} seconds` },
                    { label: 'Idle threshold', value: formatDuration(policy.data.idleThresholdSeconds, { compact: true }) },
                    { label: 'Collection windows', value: policy.data.collectionWindows.length ? policy.data.collectionWindows.map((w) => `${w.from}–${w.to} ${w.tz ?? ''}`).join('; ') : 'Always' },
                    { label: 'Window titles', value: policy.data.collectWindowTitles ? 'Salted hashes only' : 'Not collected' },
                    { label: 'Retention', value: `${policy.data.retentionDays} days, then deleted` },
                  ]}
                />
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                  {policy.data.sensitiveAppExclusions.map((a) => (
                    <Chip key={a} size="small" variant="outlined" label={`${a} excluded`} className="wp-mono" />
                  ))}
                </Stack>
              </Panel>
              <PlannedModule
                compact
                title="Policy acknowledgement, my-data export and correction requests"
                phase={11}
                description="The privacy and compliance centre adds acknowledgement of the monitoring notice, a downloadable copy of your data, correction requests for misclassified intervals and deletion workflows, with full access history."
              />
            </Stack>
          </Grid>
        </Grid>
      )}
    </>
  );
}
