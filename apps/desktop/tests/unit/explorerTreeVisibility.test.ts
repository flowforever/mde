import { describe, expect, it } from "vitest";

import { collectDefaultHiddenEntryPaths } from "../../src/renderer/src/explorer/explorerTreeVisibility";
import type { TreeNode } from "@mde/editor-host/file-tree";

describe("explorerTreeVisibility", () => {
  it("keeps root .mde visible while default-hiding other dot-prefixed entries", () => {
    const nodes: readonly TreeNode[] = [
      {
        children: [
          {
            name: "automation.md",
            path: ".mde/automation.md",
            type: "file",
          },
        ],
        name: ".mde",
        path: ".mde",
        type: "directory",
      },
      {
        children: [],
        name: ".vscode",
        path: ".vscode",
        type: "directory",
      },
      {
        name: ".draft.md",
        path: ".draft.md",
        type: "file",
      },
      {
        children: [
          {
            children: [],
            name: ".mde",
            path: "docs/.mde",
            type: "directory",
          },
        ],
        name: "docs",
        path: "docs",
        type: "directory",
      },
    ];

    expect(collectDefaultHiddenEntryPaths(nodes)).toEqual([
      ".vscode",
      ".draft.md",
      "docs/.mde",
    ]);
  });
});
