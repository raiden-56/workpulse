import { Alert, Chip, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import type { AgentStatus } from '@shared/ipc';
import { KeyValue, PageTitle, Section } from '../components/common';

const CATEGORY_LABELS: Record<string, string> = {
  FOREGROUND_APPLICATION: 'Which application is in the foreground, and for how long',
  IDLE_TIME: 'Periods without keyboard or mouse input',
  SESSION_STATE: 'Windows sign-in, sign-out, lock and unlock',
  INPUT_SUMMARY: 'Counts of keyboard and mouse events per minute (never the keys themselves)',
  DEVICE_HEALTH: 'Agent version, connectivity and queue health',
};

const NEVER = [
  'Keystrokes, passwords or typed text',
  'Clipboard contents',
  'Screenshots or screen recordings',
  'Web page URLs, page content or browser history',
  'E-mail, chat or document contents',
  'File names or file contents',
  'Webcam, microphone or location',
  'Anything outside the collection window, except sign-in / sign-out',
];

export function PrivacyScreen({ status }: { status: AgentStatus }) {
  const policy = status.policy;
  return (
    <>
      <PageTitle title="Privacy information" subtitle="What this agent collects, why, and what it will never collect. The same information is available to you in the WorkPulse portal." />
      <Stack spacing={2}>
        <Section title="Your organisation's monitoring notice">
          {policy?.employeeNotice ? (
            <Typography variant="body1">{policy.employeeNotice}</Typography>
          ) : (
            <Alert severity="info">The monitoring notice is delivered with your organisation's policy once the device is registered.</Alert>
          )}
          {policy && (
            <KeyValue
              items={[
                ['Policy', `${policy.name} (version ${policy.version}, resolved from ${policy.resolvedFrom.toLowerCase()})`],
                ['Collection window', policy.collectionWindows.length ? policy.collectionWindows.map((w) => `${w.from}–${w.to} (${w.tz}) on days ${w.days.join(', ')}`).join('; ') : 'Always'],
                ['Sampling interval', `${policy.samplingIntervalSeconds} seconds`],
                ['Idle threshold', `${Math.round(policy.idleThresholdSeconds / 60)} minutes without input`],
                ['Data retention', `${policy.retentionDays} days on the server`],
                ['Window titles', policy.collectWindowTitles ? 'Hashed only (never the text)' : 'Not collected'],
                ['Excluded applications', policy.sensitiveAppExclusions.length ? policy.sensitiveAppExclusions.join(', ') : 'None configured'],
              ]}
            />
          )}
        </Section>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Section title="Collected (per policy)">
            <List dense disablePadding>
              {(policy?.dataCategories.length ? policy.dataCategories : Object.keys(CATEGORY_LABELS)).map((c) => (
                <ListItem key={c} disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircleOutlineIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={CATEGORY_LABELS[c] ?? c} secondary={<Chip size="small" variant="outlined" label={c} sx={{ mt: 0.5 }} />} />
                </ListItem>
              ))}
            </List>
          </Section>
          <Section title="Never collected">
            <List dense disablePadding>
              {NEVER.map((item) => (
                <ListItem key={item} disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <BlockIcon color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </Section>
        </Stack>
        <Section title="Your rights">
          <Typography variant="body2" color="text.secondary">
            You can see every record collected about you in the portal (Privacy &amp; Compliance → My data), request corrections for misclassified activity, and submit a deletion request subject to your organisation's retention rules. Monitoring never runs hidden: this window and the tray icon always show the current state.
          </Typography>
        </Section>
      </Stack>
    </>
  );
}
