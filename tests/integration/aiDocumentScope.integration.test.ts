import { describe, expect, it } from "vitest";

import {
  createAiDocumentKey,
  resolveCurrentAiDocumentKey,
} from "../../src/renderer/src/app/aiDocumentScope";

describe("AI document scope", () => {
  it("keeps the selected Markdown file scoped while the loaded file is refreshing", () => {
    expect(
      resolveCurrentAiDocumentKey({
        loadedFilePath: null,
        selectedFilePath: "README.md",
        workspaceRoot: "/workspace",
      }),
    ).toBe(createAiDocumentKey("/workspace", "README.md"));
  });

  it("uses the loaded file path once the refresh completes", () => {
    expect(
      resolveCurrentAiDocumentKey({
        loadedFilePath: "docs/guide.md",
        selectedFilePath: "README.md",
        workspaceRoot: "/workspace",
      }),
    ).toBe(createAiDocumentKey("/workspace", "docs/guide.md"));
  });

  it("does not scope AI state without a workspace or selected file", () => {
    expect(
      resolveCurrentAiDocumentKey({
        loadedFilePath: null,
        selectedFilePath: "README.md",
        workspaceRoot: null,
      }),
    ).toBeNull();
    expect(
      resolveCurrentAiDocumentKey({
        loadedFilePath: null,
        selectedFilePath: null,
        workspaceRoot: "/workspace",
      }),
    ).toBeNull();
  });
});
