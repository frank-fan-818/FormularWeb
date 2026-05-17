export type FiaUpgradeReason =
  | 'Performance'
  | 'Circuit specific'
  | 'Reliability'
  | 'Cooling'
  | 'Other'
  | 'Unknown';

export interface FiaCarUpgradeDocumentMetadata {
  season: number;
  round?: number;
  grandPrix?: string;
  documentTitle?: string;
  documentUrl?: string;
  sourcePath?: string;
  sourceType?: FiaCarUpgradeSourceType;
}

export type FiaCarUpgradeSourceType = 'FIA' | 'FIA_TECH_UPDATE';

export interface FiaCarUpgradeRecord extends FiaCarUpgradeDocumentMetadata {
  sourceType: FiaCarUpgradeSourceType;
  team: string;
  carNumber?: string;
  area?: string;
  component?: string;
  primaryReason: FiaUpgradeReason;
  geometricDifferences?: string;
  description?: string;
  rawText: string;
  confidence: number;
  componentImportance: number;
}

export interface FiaCarUpgradeSummary {
  season: number;
  round?: number;
  grandPrix?: string;
  team: string;
  declaredUpgradeCount: number;
  declaredUpgradeIntensity: number;
  performanceIntent: number;
  circuitSpecificIntent: number;
  reliabilityIntent: number;
  coolingIntent: number;
  maxComponentImportance: number;
}

export interface ParsedFiaCarUpgradeDocument {
  metadata: FiaCarUpgradeDocumentMetadata;
  records: FiaCarUpgradeRecord[];
  summaries: FiaCarUpgradeSummary[];
}

const TEAM_NAMES = [
  'Red Bull Racing',
  'Racing Bulls',
  'Visa Cash App RB',
  'AlphaTauri',
  'Toro Rosso',
  'Ferrari',
  'Mercedes',
  'McLaren',
  'Aston Martin',
  'Alpine',
  'Renault',
  'Williams',
  'Haas',
  'Kick Sauber',
  'Stake',
  'Sauber',
  'Alfa Romeo',
];

const REASON_KEYWORDS: Array<[FiaUpgradeReason, RegExp]> = [
  ['Circuit specific', /\bcircuit[\s-]*specific\b/i],
  ['Performance', /\bperformance\b/i],
  ['Reliability', /\breliability\b/i],
  ['Cooling', /\bcooling\b/i],
  ['Other', /\bother\b/i],
];

const COMPONENT_WEIGHTS: Array<[RegExp, number, string]> = [
  [/\bfloor|diffuser/i, 5, 'Floor'],
  [/\bfront\s+wing|nose/i, 4, 'Front wing'],
  [/\brear\s+wing|drs/i, 4, 'Rear wing'],
  [/\bsidepod|bodywork|engine\s+cover|coke\s+bottle/i, 4, 'Bodywork'],
  [/\bbeam\s+wing/i, 3, 'Beam wing'],
  [/\bsuspension|pushrod|pullrod/i, 3, 'Suspension'],
  [/\bcooling|louvre|inlet|outlet/i, 2, 'Cooling'],
  [/\bbrake\s+duct|brake/i, 2, 'Brake duct'],
  [/\bmirror|halo|turning\s+vane|flick|fin/i, 1, 'Small aero'],
];

export function normalizeFiaWhitespace(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeUpgradeReason(value: string | undefined): FiaUpgradeReason {
  if (!value) {
    return 'Unknown';
  }

  const match = REASON_KEYWORDS.find(([, pattern]) => pattern.test(value));
  return match ? match[0] : 'Unknown';
}

export function inferUpgradeComponent(area: string | undefined, description: string | undefined): string | undefined {
  const text = `${area || ''} ${description || ''}`.trim();
  const match = COMPONENT_WEIGHTS.find(([pattern]) => pattern.test(text));
  return match ? match[2] : area?.trim() || undefined;
}

export function getUpgradeComponentImportance(area: string | undefined, description: string | undefined): number {
  const text = `${area || ''} ${description || ''}`.trim();
  const match = COMPONENT_WEIGHTS.find(([pattern]) => pattern.test(text));
  return match ? match[1] : 1;
}

export function parseFiaCarPresentationText(
  text: string,
  metadata: FiaCarUpgradeDocumentMetadata,
): ParsedFiaCarUpgradeDocument {
  const normalized = normalizeFiaWhitespace(text);
  const records = [
    ...parseDelimitedRows(normalized, metadata),
    ...parseTeamBlocks(normalized, metadata),
  ];
  const uniqueRecords = dedupeRecords(records);

  return {
    metadata,
    records: uniqueRecords,
    summaries: summarizeFiaCarUpgrades(uniqueRecords),
  };
}

export function summarizeFiaCarUpgrades(records: FiaCarUpgradeRecord[]): FiaCarUpgradeSummary[] {
  const grouped = new Map<string, FiaCarUpgradeRecord[]>();

  records.forEach((record) => {
    const key = [
      record.season,
      record.round ?? '',
      record.grandPrix ?? '',
      record.team.toLowerCase(),
    ].join('|');
    grouped.set(key, [...(grouped.get(key) || []), record]);
  });

  return Array.from(grouped.values()).map((teamRecords) => {
    const first = teamRecords[0];
    const count = teamRecords.length;
    const intensity = teamRecords.reduce((sum, record) => sum + record.componentImportance, 0);

    return {
      season: first.season,
      round: first.round,
      grandPrix: first.grandPrix,
      team: first.team,
      declaredUpgradeCount: count,
      declaredUpgradeIntensity: intensity,
      performanceIntent: reasonShare(teamRecords, 'Performance'),
      circuitSpecificIntent: reasonShare(teamRecords, 'Circuit specific'),
      reliabilityIntent: reasonShare(teamRecords, 'Reliability'),
      coolingIntent: reasonShare(teamRecords, 'Cooling'),
      maxComponentImportance: Math.max(...teamRecords.map((record) => record.componentImportance)),
    };
  });
}

function parseDelimitedRows(text: string, metadata: FiaCarUpgradeDocumentMetadata): FiaCarUpgradeRecord[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('|') || line.includes('\t'))
    .flatMap((line) => {
      const cells = line
        .split(line.includes('|') ? '|' : '\t')
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length < 4 || /^team$/i.test(cells[0])) {
        return [];
      }

      const team = findTeamName(cells[0]);
      if (!team) {
        return [];
      }

      const primaryReason = normalizeUpgradeReason(cells.join(' '));
      const area = cells.find((cell) => getUpgradeComponentImportance(cell, undefined) > 1);
      const description = cells.slice(3).join(' ');
      return [
        buildRecord(metadata, {
          team,
          carNumber: findCarNumber(cells.join(' ')),
          area,
          primaryReason,
          description,
          rawText: line,
          confidence: 0.82,
        }),
      ];
    });
}

function parseTeamBlocks(text: string, metadata: FiaCarUpgradeDocumentMetadata): FiaCarUpgradeRecord[] {
  const teamPattern = new RegExp(`\\b(${TEAM_NAMES.map(escapeRegExp).join('|')})\\b`, 'gi');
  const matches = Array.from(text.matchAll(teamPattern));
  if (!matches.length) {
    return [];
  }

  return matches.flatMap((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const rawText = text.slice(start, end).trim();
    const team = findTeamName(match[0]);
    if (!team || rawText.length < team.length + 8) {
      return [];
    }

    const primaryReason = normalizeUpgradeReason(rawText);
    const area = findArea(rawText);
    const description = findField(rawText, ['Description', 'Description of change', 'Brief description']);
    const geometricDifferences = findField(rawText, ['Geometric differences', 'Geometry', 'Differences']);
    const componentRows = parseNumberedComponentRows(rawText, team, metadata);

    if (componentRows.length) {
      return componentRows;
    }

    return [
      buildRecord(metadata, {
        team,
        carNumber: findCarNumber(rawText),
        area,
        primaryReason,
        geometricDifferences,
        description: description || rawText.replace(team, '').trim(),
        rawText,
        confidence: area || description ? 0.74 : 0.56,
      }),
    ];
  });
}

function parseNumberedComponentRows(
  blockText: string,
  team: string,
  metadata: FiaCarUpgradeDocumentMetadata,
): FiaCarUpgradeRecord[] {
  const rowMatches = Array.from(blockText.matchAll(/(?:^|\n)\s*(\d{1,2})\s+([^\n]+(?:\n(?!\s*\d{1,2}\s+)[^\n]+)*)/g));
  const rows = rowMatches
    .map((match) => match[0].trim())
    .filter((row) => /\b(?:Performance|Circuit\s+specific|Reliability|Cooling|Other)\b/i.test(row));

  return rows.map((row) => {
    const primaryReason = normalizeUpgradeReason(row);
    const area = inferNumberedRowArea(row);
    const component = inferUpgradeComponent(area, row);

    return buildRecord(metadata, {
      team,
      area: area || component,
      primaryReason,
      description: row.replace(/^\d{1,2}\s+/, '').trim(),
      rawText: row,
      confidence: area ? 0.88 : 0.72,
    });
  });
}

function inferNumberedRowArea(row: string): string | undefined {
  const withoutIndex = row.replace(/^\d{1,2}\s+/, '').trim();
  const reasonIndex = withoutIndex.search(/\b(?:Performance|Circuit\s+specific|Reliability|Other)\b/i);
  const beforeReason = reasonIndex >= 0 ? withoutIndex.slice(0, reasonIndex).trim() : withoutIndex;
  const cleaned = beforeReason.replace(/\s+/g, ' ').trim();
  return cleaned || findArea(row);
}

function buildRecord(
  metadata: FiaCarUpgradeDocumentMetadata,
  input: {
    team: string;
    carNumber?: string;
    area?: string;
    primaryReason: FiaUpgradeReason;
    geometricDifferences?: string;
    description?: string;
    rawText: string;
    confidence: number;
  },
): FiaCarUpgradeRecord {
  const component = inferUpgradeComponent(input.area, input.description);

  return {
    ...metadata,
    sourceType: metadata.sourceType || 'FIA',
    team: input.team,
    carNumber: input.carNumber,
    area: input.area,
    component,
    primaryReason: input.primaryReason,
    geometricDifferences: input.geometricDifferences,
    description: input.description,
    rawText: input.rawText,
    confidence: input.confidence,
    componentImportance: getUpgradeComponentImportance(input.area, input.description),
  };
}

function findTeamName(value: string): string | undefined {
  return TEAM_NAMES.find((team) => new RegExp(`\\b${escapeRegExp(team)}\\b`, 'i').test(value));
}

function findCarNumber(value: string): string | undefined {
  return value.match(/\b(?:car\s*(?:no\.?|number)?|cars?)\s*[:#-]?\s*([0-9]{1,2}(?:\s*[,/&]\s*[0-9]{1,2})*)\b/i)?.[1];
}

function findArea(value: string): string | undefined {
  const explicit = findField(value, ['Area', 'Component', 'Part']);
  if (explicit) {
    return explicit;
  }

  const match = COMPONENT_WEIGHTS.find(([pattern]) => pattern.test(value));
  return match?.[2];
}

function findField(value: string, labels: string[]): string | undefined {
  const labelPattern = labels.map(escapeRegExp).join('|');
  const match = value.match(new RegExp(`(?:${labelPattern})\\s*:?\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim();
}

function reasonShare(records: FiaCarUpgradeRecord[], reason: FiaUpgradeReason): number {
  return records.length
    ? records.filter((record) => record.primaryReason === reason).length / records.length
    : 0;
}

function dedupeRecords(records: FiaCarUpgradeRecord[]): FiaCarUpgradeRecord[] {
  const seen = new Set<string>();

  return records.filter((record) => {
    const key = [
      record.season,
      record.round ?? '',
      record.team.toLowerCase(),
      record.carNumber ?? '',
      record.component ?? '',
      record.primaryReason,
      record.rawText.replace(/\s+/g, ' ').trim(),
    ].join('|');

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
