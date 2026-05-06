import { describe, expect, it } from "vitest";

import { searchWorkspacePaths } from "../../src/renderer/src/search/workspacePathSearch";
import type { TreeNode } from "@mde/editor-host/file-tree";

describe("workspace path search integration", () => {
  it("uses the editor-host file tree contract to produce direct-open path results", () => {
    const visibleTree: readonly TreeNode[] = [
      {
        children: [
          {
            name: "guide.md",
            path: "docs/guide.md",
            type: "file",
          },
        ],
        name: "docs",
        path: "docs",
        type: "directory",
      },
    ];

    expect(searchWorkspacePaths(visibleTree, "docs")).toEqual([
      {
        name: "guide.md",
        path: "docs/guide.md",
      },
    ]);
  });
});
