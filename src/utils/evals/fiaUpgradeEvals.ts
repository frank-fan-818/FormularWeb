/**
 * Evals for FIA car upgrade document parsing.
 *
 * Validates that the regex + rule-based parser in fiaCarUpgrades.ts
 * correctly extracts structured data from FIA technical documents.
 */

import { runEvals, type EvalsReport } from './evalsRunner';

interface FiaUpgradeOutput {
  component: string;
  reason: string;
  description?: string;
  confidence: number;
}

interface FiaUpgradeInput {
  rawText: string;
  season: string;
  round: string;
}

const SAMPLE_CASES: Array<{
  input: FiaUpgradeInput;
  expected: Partial<FiaUpgradeOutput>;
}> = [
  {
    input: {
      season: '2024', round: '1',
      rawText: 'Front Wing - Performance - Modified endplate geometry for improved airflow',
    },
    expected: { component: 'front_wing', reason: 'performance' },
  },
  {
    input: {
      season: '2024', round: '1',
      rawText: 'Rear Wing - Circuit specific - Reduced drag configuration for Bahrain',
    },
    expected: { component: 'rear_wing', reason: 'circuit_specific' },
  },
  {
    input: {
      season: '2024', round: '3',
      rawText: 'Floor Body - Performance - Revised tunnel geometry',
    },
    expected: { component: 'floor', reason: 'performance' },
  },
  {
    input: {
      season: '2024', round: '5',
      rawText: 'Sidepod Inlet - Cooling - Increased inlet area for hot conditions',
    },
    expected: { component: 'sidepod', reason: 'cooling' },
  },
  {
    input: {
      season: '2024', round: '7',
      rawText: 'Beam Wing - Circuit specific - Higher downforce specification for Monaco',
    },
    expected: { component: 'beam_wing', reason: 'circuit_specific' },
  },
  {
    input: {
      season: '2024', round: '8',
      rawText: 'Rear Suspension - Reliability - Strengthened components after fatigue analysis',
    },
    expected: { component: 'rear_suspension', reason: 'reliability' },
  },
  {
    input: {
      season: '2024', round: '10',
      rawText: 'Brake Duct - Cooling - Optimized airflow for brake temperature management',
    },
    expected: { component: 'brake_duct', reason: 'cooling' },
  },
  {
    input: {
      season: '2024', round: '12',
      rawText: 'Engine Cover - Performance - Redesigned bodywork for improved airflow',
    },
    expected: { component: 'engine_cover', reason: 'performance' },
  },
  {
    input: {
      season: '2024', round: '15',
      rawText: 'Front Suspension - Performance - Modified geometry for better mechanical grip',
    },
    expected: { component: 'front_suspension', reason: 'performance' },
  },
  {
    input: {
      season: '2024', round: '18',
      rawText: 'Diffuser - Performance - Updated expansion ratio for increased downforce',
    },
    expected: { component: 'diffuser', reason: 'performance' },
  },
];

export async function evaluateFiaParser(
  parseFn: (input: FiaUpgradeInput) => Promise<FiaUpgradeOutput>,
): Promise<EvalsReport> {
  return runEvals('FIA Upgrade Parser', SAMPLE_CASES, parseFn, {
    format: (output: FiaUpgradeOutput) => {
      return (
        typeof output.component === 'string' &&
        output.component.length > 0 &&
        typeof output.reason === 'string' &&
        output.reason.length > 0 &&
        typeof output.confidence === 'number' &&
        output.confidence >= 0 &&
        output.confidence <= 1
      );
    },
    content: (output: FiaUpgradeOutput, expected: Partial<FiaUpgradeOutput>) => {
      let ok = true;
      if (expected.component && output.component !== expected.component) ok = false;
      if (expected.reason && output.reason !== expected.reason) ok = false;
      return ok;
    },
  });
}
