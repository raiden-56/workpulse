import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { P } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';

/** Global search routes to the employee directory (the widest search surface in Phase 1). */
export function GlobalSearch() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const { can } = usePermission();
  const target = can(P.EMPLOYEE_VIEW) ? ROUTES.employees : can(P.LIVE_MONITORING_VIEW) ? ROUTES.live : null;
  if (!target) {
    return null;
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`${target}?q=${encodeURIComponent(value.trim())}`);
  };
  return (
    <>
      <form onSubmit={submit} role="search" style={{ display: 'contents' }}>
        <TextField
          size="small"
          placeholder="Search employees, devices…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputProps={{ 'aria-label': 'Global search' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { md: 260, lg: 320 }, display: { xs: 'none', md: 'flex' } }}
        />
      </form>
      <Tooltip title="Search">
        <IconButton size="small" aria-label="Search" onClick={() => navigate(target)} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
          <SearchIcon />
        </IconButton>
      </Tooltip>
    </>
  );
}
