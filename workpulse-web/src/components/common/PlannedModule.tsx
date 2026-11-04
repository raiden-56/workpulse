import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';

interface PlannedModuleProps {
  title: string;
  phase: number;
  description: string;
  compact?: boolean;
}

/** Honest placeholder for a module scheduled for a later phase. Never shows mock data. */
export function PlannedModule({ title, phase, description, compact }: PlannedModuleProps) {
  return (
    <Card sx={{ borderStyle: 'dashed' }}>
      <CardContent sx={{ py: compact ? 2 : 4 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <ConstructionOutlinedIcon color="disabled" />
          <div>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h5">{title}</Typography>
              <Chip size="small" label={`Planned for Phase ${phase}`} variant="outlined" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
              {description}
            </Typography>
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
