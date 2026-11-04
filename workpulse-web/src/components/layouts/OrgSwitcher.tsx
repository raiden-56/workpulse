import { MenuItem, TextField } from '@mui/material';
import { useOrganizationsQuery } from '@/services/api/organizationApi';
import { useAuth } from '@/hooks/useAuth';

/** Lets a super admin pick which organisation's data the portal shows (X-Organization-Id header). */
export function OrgSwitcher() {
  const { isSuperAdmin, organizationOverride, selectOrganization } = useAuth();
  const orgs = useOrganizationsQuery(undefined, { skip: !isSuperAdmin });
  if (!isSuperAdmin) {
    return null;
  }
  return (
    <TextField
      select
      size="small"
      label="Organisation"
      value={organizationOverride ?? ''}
      onChange={(e) => selectOrganization(e.target.value || null)}
      sx={{ minWidth: 200, display: { xs: 'none', md: 'flex' } }}
      inputProps={{ 'aria-label': 'Select organisation' }}
    >
      <MenuItem value="">Platform (no organisation)</MenuItem>
      {(orgs.data ?? []).map((o) => (
        <MenuItem key={o.id} value={o.id}>
          {o.name}
          {o.demo ? ' · demo' : ''}
        </MenuItem>
      ))}
    </TextField>
  );
}
