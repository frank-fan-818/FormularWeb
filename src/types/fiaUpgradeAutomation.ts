import type { FiaCarUpgradeRecord, FiaCarUpgradeSummary } from '../utils/fiaCarUpgrades';

export interface FiaPublishedRaceArtifact {
  season: number;
  round: number;
  grandPrix: string;
  documentUrl: string;
  generatedAt: string;
  source: string;
  records: FiaCarUpgradeRecord[];
  summaries: FiaCarUpgradeSummary[];
}

export interface FiaScheduledRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
}
