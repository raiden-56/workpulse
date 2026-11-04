import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PageTitle } from '../components/common';

const TOPICS: Array<{ q: string; a: string }> = [
  {
    q: 'What does the status banner mean?',
    a: 'Monitoring active: foreground application, idle time and session state are being recorded. Paused – outside working hours: only sign-in and sign-out are tracked. Stopped: the collector is not running. Awaiting approval: your device is registered but IT has not approved it yet; events are kept locally. Device revoked: IT disabled this device. Service not reachable: the Windows service is not running – contact IT.',
  },
  {
    q: 'Is idle time counted against me?',
    a: 'No. WorkPulse records that there was no keyboard or mouse input; it does not decide that you were not working. Managers see idle periods with context, and you can submit an explanation for any period from the portal (My activity → Request correction).',
  },
  {
    q: 'How do I take a break?',
    a: 'Use "Start break" on the Home screen. Declared breaks are recorded as break time, pause application sampling and are not counted as idle. Locking your workstation (Win + L) is also recorded as locked time.',
  },
  {
    q: 'What is never collected?',
    a: 'Keystrokes, passwords, clipboard, screenshots, web addresses, message or document contents, file contents, webcam, microphone or location. See the Privacy screen for the full list and your organisation’s notice.',
  },
  {
    q: 'The agent says the service is not reachable.',
    a: 'The WorkPulse background service (WorkPulseAgent) is stopped or still starting. Wait a minute; if it persists, open Diagnostics and share the details with IT. Nothing is collected while the service is down.',
  },
  {
    q: 'My device shows "Awaiting IT approval".',
    a: 'Registration succeeded but your organisation requires an administrator to approve new devices. Events are stored encrypted on this PC and sent automatically after approval.',
  },
  {
    q: 'What happens when I am offline?',
    a: 'Events are queued in an encrypted local store and sent when connectivity returns. The Sync screen shows the queue depth and the last successful sync. Nothing is discarded.',
  },
  {
    q: 'How do I see what has been collected about me?',
    a: 'Sign in to the WorkPulse portal and open My dashboard, My activity and Privacy → My data. Everything the server holds about you is visible there.',
  },
];

export function HelpScreen() {
  return (
    <>
      <PageTitle title="Help centre" subtitle="Quick answers for employees. The full user manual is available inside the WorkPulse portal." />
      <Stack spacing={1}>
        {TOPICS.map((t) => (
          <Accordion key={t.q} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">
                {t.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </>
  );
}
