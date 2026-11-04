import { useMemo, useState } from 'react';
import { presetRange, type DateRange } from '@/components/filters/DateRangePicker';
import { useAuth } from '@/hooks/useAuth';
import type { DashboardQuery } from '@/types/dashboard';

export function useOverviewFilters() {
  const { user } = useAuth();
  const tz = user?.organizationTimezone ?? null;
  const [range, setRange] = useState<DateRange>(() => presetRange('7d', tz));
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [teamId, setTeamId] = useState<string | undefined>();

  const query = useMemo<DashboardQuery>(() => ({ from: range.from, to: range.to, departmentId, teamId }), [range, departmentId, teamId]);

  return {
    range,
    setRange,
    departmentId,
    teamId,
    setStructure: (next: { departmentId?: string; teamId?: string }) => {
      setDepartmentId(next.departmentId);
      setTeamId(next.teamId);
    },
    query,
    timezone: tz,
  };
}
