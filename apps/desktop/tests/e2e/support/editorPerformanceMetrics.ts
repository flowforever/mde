export const EDITOR_PERFORMANCE_STAGE_IDS = [
  "openEditorVisible",
  "openFirstBlockAttached",
  "readyToType",
  "singleInputVisible",
  "bulkInputVisible",
  "scrollBottomVisible",
  "autosaveFileUpdated",
] as const;

export type EditorPerformanceMode = "smoke" | "benchmark";
export type EditorPerformanceStageId =
  (typeof EDITOR_PERFORMANCE_STAGE_IDS)[number];
export type EditorPerformanceStageMetrics = Record<
  EditorPerformanceStageId,
  number
>;

export interface EditorPerformanceRun {
  readonly iteration: number;
  readonly mode: EditorPerformanceMode;
  readonly stages: EditorPerformanceStageMetrics;
  readonly warmup: boolean;
}

export interface EditorPerformanceStageSummary {
  readonly median: number;
  readonly p95: number;
  readonly samples: readonly number[];
}

export interface EditorPerformanceSummary {
  readonly sampleCount: number;
  readonly stages: Record<EditorPerformanceStageId, EditorPerformanceStageSummary>;
}

export interface EditorPerformanceFixtureStats {
  readonly codeBlockCount: number;
  readonly imageCount: number;
  readonly mermaidBlockCount: number;
  readonly mode: EditorPerformanceMode;
  readonly ordinaryBlockCount: number;
  readonly totalMarkdownBlocks: number;
}

export interface EditorPerformanceBudgetFailure {
  readonly baseline?: number;
  readonly current?: number;
  readonly limit?: number;
  readonly reason: string;
  readonly regressionPercent?: number;
  readonly stage?: EditorPerformanceStageId;
}

export interface EditorPerformanceBudgetResult {
  readonly failures: readonly EditorPerformanceBudgetFailure[];
  readonly mode: EditorPerformanceMode;
  readonly passed: boolean;
}

export interface EditorPerformanceReport {
  readonly budget: EditorPerformanceBudgetResult;
  readonly createdAt: string;
  readonly environment: Record<string, string>;
  readonly fixture: EditorPerformanceFixtureStats;
  readonly mode: EditorPerformanceMode;
  readonly runs: readonly EditorPerformanceRun[];
  readonly summary: EditorPerformanceSummary;
}

const roundDuration = (value: number): number => Math.round(value * 100) / 100;

const sortedDurations = (values: readonly number[]): readonly number[] =>
  [...values].sort((left, right) => left - right);

export const calculateMedian = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error("Cannot calculate median without samples");
  }

  const sorted = sortedDurations(values);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return roundDuration(sorted[middleIndex]);
  }

  return roundDuration((sorted[middleIndex - 1] + sorted[middleIndex]) / 2);
};

export const calculateP95 = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error("Cannot calculate p95 without samples");
  }

  const sorted = sortedDurations(values);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);

  return roundDuration(sorted[index]);
};

export const calculateRegressionPercent = (
  current: number,
  baseline: number,
): number => {
  if (baseline <= 0) {
    return current > 0 ? Number.POSITIVE_INFINITY : 0;
  }

  return roundDuration(((current - baseline) / baseline) * 100);
};

export const summarizePerformanceRuns = (
  runs: readonly EditorPerformanceRun[],
): EditorPerformanceSummary => {
  const measuredRuns = runs.filter((run) => !run.warmup);

  if (measuredRuns.length === 0) {
    throw new Error("Cannot summarize editor performance without measured runs");
  }

  const stages = Object.fromEntries(
    EDITOR_PERFORMANCE_STAGE_IDS.map((stageId) => {
      const samples = measuredRuns.map((run) =>
        roundDuration(run.stages[stageId]),
      );

      return [
        stageId,
        {
          median: calculateMedian(samples),
          p95: calculateP95(samples),
          samples,
        },
      ];
    }),
  ) as unknown as Record<
    EditorPerformanceStageId,
    EditorPerformanceStageSummary
  >;

  return {
    sampleCount: measuredRuns.length,
    stages,
  };
};

export const createEditorPerformanceReport = ({
  budget,
  environment,
  fixture,
  mode,
  runs,
  summary,
}: Omit<EditorPerformanceReport, "createdAt">): EditorPerformanceReport => ({
  budget,
  createdAt: new Date().toISOString(),
  environment,
  fixture,
  mode,
  runs,
  summary,
});

export const serializeEditorPerformanceReport = (
  report: EditorPerformanceReport,
): string => `${JSON.stringify(report, null, 2)}\n`;
