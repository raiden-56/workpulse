import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link as RouterLink, useMatches, type Params } from 'react-router-dom';

export interface CrumbHandle {
  crumb?: string | ((params: Params<string>) => string);
}

function isCrumbHandle(value: unknown): value is CrumbHandle {
  return typeof value === 'object' && value !== null && 'crumb' in value;
}

export function Breadcrumbs() {
  const matches = useMatches();
  const crumbs = matches
    .filter((m) => isCrumbHandle(m.handle) && m.handle.crumb)
    .map((m) => {
      const handle = m.handle as CrumbHandle;
      const label = typeof handle.crumb === 'function' ? handle.crumb(m.params) : handle.crumb!;
      return { id: m.id, path: m.pathname, label };
    });
  if (crumbs.length <= 1) {
    return null;
  }
  return (
    <MuiBreadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="Breadcrumb" sx={{ mb: 2, '& .MuiBreadcrumbs-separator': { mx: 0.5 } }}>
      {crumbs.map((c, idx) =>
        idx === crumbs.length - 1 ? (
          <Typography key={c.id} variant="body2" color="text.primary" aria-current="page">
            {c.label}
          </Typography>
        ) : (
          <Link key={c.id} component={RouterLink} to={c.path} underline="hover" variant="body2" color="text.secondary">
            {c.label}
          </Link>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
