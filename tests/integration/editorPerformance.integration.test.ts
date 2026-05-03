import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EDITOR_PERFORMANCE_PRESETS,
  createEditorPerformanceWorkspace,
} from "../e2e/support/editorPerformanceFixture";
import { parseEditorPerformanceBaseline } from "../e2e/support/editorPerformanceBudget";
import {
  createEditorPerformanceReport,
  summarizePerformanceRuns,
} from "../e2e/support/editorPerformanceMetrics";

describe("editor performance integration helpers", () => {
  it("parses the committed performance baseline schema", async () => {
    const baseline = parseEditorPerformanceBaseline(
      JSON.parse(
        await readFile(
          resolve("tests/e2e/fixtures/editor-performance-baseline.json"),
          "utf8",
        ),
      ),
    );

    const smokeBaseline = baseline.modes.smoke;
    const benchmarkBaseline = baseline.modes.benchmark;

    expect(baseline.version).toBe(1);
    expect(smokeBaseline).toBeDefined();
    expect(benchmarkBaseline).toBeDefined();

    if (!smokeBaseline || !benchmarkBaseline) {
      throw new Error("Expected committed smoke and benchmark baselines");
    }

    expect(smokeBaseline.relativeThresholdPercent).toBe(35);
    expect(benchmarkBaseline.relativeThresholdPercent).toBe(20);
    expect(smokeBaseline.stages.openEditorVisible).toBeGreaterThan(0);
  });

  it("creates a temporary workspace with document and image assets", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "mde-performance-it-"));

    try {
      const fixture = await createEditorPerformanceWorkspace({
        preset: EDITOR_PERFORMANCE_PRESETS.smoke,
        workspacePath,
      });

      const documentStats = await stat(fixture.documentPath);
      expect(documentStats.isFile()).toBe(true);
      expect(await readFile(fixture.documentPath, "utf8")).toContain(
        fixture.targets.bottomText,
      );
      expect(fixture.assetPaths).toHaveLength(fixture.stats.imageCount);
      const assetStats = await stat(fixture.assetPaths[0]);
      expect(assetStats.isFile()).toBe(true);
    } finally {
      await rm(workspacePath, { force: true, recursive: true });
    }
  });

  it("generates a stable report from performance samples", () => {
    const summary = summarizePerformanceRuns([
      {
        iteration: 0,
        mode: "smoke",
        stages: {
          autosaveFileUpdated: 150,
          bulkInputVisible: 140,
          openEditorVisible: 100,
          openFirstBlockAttached: 110,
          readyToType: 120,
          scrollBottomVisible: 130,
          singleInputVisible: 125,
        },
        warmup: false,
      },
    ]);

    expect(
      createEditorPerformanceReport({
        budget: { failures: [], mode: "smoke", passed: true },
        environment: { platform: "test", runner: "integration" },
        fixture: {
          codeBlockCount: 8,
          imageCount: 2,
          mermaidBlockCount: 3,
          mode: "smoke",
          ordinaryBlockCount: 900,
          totalMarkdownBlocks: 913,
        },
        mode: "smoke",
        runs: [],
        summary,
      }),
    ).toMatchObject({
      budget: { passed: true },
      summary: { sampleCount: 1 },
    });
  });
});
