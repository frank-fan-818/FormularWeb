/**
 * Minimal LLM output evaluation runner.
 * Used to quantify model quality with real numbers instead of "feels right".
 *
 * Usage:
 *   const report = await runEvals('myModel', testCases, myModelFn, checks);
 *   console.log(report);
 */

export interface EvalsReport {
  modelName: string;
  testDate: string;
  totalCases: number;
  formatComplianceRate: number;
  accuracyRate: number;
  detailedResults: EvalsResult[];
}

export interface EvalsResult {
  caseIndex: number;
  input: unknown;
  expected: Record<string, unknown>;
  actual: unknown | null;
  formatOk: boolean;
  contentOk: boolean;
  error?: string;
  durationMs?: number;
}

export interface EvalsChecks<TOutput> {
  /** Check whether output has required fields/structure. */
  format: (output: TOutput) => boolean;
  /** Check whether output content matches expected. */
  content: (output: TOutput, expected: Partial<TOutput>) => boolean;
}

export async function runEvals<TInput, TOutput>(
  modelName: string,
  testCases: Array<{ input: TInput; expected: Partial<TOutput> }>,
  modelFn: (input: TInput) => Promise<TOutput>,
  checks: EvalsChecks<TOutput>,
): Promise<EvalsReport> {
  const results: EvalsResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const { input, expected } = testCases[i];
    const caseStartedAt = Date.now();

    try {
      const output = await modelFn(input);
      const formatOk = checks.format(output);
      const contentOk = checks.content(output, expected);

      results.push({
        caseIndex: i,
        input,
        expected: expected as Record<string, unknown>,
        actual: output,
        formatOk,
        contentOk,
        durationMs: Date.now() - caseStartedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        caseIndex: i,
        input,
        expected: expected as Record<string, unknown>,
        actual: null,
        formatOk: false,
        contentOk: false,
        error: message,
        durationMs: Date.now() - caseStartedAt,
      });
    }
  }

  const totalCases = results.length;
  const formatOkCount = results.filter((r) => r.formatOk).length;
  const contentOkCount = results.filter((r) => r.contentOk).length;

  return {
    modelName,
    testDate: new Date().toISOString(),
    totalCases,
    formatComplianceRate: totalCases > 0 ? formatOkCount / totalCases : 0,
    accuracyRate: totalCases > 0 ? contentOkCount / totalCases : 0,
    detailedResults: results,
  };
}
