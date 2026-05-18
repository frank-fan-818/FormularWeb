import type {
  FiaCarUpgradeRecord,
  FiaCarUpgradeSummary,
  FiaUpgradeReason,
} from '@/utils/fiaCarUpgrades';
import { summarizeFiaCarUpgrades } from '@/utils/fiaCarUpgrades';
import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';

interface FiaCarUpgradeArtifact {
  generatedAt: string;
  source: string;
  records: FiaCarUpgradeRecord[];
  summaries: FiaCarUpgradeSummary[];
}

type FiaCarUpgradeRow = {
  season: number;
  round: number | null;
  grand_prix: string | null;
  team: string;
  car_number: string | null;
  area: string | null;
  component: string | null;
  primary_reason: FiaUpgradeReason | null;
  geometric_differences: string | null;
  description: string | null;
  component_importance: number | string | null;
  confidence: number | string | null;
  source_type: FiaCarUpgradeRecord['sourceType'] | null;
  document_title: string | null;
  document_url: string | null;
  source_path: string | null;
  raw_text: string | null;
  imported_at: string | null;
};

type FiaCarUpgradeSummaryRow = {
  season: number;
  round: number | null;
  grand_prix: string | null;
  team: string;
  declared_upgrade_count: number | string | null;
  declared_upgrade_intensity: number | string | null;
  performance_intent: number | string | null;
  circuit_specific_intent: number | string | null;
  reliability_intent: number | string | null;
  cooling_intent: number | string | null;
  max_component_importance: number | string | null;
};

export interface FiaRaceUpgradeTeamSummary extends FiaCarUpgradeSummary {
  records: FiaCarUpgradeRecord[];
  dominantReason: FiaUpgradeReason;
  componentNames: string[];
  documentTitle?: string;
  documentUrl?: string;
}

export interface FiaRaceUpgradeSummary {
  season: number;
  round: number;
  grandPrix?: string;
  source: string;
  generatedAt: string;
  teams: FiaRaceUpgradeTeamSummary[];
  totalDeclaredUpgradeCount: number;
  totalDeclaredUpgradeIntensity: number;
  sourceDocuments: Array<{
    title: string;
    url?: string;
  }>;
}

const FIA_UPGRADE_SOURCE = 'FIA Car Presentation Submissions';
const FIA_UPGRADE_COLUMNS = [
  'season',
  'round',
  'grand_prix',
  'team',
  'car_number',
  'area',
  'component',
  'primary_reason',
  'geometric_differences',
  'description',
  'component_importance',
  'confidence',
  'source_type',
  'document_title',
  'document_url',
  'source_path',
  'raw_text',
  'imported_at',
].join(', ');
const FIA_UPGRADE_SUMMARY_COLUMNS = [
  'season',
  'round',
  'grand_prix',
  'team',
  'declared_upgrade_count',
  'declared_upgrade_intensity',
  'performance_intent',
  'circuit_specific_intent',
  'reliability_intent',
  'cooling_intent',
  'max_component_importance',
].join(', ');

function toNumber(value: string | number | null | undefined) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toNumberOrZero(value: string | number | null | undefined) {
  return toNumber(value) ?? 0;
}

function getDominantReason(summary: FiaCarUpgradeSummary): FiaUpgradeReason {
  const reasons: Array<[FiaUpgradeReason, number]> = [
    ['Performance', summary.performanceIntent],
    ['Circuit specific', summary.circuitSpecificIntent],
    ['Reliability', summary.reliabilityIntent],
    ['Cooling', summary.coolingIntent],
  ];
  const [reason, share] = reasons.sort((a, b) => b[1] - a[1])[0];
  return share > 0 ? reason : 'Unknown';
}

function getUniqueComponents(records: FiaCarUpgradeRecord[]) {
  const components = records
    .map((record) => record.component || record.area)
    .filter((value): value is string => Boolean(value));

  return [...new Set(components)].slice(0, 4);
}

function getSourceDocuments(records: FiaCarUpgradeRecord[]) {
  const seen = new Set<string>();

  return records.flatMap((record) => {
    const title = record.documentTitle || record.sourcePath || record.documentUrl;
    if (!title) {
      return [];
    }

    const key = `${title}|${record.documentUrl || ''}`;
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [{
      title,
      url: record.documentUrl,
    }];
  });
}

function mapUpgradeRow(row: FiaCarUpgradeRow): FiaCarUpgradeRecord {
  return {
    season: row.season,
    round: row.round ?? undefined,
    grandPrix: row.grand_prix ?? undefined,
    sourceType: row.source_type || 'FIA',
    team: row.team,
    carNumber: row.car_number ?? undefined,
    area: row.area ?? undefined,
    component: row.component ?? undefined,
    primaryReason: row.primary_reason || 'Unknown',
    geometricDifferences: row.geometric_differences ?? undefined,
    description: row.description ?? undefined,
    rawText: row.raw_text || '',
    confidence: toNumberOrZero(row.confidence),
    componentImportance: toNumberOrZero(row.component_importance),
    documentTitle: row.document_title ?? undefined,
    documentUrl: row.document_url ?? undefined,
    sourcePath: row.source_path ?? undefined,
  };
}

function mapSummaryRow(row: FiaCarUpgradeSummaryRow): FiaCarUpgradeSummary {
  return {
    season: row.season,
    round: row.round ?? undefined,
    grandPrix: row.grand_prix ?? undefined,
    team: row.team,
    declaredUpgradeCount: toNumberOrZero(row.declared_upgrade_count),
    declaredUpgradeIntensity: toNumberOrZero(row.declared_upgrade_intensity),
    performanceIntent: toNumberOrZero(row.performance_intent),
    circuitSpecificIntent: toNumberOrZero(row.circuit_specific_intent),
    reliabilityIntent: toNumberOrZero(row.reliability_intent),
    coolingIntent: toNumberOrZero(row.cooling_intent),
    maxComponentImportance: toNumberOrZero(row.max_component_importance),
  };
}

function getLatestImportedAt(records: FiaCarUpgradeRow[]) {
  const importedAtValues = records
    .map((record) => record.imported_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  return importedAtValues[importedAtValues.length - 1] || '';
}

export function buildFiaRaceUpgradeSummary(
  sourceArtifact: FiaCarUpgradeArtifact,
  season: string | number,
  round: string | number | undefined,
): FiaRaceUpgradeSummary | null {
  const seasonNumber = toNumber(season);
  const roundNumber = toNumber(round);

  if (seasonNumber === null || roundNumber === null) {
    return null;
  }

  const records = sourceArtifact.records.filter((record) =>
    record.season === seasonNumber && record.round === roundNumber,
  );
  const summaries = sourceArtifact.summaries.filter((summary) =>
    summary.season === seasonNumber && summary.round === roundNumber,
  );

  if (!records.length && !summaries.length) {
    return null;
  }

  const recordsByTeam = new Map<string, FiaCarUpgradeRecord[]>();
  records.forEach((record) => {
    recordsByTeam.set(record.team, [...(recordsByTeam.get(record.team) || []), record]);
  });

  const teams = summaries
    .map((summary) => {
      const teamRecords = [...(recordsByTeam.get(summary.team) || [])]
        .sort((a, b) => b.componentImportance - a.componentImportance);

      return {
        ...summary,
        records: teamRecords,
        dominantReason: getDominantReason(summary),
        componentNames: getUniqueComponents(teamRecords),
        documentTitle: teamRecords[0]?.documentTitle,
        documentUrl: teamRecords[0]?.documentUrl,
      };
    })
    .sort((a, b) =>
      b.declaredUpgradeIntensity - a.declaredUpgradeIntensity
      || b.declaredUpgradeCount - a.declaredUpgradeCount
      || a.team.localeCompare(b.team),
    );

  return {
    season: seasonNumber,
    round: roundNumber,
    grandPrix: teams[0]?.grandPrix || records[0]?.grandPrix,
    source: sourceArtifact.source,
    generatedAt: sourceArtifact.generatedAt,
    teams,
    totalDeclaredUpgradeCount: teams.reduce((total, team) => total + team.declaredUpgradeCount, 0),
    totalDeclaredUpgradeIntensity: teams.reduce((total, team) => total + team.declaredUpgradeIntensity, 0),
    sourceDocuments: getSourceDocuments(records),
  };
}

export function buildFiaRaceUpgradeSummaryFromRows(
  records: FiaCarUpgradeRecord[],
  summaries: FiaCarUpgradeSummary[],
  season: string | number,
  round: string | number | undefined,
  generatedAt = '',
): FiaRaceUpgradeSummary | null {
  return buildFiaRaceUpgradeSummary({
    generatedAt,
    source: FIA_UPGRADE_SOURCE,
    records,
    summaries: summaries.length ? summaries : summarizeFiaCarUpgrades(records),
  }, season, round);
}

async function getRaceUpgradeRows(season: number, round: number) {
  const query = supabase
    .from('fia_car_upgrades')
    .select(FIA_UPGRADE_COLUMNS)
    .eq('season', season)
    .eq('round', round)
    .order('team')
    .order('component_importance', { ascending: false });
  const { data, error } = await measureRequest('supabase', 'fia_car_upgrades.getRaceRows', async () => query);

  if (error) {
    throw error;
  }

  return (data || []) as unknown as FiaCarUpgradeRow[];
}

async function getRaceUpgradeSummaryRows(season: number, round: number) {
  const query = supabase
    .from('fia_car_upgrade_summaries')
    .select(FIA_UPGRADE_SUMMARY_COLUMNS)
    .eq('season', season)
    .eq('round', round);
  const { data, error } = await measureRequest('supabase', 'fia_car_upgrade_summaries.getRaceRows', async () => query);

  if (error) {
    return [] as FiaCarUpgradeSummaryRow[];
  }

  return (data || []) as unknown as FiaCarUpgradeSummaryRow[];
}

export const fiaCarUpgradesApi = {
  async getRaceUpgrades(season: string | number, round: string | number | undefined) {
    const seasonNumber = toNumber(season);
    const roundNumber = toNumber(round);

    if (seasonNumber === null || roundNumber === null) {
      return null;
    }

    const [recordRows, summaryRows] = await Promise.all([
      getRaceUpgradeRows(seasonNumber, roundNumber),
      getRaceUpgradeSummaryRows(seasonNumber, roundNumber),
    ]);

    return buildFiaRaceUpgradeSummaryFromRows(
      recordRows.map(mapUpgradeRow),
      summaryRows.map(mapSummaryRow),
      seasonNumber,
      roundNumber,
      getLatestImportedAt(recordRows),
    );
  },
};
