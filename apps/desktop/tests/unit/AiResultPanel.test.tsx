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
      readonly activeSearchMatchIndex?: number;
      readonly onImageUpload: unknown;
      readonly onSearchStateChange?: unknown;
      readonly pinnedSearchQueries?: readonly string[];
      readonly searchQuery?: string;
    }[],
);

vi.mock("@mde/editor-react", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...(actual as object),
    MarkdownBlockEditor: (props: {
      readonly activeSearchMatchIndex?: number;
      readonly markdown: string;
      readonly onImageUpload: unknown;
      readonly onSearchStateChange?: unknown;
      readonly pinnedSearchQueries?: readonly string[];
      readonly searchQuery?: string;
    }) => {
      capturedEditorProps.push({
        activeSearchMatchIndex: props.activeSearchMatchIndex,
        onImageUpload: props.onImageUpload,
        onSearchStateChange: props.onSearchStateChange,
        pinnedSearchQueries: props.pinnedSearchQueries,
        searchQuery: props.searchQuery,
      });

      return <div data-testid="readonly-ai-editor">{props.markdown}</div>;
    },
  };
});

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
        onSearchStateChange={vi.fn()}
        result={summaryResult}
        searchState={{ activeMatchIndex: -1, matchCount: 0 }}
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
        onSearchStateChange={vi.fn()}
        result={summaryResult}
        searchState={{ activeMatchIndex: -1, matchCount: 0 }}
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(capturedEditorProps).toHaveLength(2);
    expect(capturedEditorProps[1]?.onImageUpload).toBe(
      capturedEditorProps[0]?.onImageUpload,
    );
  });

  it("passes active editor search state into the read-only result editor", () => {
    capturedEditorProps.length = 0;
    const onSearchStateChange = vi.fn();

    render(
      <AiResultPanel
        colorScheme="light"
        isRegeneratingSummary={false}
        onClose={vi.fn()}
        onRegenerateSummary={vi.fn()}
        onSearchStateChange={onSearchStateChange}
        pinnedSearchQueries={["Cached"]}
        result={summaryResult}
        searchQuery="summary"
        searchState={{ activeMatchIndex: 2, matchCount: 4 }}
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(capturedEditorProps).toHaveLength(1);
    expect(capturedEditorProps[0]).toMatchObject({
      activeSearchMatchIndex: 2,
      onSearchStateChange,
      pinnedSearchQueries: ["Cached"],
      searchQuery: "summary",
    });
  });
});
