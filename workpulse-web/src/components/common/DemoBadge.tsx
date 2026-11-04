import { Chip, Tooltip } from '@mui/material';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

export function DemoBadge({ compact }: { compact?: boolean }) {
  return (
    <Tooltip title="You are exploring a simulated organisation. No real employee is monitored and nothing here is production data.">
      <Chip
        icon={<ScienceOutlinedIcon />}
        label={compact ? 'DEMO' : 'DEMO · simulated data'}
        size="small"
        color="warning"
        variant="outlined"
        sx={{ fontWeight: 700, letterSpacing: '0.04em' }}
        aria-label="Demo mode: simulated data"
      />
    </Tooltip>
  );
}
