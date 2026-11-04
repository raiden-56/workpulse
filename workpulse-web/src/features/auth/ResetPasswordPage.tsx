import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useResetPasswordMutation } from '@/services/api/authApi';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';

export const passwordSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters').max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type Form = z.infer<typeof passwordSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [reset, state] = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = handleSubmit((values) => reset({ token, password: values.password }).unwrap().catch(() => undefined));

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h3" component="h1">
        Choose a new password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Passwords must be at least 10 characters. All other sessions are signed out after the change.
      </Typography>
      {!token && <Alert severity="warning" sx={{ mb: 2 }}>This link is missing its reset token. Request a new one from the sign-in page.</Alert>}
      {state.error ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(state.error)}</Alert> : null}
      {state.data ? (
        <Stack spacing={2}>
          <Alert severity="success">{state.data.message}</Alert>
          <Button component={RouterLink} to={ROUTES.login} variant="contained">
            Go to sign in
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <TextField label="New password" type="password" autoComplete="new-password" autoFocus fullWidth error={!!errors.password} helperText={errors.password?.message} {...register('password')} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" fullWidth error={!!errors.confirm} helperText={errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" variant="contained" size="large" disabled={!token || state.isLoading}>
            {state.isLoading ? 'Updating…' : 'Update password'}
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
