import { Box, Card, CardContent, Grid, Skeleton, Stack } from '@mui/material';

interface LoadingSkeletonProps {
  variant?: 'cards' | 'table' | 'page' | 'list';
  rows?: number;
}

export function LoadingSkeleton({ variant = 'page', rows = 6 }: LoadingSkeletonProps) {
  if (variant === 'cards') {
    return (
      <Grid container spacing={2} aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Skeleton width="50%" />
                <Skeleton width="30%" height={36} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }
  if (variant === 'table' || variant === 'list') {
    return (
      <Stack spacing={1} aria-busy="true" aria-label="Loading" sx={{ p: 1 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height={40} variant="rounded" />
        ))}
      </Stack>
    );
  }
  return (
    <Box aria-busy="true" aria-label="Loading">
      <Skeleton width="40%" height={36} />
      <Skeleton width="70%" />
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" height={96} />
          </Grid>
        ))}
        <Grid size={{ xs: 12, md: 8 }}>
          <Skeleton variant="rounded" height={280} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Skeleton variant="rounded" height={280} />
        </Grid>
      </Grid>
    </Box>
  );
}
