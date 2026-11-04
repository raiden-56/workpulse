import { MenuItem, Stack, TextField } from '@mui/material';
import { useDepartmentsQuery, useTeamsQuery } from '@/services/api/organizationApi';
import { usePermission } from '@/hooks/usePermission';
import { P } from '@/constants/permissions';

interface DepartmentTeamFilterProps {
  departmentId?: string;
  teamId?: string;
  onChange: (next: { departmentId?: string; teamId?: string }) => void;
  /** Hide the department select (e.g. for team leads). */
  hideDepartment?: boolean;
}

export function DepartmentTeamFilter({ departmentId, teamId, onChange, hideDepartment }: DepartmentTeamFilterProps) {
  const { can } = usePermission();
  const canDepartments = can(P.DEPARTMENT_VIEW);
  const canTeams = can(P.TEAM_VIEW);
  const departments = useDepartmentsQuery(undefined, { skip: !canDepartments });
  const teams = useTeamsQuery(departmentId ? { departmentId } : undefined, { skip: !canTeams });

  if (!canDepartments && !canTeams) {
    return null;
  }
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      {canDepartments && !hideDepartment && (
        <TextField
          select
          label="Department"
          value={departmentId ?? ''}
          onChange={(e) => onChange({ departmentId: e.target.value || undefined, teamId: undefined })}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All departments</MenuItem>
          {(departments.data ?? []).map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {canTeams && (
        <TextField select label="Team" value={teamId ?? ''} onChange={(e) => onChange({ departmentId, teamId: e.target.value || undefined })} sx={{ minWidth: 160 }}>
          <MenuItem value="">All teams</MenuItem>
          {(teams.data ?? []).map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}
