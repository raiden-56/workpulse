import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Grid, Link, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/store/hooks';
import { loggedIn } from '@/app/store/slices/authSlice';
import { useLoginMutation } from '@/services/api/authApi';
import { useGuestConfigQuery, useStartGuestSessionMutation } from '@/services/api/guestApi';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';
import { ErrorState } from '@/components/common/ErrorState';

/** Public demo entry: pick a persona and start a read-only session on the simulated organisation. */
export function GuestEntryPage() {
  const config = useGuestConfigQuery();
  const [start, startState] = useStartGuestSessionMutation();
  const [login, loginState] = useLoginMutation();
  const [persona, setPersona] = useState<string>('EXECUTIVE');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const begin = async () => {
    try {
      const tokens = await start({ persona }).unwrap();
      dispatch(loggedIn(tokens));
      navigate(ROUTES.root, { replace: true });
    } catch {
      // rendered below
    }
  };

  const signInAs = async (email: string, password: string) => {
    try {
      const tokens = await login({ email, password }).unwrap();
      dispatch(loggedIn(tokens));
      navigate(ROUTES.root, { replace: true });
    } catch {
      // rendered below
    }
  };

  return (
    <Box>
      <Button component={RouterLink} to={ROUTES.login} startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1, ml: -1 }}>
        Back to sign in
      </Button>
      <Typography variant="h3" component="h1">
        Explore WorkPulse as a guest
      </Typography>
      {config.isLoading && <Skeleton height={120} sx={{ mt: 2 }} />}
      {config.error ? <ErrorState error={config.error} onRetry={() => config.refetch()} /> : null}
      {config.data && !config.data.enabled && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Guest Mode is not enabled on this deployment. Ask your administrator for an invitation instead.
        </Alert>
      )}
      {config.data?.enabled && (
        <>
          <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
            {config.data.notice} Sessions last {config.data.sessionTtlMinutes} minutes and are read-only.
          </Alert>
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
            Choose the experience to explore
          </Typography>
          <Grid container spacing={1.5}>
            {config.data.personas.map((p) => {
              const selected = p.code === persona;
              return (
                <Grid key={p.code} size={{ xs: 12, sm: 6 }}>
                  <Card sx={{ borderColor: selected ? 'primary.main' : undefined, borderWidth: selected ? 2 : 1, height: '100%' }}>
                    <CardActionArea onClick={() => setPersona(p.code)} aria-pressed={selected} sx={{ height: '100%', alignItems: 'stretch' }}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2">{p.label}</Typography>
                          {selected && <Chip size="small" color="primary" label="Selected" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {p.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
          {startState.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(startState.error)}
            </Alert>
          ) : null}
          <Button variant="contained" size="large" fullWidth sx={{ mt: 2 }} onClick={begin} disabled={startState.isLoading}>
            {startState.isLoading ? 'Starting demo…' : 'Start demo session'}
          </Button>

          {config.data.demoLogins.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle1">Or sign in with a demo role account</Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                These accounts live inside <strong>{config.data.organizationName}</strong> and show each role's real permissions, including write actions on simulated data.
              </Typography>
              {loginState.error ? (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {errorMessage(loginState.error)}
                </Alert>
              ) : null}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {config.data.demoLogins.map((d) => (
                    <TableRow key={d.email}>
                      <TableCell>{d.label}</TableCell>
                      <TableCell className="wp-mono">{d.email}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => signInAs(d.email, d.password)} disabled={loginState.isLoading}>
                          Sign in
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                Password for all demo accounts: <span className="wp-mono">{config.data.demoLogins[0]?.password}</span>. Learn more in the{' '}
                <Link component={RouterLink} to={ROUTES.help}>
                  help centre
                </Link>
                .
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
