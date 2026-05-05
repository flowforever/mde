import { describe, expect, it } from "vitest";

import {
  evaluateEditorPerformanceBudget,
  parseEditorPerformanceBaseline,
} from "../e2e/support/editorPerformanceBudget";
import { summarizePerformanceRuns } from "../e2e/support/editorPerformanceMetrics";

const baseline = parseEditorPerformanceBaseline({
  modes: {
    smoke: {
      absoluteLimits: {
        autosaveFileUpdated: 5000,
        bulkInputVisible: 3000,
        openEditorVisible: 4000,
        openFirstBlockAttached: 4500,
        readyToType: 5000,
        scrollBottomVisible: 2500,
        singleInputVisible: 750,
      },
      relativeThresholdPercent: 35,
      stages: {
        autosaveFileUpdated: 1000,
        bulkInputVisible: 1000,
        openEditorVisible: 1000,
        openFirstBlockAttached: 1000,
        readyToType: 1000,
        scrollBottomVisible: 1000,
        singleInputVisible: 100,
      },
    },
  },
  version: 1,
});

describe("editor performance budget", () => {
  it("passes when all stage medians remain inside baseline and absolute limits", () => {
    const summary = summarizePerformanceRuns([
      {
        iteration: 0,
        mode: "smoke",
        stages: {
          autosaveFileUpdated: 900,
          bulkInputVisible: 900,
          openEditorVisible: 900,
          openFirstBlockAttached: 900,
          readyToType: 900,
          scrollBottomVisible: 900,
          singleInputVisible: 90,
        },
        warmup: false,
      },
    ]);

    expect(
      evaluateEditorPerformanceBudget({ baseline, mode: "smoke", summary }),
    ).toMatchObject({ failures: [], passed: true });
  });

  it("fails with specific stage evidence for relative and absolute regressions", () => {
    const summary = summarizePerformanceRuns([
      {
        iteration: 0,
        mode: "smoke",
        stages: {
          autosaveFileUpdated: 5100,
          bulkInputVisible: 900,
          openEditorVisible: 1400,
          openFirstBlockAttached: 900,
          readyToType: 900,
          scrollBottomVisible: 900,
          singleInputVisible: 90,
        },
        warmup: false,
      },
    ]);
    const result = evaluateEditorPerformanceBudget({
      baseline,
      mode: "smoke",
      summary,
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.stage)).toEqual([
      "autosaveFileUpdated",
      "openEditorVisible",
    ]);
    expect(result.failures[0].reason).toContain("absolute");
    expect(result.failures[1].reason).toContain("relative");
  });

  it("fails clearly when a baseline mode is missing", () => {
    const summary = summarizePerformanceRuns([
      {
        iteration: 0,
        mode: "benchmark",
        stages: {
          autosaveFileUpdated: 100,
          bulkInputVisible: 100,
          openEditorVisible: 100,
          openFirstBlockAttached: 100,
          readyToType: 100,
          scrollBottomVisible: 100,
          singleInputVisible: 100,
        },
        warmup: false,
      },
    ]);

    expect(
      evaluateEditorPerformanceBudget({ baseline, mode: "benchmark", summary }),
    ).toMatchObject({
      failures: [{ reason: "Missing performance baseline for benchmark" }],
      passed: false,
    });
  });
});
