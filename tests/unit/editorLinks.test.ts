import { describe, expect, it } from "vitest";

import {
  collectMarkdownFilePaths,
  createMarkdownPathSuggestions,
  createRelativeMarkdownLink,
  findContainingWorkspace,
  resolveEditorLinkTarget,
} from "../../src/renderer/src/editor/editorLinks";
import type { TreeNode } from "../../src/shared/fileTree";

const tree: readonly TreeNode[] = [
  { name: "README.md", path: "README.md", type: "file" },
  {
    children: [
      { name: "intro.md", path: "docs/intro.md", type: "file" },
      {
        children: [
          { name: "deep.md", path: "docs/nested/deep.md", type: "file" },
        ],
        name: "nested",
        path: "docs/nested",
        type: "directory",
      },
    ],
    name: "docs",
    path: "docs",
    type: "directory",
  },
];

describe("editor link helpers", () => {
  it("collects Markdown file paths from the workspace tree", () => {
    expect(collectMarkdownFilePaths(tree)).toEqual([
      "README.md",
      "docs/intro.md",
      "docs/nested/deep.md",
    ]);
  });

  it("matches path suggestions by slash-separated query parts", () => {
    expect(
      createMarkdownPathSuggestions("doc/dee", collectMarkdownFilePaths(tree), {
        currentFilePath: "docs/intro.md",
      }).map((suggestion) => suggestion.path),
    ).toEqual(["docs/nested/deep.md"]);
  });

  it("creates relative Markdown hrefs from the current document", () => {
    expect(createRelativeMarkdownLink("docs/current.md", "docs/intro.md")).toBe(
      "intro.md",
    );
    expect(
      createRelativeMarkdownLink("docs/current.md", "docs/nested/deep.md"),
    ).toBe("nested/deep.md");
    expect(createRelativeMarkdownLink("README.md", "docs/intro.md")).toBe(
      "docs/intro.md",
    );
  });

  it("resolves same-workspace relative links to current-window file opens", () => {
    expect(
      resolveEditorLinkTarget({
        currentFilePath: "docs/current.md",
        currentWorkspaceRoot: "/workspace",
        href: "nested/deep.md",
        recentWorkspaces: [],
      }),
    ).toEqual({
      filePath: "docs/nested/deep.md",
      kind: "workspace-file",
    });
  });

  it("routes http and https links to the external browser", () => {
    expect(
      resolveEditorLinkTarget({
        currentFilePath: "README.md",
        currentWorkspaceRoot: "/workspace",
        href: "https://example.com/docs",
        recentWorkspaces: [],
      }),
    ).toEqual({
      kind: "external",
      url: "https://example.com/docs",
    });
  });

  it("prefers the deepest remembered workspace for absolute links", () => {
    expect(
      findContainingWorkspace("/workspace/docs/deep/file.md", [
        { name: "Workspace", rootPath: "/workspace", type: "workspace" },
        {
          name: "Docs",
          rootPath: "/workspace/docs",
          type: "workspace",
        },
      ]),
    ).toEqual({
      filePath: "deep/file.md",
      workspaceRoot: "/workspace/docs",
    });
  });

  it("routes absolute links under remembered workspaces to a new workspace window", () => {
    expect(
      resolveEditorLinkTarget({
        currentFilePath: "README.md",
        currentWorkspaceRoot: "/current",
        href: "/workspace/docs/deep/file.md",
        recentWorkspaces: [
          {
            name: "Docs",
            rootPath: "/workspace/docs",
            type: "workspace",
          },
        ],
      }),
    ).toEqual({
      filePath: "deep/file.md",
      kind: "workspace-file-new-window",
      workspaceRoot: "/workspace/docs",
    });
  });
});
