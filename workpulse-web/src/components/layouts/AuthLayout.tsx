import { Box, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { ThemeToggle } from '../common/ThemeToggle';

const POINTS = [
  { title: 'Context, not keystrokes', text: 'Application engagement, idle time and session state, never raw input or screenshots.' },
  { title: 'Transparent to employees', text: 'Every classification carries a reason, and every employee can see what is collected about them.' },
  { title: 'Evidence-based reviews', text: 'Anomalies are flagged for human review with supporting evidence, never automatic penalties.' },
];

/** Split-screen authentication frame: narrative on the left, form on the right; stacks on mobile. */
export function AuthLayout() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 6fr' } }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: 'var(--wp-nav)',
          color: 'var(--wp-nav-text)',
          p: { md: 5, lg: 7 },
        }}
      >
        <Brand light />
        <Box>
          <Typography variant="h1" sx={{ color: '#fff', fontSize: { md: 34, lg: 42 }, maxWidth: 520 }}>
            Workforce intelligence that explains itself.
          </Typography>
          <Stack spacing={2.5} sx={{ mt: 4, maxWidth: 480 }}>
            {POINTS.map((p) => (
              <Box key={p.title} sx={{ borderLeft: '2px solid var(--wp-primary)', pl: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff' }}>
                  {p.title}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {p.text}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          WorkPulse · Enterprise workforce intelligence
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Brand />
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <ThemeToggle />
          </Box>
        </Stack>
        <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', alignItems: 'center', py: 3 }}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Outlet />
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}
