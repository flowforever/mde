import { describe, expect, it } from "vitest";

import {
  getNextMissingInlineFlowchartTargets,
  type InlineFlowchartTargets,
} from "@mde/editor-react";

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
