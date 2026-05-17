import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('fia_car_upgrades')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  const { data: summaries, error: summaryError } = await supabase
    .from('fia_car_upgrade_summaries')
    .select('season, round, team, constructor_id, declared_upgrade_count, declared_upgrade_intensity')
    .order('season', { ascending: false })
    .order('round', { ascending: true })
    .limit(12);

  if (summaryError) {
    throw summaryError;
  }

  console.log(`fia_car_upgrades rows: ${count ?? 0}`);
  console.table(summaries || []);

  const { data: sourceRows, error: sourceError } = await supabase
    .from('fia_car_upgrades')
    .select('source_type, season, round');

  if (sourceError) {
    throw sourceError;
  }

  const sourceCounts = (sourceRows || []).reduce<Record<string, number>>((counts, row) => {
    const key = `${row.source_type}|${row.season}|${row.round ?? 'null'}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  console.log('source counts:', sourceCounts);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
