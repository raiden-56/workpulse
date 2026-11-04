import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { z } from 'zod';
import { useForgotPasswordMutation } from '@/services/api/authApi';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';
import { CopyField } from '@/components/common/CopyField';

const schema = z.object({ email: z.email('Enter a valid work email') });
type Form = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [request, state] = useForgotPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit((values) => request(values).unwrap().catch(() => undefined));

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h3" component="h1">
        Reset your password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Enter your work email and we will send reset instructions if an account exists.
      </Typography>
      {state.error ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(state.error)}</Alert> : null}
      {state.data ? (
        <Stack spacing={2}>
          <Alert severity="success">{state.data.message}</Alert>
          {state.data.developmentResetToken && (
            <>
              <CopyField
                label="Development reset token"
                value={state.data.developmentResetToken}
                helperText="Email delivery is not configured on this environment, so the token is shown here for development only."
              />
              <Button component={RouterLink} to={`${ROUTES.resetPassword}?token=${encodeURIComponent(state.data.developmentResetToken)}`} variant="contained">
                Continue to reset
              </Button>
            </>
          )}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <TextField label="Work email" type="email" autoComplete="email" autoFocus fullWidth error={!!errors.email} helperText={errors.email?.message} {...register('email')} />
          <Button type="submit" variant="contained" size="large" disabled={state.isLoading}>
            {state.isLoading ? 'Sending…' : 'Send reset instructions'}
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
