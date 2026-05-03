import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AiResultPanel } from "../../src/renderer/src/ai/AiResultPanel";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../src/renderer/src/i18n/appLanguage";
import type { AiGenerationResult } from "../../src/shared/ai";

const capturedEditorProps = vi.hoisted(
  () =>
    [] as {
      readonly onImageUpload: unknown;
    }[],
);

vi.mock("../../src/renderer/src/editor/MarkdownBlockEditor", () => ({
  MarkdownBlockEditor: (props: {
    readonly markdown: string;
    readonly onImageUpload: unknown;
  }) => {
    capturedEditorProps.push({ onImageUpload: props.onImageUpload });

    return <div data-testid="readonly-ai-editor">{props.markdown}</div>;
  },
}));

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

const summaryResult = {
  cached: true,
  contents: "## Summary\n\n- Cached summary.",
  kind: "summary",
  path: ".mde/translations/README-summary.md",
  tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
} satisfies AiGenerationResult;

describe("AiResultPanel", () => {
  it("keeps read-only editor callbacks stable across parent refreshes", () => {
    capturedEditorProps.length = 0;
    const { rerender } = render(
      <AiResultPanel
        colorScheme="light"
        isRegeneratingSummary={false}
        onClose={vi.fn()}
        onRegenerateSummary={vi.fn()}
        result={summaryResult}
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    rerender(
      <AiResultPanel
        colorScheme="light"
        isRegeneratingSummary
        onClose={vi.fn()}
        onRegenerateSummary={vi.fn()}
        result={summaryResult}
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(capturedEditorProps).toHaveLength(2);
    expect(capturedEditorProps[1]?.onImageUpload).toBe(
      capturedEditorProps[0]?.onImageUpload,
    );
  });
});
