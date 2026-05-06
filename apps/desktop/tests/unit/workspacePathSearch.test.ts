import { describe, expect, it } from "vitest";

import { searchWorkspacePaths } from "../../src/renderer/src/search/workspacePathSearch";
import type { TreeNode } from "@mde/editor-host/file-tree";

const tree: readonly TreeNode[] = Object.freeze([
  {
    children: Object.freeze<TreeNode[]>([
      {
        children: Object.freeze<TreeNode[]>([
          {
            name: "deep.md",
            path: "docs/nested/deep.md",
            type: "file",
          },
        ]),
        name: "nested",
        path: "docs/nested",
        type: "directory",
      },
      {
        name: "intro.md",
        path: "docs/intro.md",
        type: "file",
      },
    ]),
    name: "docs",
    path: "docs",
    type: "directory",
  },
  {
    children: Object.freeze<TreeNode[]>([
      {
        name: "draft.md",
        path: "private/draft.md",
        type: "file",
      },
    ]),
    name: "private",
    path: "private",
    type: "directory",
  },
  {
    name: "README.md",
    path: "README.md",
    type: "file",
  },
]);

describe("workspace path search", () => {
  it("finds markdown files by case-insensitive path fragments", () => {
    expect(searchWorkspacePaths(tree, "NESTED/deep")).toEqual([
      {
        name: "deep.md",
        path: "docs/nested/deep.md",
      },
    ]);
  });

  it("matches slash-separated fuzzy path segments like a command palette", () => {
    expect(searchWorkspacePaths(tree, "dc/nt/dp")).toEqual([
      {
        name: "deep.md",
        path: "docs/nested/deep.md",
      },
    ]);
  });

  it("treats a leading at-sign as the path-search prefix", () => {
    expect(searchWorkspacePaths(tree, "@intro")).toEqual([
      {
        name: "intro.md",
        path: "docs/intro.md",
      },
    ]);
  });

  it("returns only file nodes and honors the result limit", () => {
    expect(searchWorkspacePaths(tree, "d", 2)).toEqual([
      {
        name: "deep.md",
        path: "docs/nested/deep.md",
      },
      {
        name: "intro.md",
        path: "docs/intro.md",
      },
    ]);
  });
});
