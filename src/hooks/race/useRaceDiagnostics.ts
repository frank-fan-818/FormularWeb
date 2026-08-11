import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createFlowId } from '@/utils/diagnostics';
import { createLoggerScope } from '@/utils/logger';

export type RaceAggregateState = 'loading' | 'ready' | 'partial' | 'blocked' | 'not_found';

export function getRaceAggregateState(input: {
  loading: boolean;
  hasRace: boolean;
  hasBlockingError: boolean;
  hasPartialError: boolean;
}): RaceAggregateState {
  if (input.loading && !input.hasRace) return 'loading';
  if (input.hasBlockingError && !input.hasRace) return 'blocked';
  if (!input.hasRace) return 'not_found';
  if (input.hasPartialError) return 'partial';
  return 'ready';
}

export function useRaceDiagnostics(season: string, round: string, section?: string) {
  const identity = `${season}:${round}`;
  const flowRef = useRef({ identity, flowId: createFlowId() });
  if (flowRef.current.identity !== identity) flowRef.current = { identity, flowId: createFlowId() };
  const flowId = flowRef.current.flowId;
  const scope = useMemo(() => createLoggerScope({
    flowId, feature: 'race_detail', season, round, section,
  }), [flowId, round, season, section]);
  const lastStateRef = useRef<string | null>(null);

  const logAggregateState = useCallback((state: RaceAggregateState, itemCount: number) => {
    const fingerprint = `${identity}:${section || ''}:${state}:${itemCount}`;
    if (lastStateRef.current === fingerprint) return;
    lastStateRef.current = fingerprint;
    scope.log({
      operation: 'context_aggregate',
      outcome: state === 'blocked' ? 'failed' : state === 'partial' ? 'degraded' : state === 'ready' ? 'succeeded' : 'empty',
      reasonCode: state === 'not_found' ? 'not_found' : undefined,
      itemCount,
    });
  }, [identity, scope, section]);

  useEffect(() => {
    scope.log({ operation: 'route_identity', outcome: 'started' });
  }, [scope]);

  return { flowId, scope, logAggregateState };
}
