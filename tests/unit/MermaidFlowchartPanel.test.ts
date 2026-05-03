import { describe, expect, it } from "vitest";

import {
  getNextMissingInlineFlowchartTargets,
  type InlineFlowchartTargets,
} from "../../src/renderer/src/editor/flowchartInlineTargets";

describe("MermaidFlowchartPanel", () => {
  it("keeps missing inline target state stable across unrelated DOM mutations", () => {
    const currentTargets: InlineFlowchartTargets = {
      hasCodeBlocks: true,
      targets: [],
    };

    expect(getNextMissingInlineFlowchartTargets(currentTargets, true)).toBe(
      currentTargets,
    );
    expect(getNextMissingInlineFlowchartTargets(currentTargets, false)).toEqual({
      hasCodeBlocks: false,
      targets: [],
    });
  });
});
