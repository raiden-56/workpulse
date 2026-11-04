import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useActivateAccountMutation } from '@/services/api/authApi';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';
import { passwordSchema } from './ResetPasswordPage';

type Form = z.infer<typeof passwordSchema>;

export function ActivatePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [activate, state] = useActivateAccountMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = handleSubmit((values) => activate({ token, password: values.password }).unwrap().catch(() => undefined));

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h3" component="h1">
        Activate your account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Set a password to finish setting up your WorkPulse account.
      </Typography>
      {!token && <Alert severity="warning" sx={{ mb: 2 }}>This activation link is missing its token. Ask your administrator for a new invitation.</Alert>}
      {state.error ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(state.error)}</Alert> : null}
      {state.isSuccess ? (
        <Stack spacing={2}>
          <Alert severity="success">Your account is active. You can sign in now.</Alert>
          <Button component={RouterLink} to={ROUTES.login} variant="contained">
            Go to sign in
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <TextField label="Password" type="password" autoComplete="new-password" autoFocus fullWidth error={!!errors.password} helperText={errors.password?.message} {...register('password')} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" fullWidth error={!!errors.confirm} helperText={errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" variant="contained" size="large" disabled={!token || state.isLoading}>
            {state.isLoading ? 'Activating…' : 'Activate account'}
          </Button>
        </Stack>
      )}
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to={ROUTES.login}>
          Back to sign in
        </Link>
      </Typography>
    </Box>
  );
}
