import {
  EDITOR_PERFORMANCE_STAGE_IDS,
  calculateRegressionPercent,
  type EditorPerformanceBudgetFailure,
  type EditorPerformanceBudgetResult,
  type EditorPerformanceMode,
  type EditorPerformanceStageMetrics,
  type EditorPerformanceSummary,
} from "./editorPerformanceMetrics";

export interface EditorPerformanceBaselineMode {
  readonly absoluteLimits: EditorPerformanceStageMetrics;
  readonly relativeThresholdPercent: number;
  readonly stages: EditorPerformanceStageMetrics;
}

export interface EditorPerformanceBaseline {
  readonly modes: Partial<
    Record<EditorPerformanceMode, EditorPerformanceBaselineMode>
  >;
  readonly version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStageMetrics = (
  value: unknown,
  label: string,
): EditorPerformanceStageMetrics => {
  if (!isRecord(value)) {
    throw new Error(`Invalid editor performance baseline ${label}`);
  }

  return Object.fromEntries(
    EDITOR_PERFORMANCE_STAGE_IDS.map((stageId) => {
      const stageValue = value[stageId];

      if (typeof stageValue !== "number" || !Number.isFinite(stageValue)) {
        throw new Error(
          `Invalid editor performance baseline ${label}.${stageId}`,
        );
      }

      return [stageId, stageValue];
    }),
  ) as EditorPerformanceStageMetrics;
};

export const parseEditorPerformanceBaseline = (
  value: unknown,
): EditorPerformanceBaseline => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.modes)) {
    throw new Error("Invalid editor performance baseline");
  }

  const modes: Partial<
    Record<EditorPerformanceMode, EditorPerformanceBaselineMode>
  > = {};

  for (const mode of ["smoke", "benchmark"] as const) {
    const modeValue = value.modes[mode];

    if (modeValue === undefined) {
      continue;
    }

    if (!isRecord(modeValue)) {
      throw new Error(`Invalid editor performance baseline for ${mode}`);
    }

    if (
      typeof modeValue.relativeThresholdPercent !== "number" ||
      !Number.isFinite(modeValue.relativeThresholdPercent)
    ) {
      throw new Error(
        `Invalid editor performance baseline ${mode}.relativeThresholdPercent`,
      );
    }

    modes[mode] = {
      absoluteLimits: readStageMetrics(
        modeValue.absoluteLimits,
        `${mode}.absoluteLimits`,
      ),
      relativeThresholdPercent: modeValue.relativeThresholdPercent,
      stages: readStageMetrics(modeValue.stages, `${mode}.stages`),
    };
  }

  return {
    modes,
    version: 1,
  };
};

const createAbsoluteFailures = (
  summary: EditorPerformanceSummary,
  modeBaseline: EditorPerformanceBaselineMode,
): readonly EditorPerformanceBudgetFailure[] =>
  EDITOR_PERFORMANCE_STAGE_IDS.flatMap((stageId) => {
    const current = summary.stages[stageId].median;
    const limit = modeBaseline.absoluteLimits[stageId];

    if (current <= limit) {
      return [];
    }

    return [
      {
        current,
        limit,
        reason: `Stage exceeded absolute limit: ${current}ms > ${limit}ms`,
        stage: stageId,
      },
    ];
  });

const createRelativeFailures = (
  summary: EditorPerformanceSummary,
  modeBaseline: EditorPerformanceBaselineMode,
): readonly EditorPerformanceBudgetFailure[] =>
  EDITOR_PERFORMANCE_STAGE_IDS.flatMap((stageId) => {
    const current = summary.stages[stageId].median;
    const baseline = modeBaseline.stages[stageId];
    const regressionPercent = calculateRegressionPercent(current, baseline);

    if (regressionPercent <= modeBaseline.relativeThresholdPercent) {
      return [];
    }

    return [
      {
        baseline,
        current,
        reason: `Stage exceeded relative limit: ${regressionPercent}% > ${modeBaseline.relativeThresholdPercent}%`,
        regressionPercent,
        stage: stageId,
      },
    ];
  });

export const evaluateEditorPerformanceBudget = ({
  baseline,
  mode,
  summary,
}: {
  readonly baseline: EditorPerformanceBaseline;
  readonly mode: EditorPerformanceMode;
  readonly summary: EditorPerformanceSummary;
}): EditorPerformanceBudgetResult => {
  const modeBaseline = baseline.modes[mode];

  if (!modeBaseline) {
    return {
      failures: [{ reason: `Missing performance baseline for ${mode}` }],
      mode,
      passed: false,
    };
  }

  const absoluteFailures = createAbsoluteFailures(summary, modeBaseline);
  const absoluteFailureStages = new Set(
    absoluteFailures.map((failure) => failure.stage),
  );
  const relativeFailures = createRelativeFailures(
    summary,
    modeBaseline,
  ).filter(
    (failure) =>
      failure.stage === undefined || !absoluteFailureStages.has(failure.stage),
  );
  const failures = [...absoluteFailures, ...relativeFailures];

  return {
    failures,
    mode,
    passed: failures.length === 0,
  };
};

export const formatEditorPerformanceFailures = (
  failures: readonly EditorPerformanceBudgetFailure[],
): string =>
  failures
    .map((failure) => {
      const stage = failure.stage ?? "baseline";

      return `${stage}: ${failure.reason}`;
    })
    .join("\n");
