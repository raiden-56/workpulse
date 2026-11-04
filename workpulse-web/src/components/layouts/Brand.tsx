import { Box, Stack, Typography } from '@mui/material';

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        bgcolor: 'var(--wp-nav)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.75} height={size * 0.75}>
        <path d="M6 20 L11 20 L13.5 11 L17 24 L20 14 L22 20 L26 20" fill="none" stroke="#7AA98A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
}

export function Brand({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <BrandMark />
      {!compact && (
        <Typography variant="h5" component="span" sx={{ color: light ? 'var(--wp-nav-text)' : 'text.primary', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          WorkPulse
        </Typography>
      )}
    </Stack>
  );
}
