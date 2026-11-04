import { Alert, Box, Button, Divider, Link, Stack, TextField, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { loggedIn, noticeCleared } from '@/app/store/slices/authSlice';
import { useLoginMutation } from '@/services/api/authApi';
import { ROUTES } from '@/constants/routes';
import { errorMessage } from '@/utils/errors';

const schema = z.object({
  email: z.email('Enter a valid work email'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector((s) => s.auth.notice);
  const navigate = useNavigate();
  const location = useLocation();
  const [login, loginState] = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => () => {
    if (notice) {
      dispatch(noticeCleared());
    }
  }, [dispatch, notice]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const tokens = await login(values).unwrap();
      dispatch(loggedIn(tokens));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== ROUTES.login ? from : ROUTES.root, { replace: true });
    } catch {
      // the error is rendered from loginState.error
    }
  });

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h3" component="h1">
        Sign in
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Use your WorkPulse account to access your organisation.
      </Typography>
      {notice && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      {loginState.error ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {errorMessage(loginState.error)}
        </Alert>
      ) : null}
      <Stack spacing={2}>
        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          autoFocus
          fullWidth
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          fullWidth
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <Stack direction="row" justifyContent="flex-end">
          <Link component={RouterLink} to={ROUTES.forgotPassword} variant="body2">
            Forgot password?
          </Link>
        </Stack>
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting || loginState.isLoading}>
          {loginState.isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Stack>
      <Divider sx={{ my: 3 }}>or</Divider>
      <Button component={RouterLink} to={ROUTES.guest} variant="outlined" size="large" fullWidth>
        Continue as Guest
      </Button>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, textAlign: 'center' }}>
        Explore every module on a simulated organisation, no account required. Single sign-on with Microsoft Entra ID arrives in Phase 12.
      </Typography>
    </Box>
  );
}
