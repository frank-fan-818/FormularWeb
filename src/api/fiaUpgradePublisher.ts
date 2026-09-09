import type { SupabaseClient } from '@supabase/supabase-js';
import type { FiaPublishedRaceArtifact } from '../types/fiaUpgradeAutomation';

/** Server-side only: caller supplies a service-role client. One upsert publishes the entire race atomically. */
export async function publishFiaUpgradeSnapshot(
  client: SupabaseClient, artifact: FiaPublishedRaceArtifact, documentHash: string,
): Promise<'published' | 'unchanged'> {
  const { data, error } = await client.from('fia_race_upgrade_snapshots')
    .select('document_hash').eq('season', artifact.season).eq('round', artifact.round)
    .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
  if (error) throw error;
  if (data?.document_hash === documentHash) return 'unchanged';
  const { error: writeError } = await client.from('fia_race_upgrade_snapshots').upsert({
    season: artifact.season, round: artifact.round, document_hash: documentHash,
    artifact, updated_at: artifact.generatedAt,
  }, { onConflict: 'season,round' }).abortSignal(AbortSignal.timeout(15_000));
  if (writeError) throw writeError;
  return 'published';
}
