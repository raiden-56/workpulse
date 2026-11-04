import { Box, Chip, Tooltip, type ChipProps } from '@mui/material';
import { ACTIVITY_STATUS_META, DEVICE_HEALTH_META, DEVICE_STATUS_META, type StatusMeta } from '@/constants/status';
import type { ActivityState } from '@/types/activity';
import type { DeviceHealth, DeviceStatus } from '@/types/devices';
import { humanize } from '@/utils/format';

type Kind = 'activity' | 'deviceStatus' | 'deviceHealth' | 'generic';

interface StatusChipProps {
  kind?: Kind;
  value: string;
  /** Explanation shown in the tooltip (e.g. the classification reason). */
  reason?: string | null;
  size?: ChipProps['size'];
  color?: string;
}

function metaFor(kind: Kind, value: string, color?: string): StatusMeta {
  switch (kind) {
    case 'activity':
      return ACTIVITY_STATUS_META[value as ActivityState] ?? { label: humanize(value), color: color ?? '#B8BDB9', description: '' };
    case 'deviceStatus':
      return DEVICE_STATUS_META[value as DeviceStatus] ?? { label: humanize(value), color: color ?? '#B8BDB9', description: '' };
    case 'deviceHealth':
      return DEVICE_HEALTH_META[value as DeviceHealth] ?? { label: humanize(value), color: color ?? '#B8BDB9', description: '' };
    default:
      return { label: humanize(value), color: color ?? '#8A8F8B', description: '' };
  }
}

export function StatusChip({ kind = 'generic', value, reason, size = 'small', color }: StatusChipProps) {
  const meta = metaFor(kind, value, color);
  const chip = (
    <Chip
      size={size}
      label={meta.label}
      aria-label={`${meta.label}${reason ? `: ${reason}` : ''}`}
      icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color, ml: 1, display: 'inline-block' }} />}
      sx={{
        fontWeight: 600,
        bgcolor: `${meta.color}1F`,
        color: 'text.primary',
        '& .MuiChip-icon': { color: meta.color },
      }}
    />
  );
  const tip = reason || meta.description;
  return tip ? <Tooltip title={tip}>{chip}</Tooltip> : chip;
}
