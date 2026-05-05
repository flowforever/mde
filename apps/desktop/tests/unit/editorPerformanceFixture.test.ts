import { describe, expect, it } from "vitest";

import {
  EDITOR_PERFORMANCE_PRESETS,
  buildEditorPerformanceMarkdown,
} from "../e2e/support/editorPerformanceFixture";

describe("editor performance fixture builder", () => {
  it("builds deterministic smoke markdown with the required mixed content", () => {
    const firstFixture = buildEditorPerformanceMarkdown(
      EDITOR_PERFORMANCE_PRESETS.smoke,
    );
    const secondFixture = buildEditorPerformanceMarkdown(
      EDITOR_PERFORMANCE_PRESETS.smoke,
    );

    expect(firstFixture.markdown).toBe(secondFixture.markdown);
    expect(firstFixture.stats.ordinaryBlockCount).toBeGreaterThanOrEqual(800);
    expect(firstFixture.stats.codeBlockCount).toBeGreaterThanOrEqual(6);
    expect(firstFixture.stats.mermaidBlockCount).toBeGreaterThanOrEqual(2);
    expect(firstFixture.stats.imageCount).toBeGreaterThanOrEqual(2);
    expect(firstFixture.markdown).toContain("---\ntitle: Editor Performance");
    expect(firstFixture.markdown).toContain("```mermaid");
    expect(firstFixture.markdown).toContain("```ts");
    expect(firstFixture.markdown).toContain("![Performance image 1]");
    expect(firstFixture.markdown).toContain(
      firstFixture.targets.firstScreenText,
    );
    expect(firstFixture.markdown).toContain(firstFixture.targets.bottomText);
  });

  it("builds a larger benchmark fixture and exposes stable edit targets", () => {
    const fixture = buildEditorPerformanceMarkdown(
      EDITOR_PERFORMANCE_PRESETS.benchmark,
    );

    expect(fixture.stats.ordinaryBlockCount).toBeGreaterThanOrEqual(2500);
    expect(fixture.stats.codeBlockCount).toBeGreaterThanOrEqual(20);
    expect(fixture.stats.mermaidBlockCount).toBeGreaterThanOrEqual(5);
    expect(fixture.targets.singleInputText).toContain("performance single edit");
    expect(fixture.targets.bulkInputText.split("\n")).toHaveLength(20);
  });
});
