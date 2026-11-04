import { useEffect, useMemo, useRef, useState } from 'react';
import type { LiveQuery, LiveStatusDelta, LiveStatusResponse } from '@/types/activity';
import { useLiveStatusQuery } from '@/services/api/activityApi';
import { connectLiveSocket } from '@/services/liveSocket';
import { useAuth } from './useAuth';

const POLL_MS = 30_000;

/**
 * Live rows = latest poll result overlaid with WebSocket deltas received since that poll.
 * The socket is an optimisation; polling always continues.
 */
export function useLiveStatus(query: LiveQuery) {
  const { accessToken, effectiveOrganizationId } = useAuth();
  const result = useLiveStatusQuery(query, { pollingInterval: POLL_MS, refetchOnMountOrArgChange: true });
  const [deltas, setDeltas] = useState<Record<string, LiveStatusDelta>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    if (result.fulfilledTimeStamp && result.fulfilledTimeStamp !== lastFetchRef.current) {
      lastFetchRef.current = result.fulfilledTimeStamp;
      // Drop deltas older than the fresh server snapshot.
      setDeltas((current) => {
        const next: Record<string, LiveStatusDelta> = {};
        for (const [id, delta] of Object.entries(current)) {
          if (new Date(delta.updatedAt).getTime() > result.fulfilledTimeStamp!) {
            next[id] = delta;
          }
        }
        return next;
      });
    }
  }, [result.fulfilledTimeStamp]);

  useEffect(() => {
    if (!accessToken || !effectiveOrganizationId) {
      return undefined;
    }
    const dispose = connectLiveSocket({
      token: accessToken,
      organizationId: effectiveOrganizationId,
      onDelta: (delta) => setDeltas((current) => ({ ...current, [delta.employeeId]: delta })),
      onStateChange: setSocketConnected,
    });
    return dispose;
  }, [accessToken, effectiveOrganizationId]);

  const rows = useMemo<LiveStatusResponse[]>(() => {
    const items = result.data?.items ?? [];
    return items.map((row) => {
      const delta = deltas[row.employeeId];
      if (!delta) {
        return row;
      }
      return {
        ...row,
        status: delta.status,
        foregroundApp: delta.foregroundApp ?? null,
        foregroundProcess: delta.foregroundProcess ?? null,
        sinceAt: delta.since ?? row.sinceAt,
        sessionStartedAt: delta.sessionStartedAt ?? row.sessionStartedAt,
        reason: delta.reason ?? row.reason,
        lastSyncAt: delta.updatedAt,
      };
    });
  }, [result.data, deltas]);

  return { ...result, rows, meta: result.data?.meta, socketConnected };
}
