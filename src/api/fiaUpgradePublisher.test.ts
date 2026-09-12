import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishFiaUpgradeSnapshot } from './fiaUpgradePublisher';
import type { FiaPublishedRaceArtifact } from '../types/fiaUpgradeAutomation';

const artifact: FiaPublishedRaceArtifact = { season: 2026, round: 13, grandPrix: 'Italian Grand Prix',
  generatedAt: '2026-09-04T09:54:00Z', source: 'FIA', documentUrl: 'https://www.fia.com/document.pdf', records: [], summaries: [] };
function client(hash: string | null, error: Error | null = null) {
  const upsert = vi.fn(() => ({ abortSignal: async () => ({ error }) }));
  const query = { select: () => query, eq: () => query, abortSignal: () => query,
    maybeSingle: async () => ({ data: hash ? { document_hash: hash } : null, error: null }), upsert };
  return { db: { from: () => query } as unknown as SupabaseClient, upsert };
}
describe('atomic FIA publication', () => {
  it('does not rewrite an unchanged document', async () => {
    const { db, upsert } = client('hash');
    expect(await publishFiaUpgradeSnapshot(db, artifact, 'hash')).toBe('unchanged');
    expect(upsert).not.toHaveBeenCalled();
  });
  it('replaces the full race, including an explicit zero declaration, in one upsert', async () => {
    const { db, upsert } = client('old');
    expect(await publishFiaUpgradeSnapshot(db, artifact, 'new')).toBe('published');
    expect(upsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ artifact, document_hash: 'new' }),
      { onConflict: 'season,round' });
  });
  it('propagates write failure without any delete or success result', async () => {
    const { db } = client(null, new Error('write failed'));
    await expect(publishFiaUpgradeSnapshot(db, artifact, 'new')).rejects.toThrow('write failed');
  });
});
