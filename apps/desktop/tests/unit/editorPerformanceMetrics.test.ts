import { describe, expect, it } from "vitest";

import {
  calculateMedian,
  calculateP95,
  calculateRegressionPercent,
  createEditorPerformanceReport,
  summarizePerformanceRuns,
} from "../e2e/support/editorPerformanceMetrics";

const createStages = (base: number) => ({
  autosaveFileUpdated: base + 60,
  bulkInputVisible: base + 40,
  openEditorVisible: base,
  openFirstBlockAttached: base + 10,
  readyToType: base + 20,
  scrollBottomVisible: base + 50,
  singleInputVisible: base + 30,
});

describe("editor performance metrics", () => {
  it("calculates median, p95, and regression percentages", () => {
    expect(calculateMedian([300, 100, 200])).toBe(200);
    expect(calculateP95([100, 200, 300, 400])).toBe(400);
    expect(calculateRegressionPercent(135, 100)).toBe(35);
  });

  it("summarizes non-warmup runs by stage", () => {
    const summary = summarizePerformanceRuns([
      { iteration: 0, mode: "benchmark", stages: createStages(900), warmup: true },
      { iteration: 1, mode: "benchmark", stages: createStages(100), warmup: false },
      { iteration: 2, mode: "benchmark", stages: createStages(200), warmup: false },
      { iteration: 3, mode: "benchmark", stages: createStages(300), warmup: false },
    ]);

    expect(summary.sampleCount).toBe(3);
    expect(summary.stages.openEditorVisible.median).toBe(200);
    expect(summary.stages.openEditorVisible.p95).toBe(300);
    expect(summary.stages.autosaveFileUpdated.samples).toEqual([
      160, 260, 360,
    ]);
  });

  it("creates a readable JSON report shape", () => {
    const summary = summarizePerformanceRuns([
      { iteration: 0, mode: "smoke", stages: createStages(100), warmup: false },
    ]);
    const report = createEditorPerformanceReport({
      budget: { failures: [], mode: "smoke", passed: true },
      environment: { platform: "darwin", runner: "unit" },
      fixture: {
        codeBlockCount: 8,
        imageCount: 2,
        mermaidBlockCount: 3,
        mode: "smoke",
        ordinaryBlockCount: 900,
        totalMarkdownBlocks: 913,
      },
      mode: "smoke",
      runs: [{ iteration: 0, mode: "smoke", stages: createStages(100), warmup: false }],
      summary,
    });

    expect(report.mode).toBe("smoke");
    expect(report.budget.passed).toBe(true);
    expect(report.summary.stages.singleInputVisible.median).toBe(130);
    expect(report.fixture.totalMarkdownBlocks).toBe(913);
  });
});
