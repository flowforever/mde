import { describe, expect, it, vi } from "vitest";

import {
  createDropOpenPlan,
  getDroppedResourcePath,
  getRelativeWorkspacePath,
  hasDroppedResourceTransfer,
} from "../../src/renderer/src/app/dropOpen";

const createDataTransfer = ({
  files = [],
  types = [],
  uriList = "",
}: {
  readonly files?: readonly { readonly name?: string; readonly path?: string }[];
  readonly types?: readonly string[];
  readonly uriList?: string;
}) => ({
  files,
  getData: (type: string) => (type === "text/uri-list" ? uriList : ""),
  types,
});

describe("dropOpen", () => {
  it("detects local file transfers without accepting plain text drags", () => {
    expect(
      hasDroppedResourceTransfer(
        createDataTransfer({
          files: [],
          types: ["text/plain"],
        }),
      ),
    ).toBe(false);
    expect(
      hasDroppedResourceTransfer(
        createDataTransfer({
          files: [],
          types: ["Files"],
        }),
      ),
    ).toBe(true);
    expect(
      hasDroppedResourceTransfer(
        createDataTransfer({
          files: [{ path: "/notes/a.md" }],
          types: [],
        }),
      ),
    ).toBe(true);
  });

  it("reads dropped native paths from Electron File.path first", () => {
    expect(
      getDroppedResourcePath(
        createDataTransfer({
          files: [{ path: "/workspace/docs/a.md" }],
          types: ["Files"],
          uriList: "file:///ignored.md",
        }),
      ),
    ).toBe("/workspace/docs/a.md");
  });

  it("falls back to the Electron preload dropped-file resolver", () => {
    const droppedFile = { name: "external.md" };
    const resolveDroppedFilePath = vi.fn().mockReturnValue("/external/external.md");

    expect(
      getDroppedResourcePath(
        createDataTransfer({
          files: [droppedFile],
          types: ["Files"],
        }),
        resolveDroppedFilePath,
      ),
    ).toBe("/external/external.md");
    expect(resolveDroppedFilePath).toHaveBeenCalledWith(droppedFile);
  });

  it("uses the Electron preload resolver when the native file path is blank", () => {
    const droppedFile = { name: "external.md", path: "" };
    const resolveDroppedFilePath = vi.fn().mockReturnValue("/external/external.md");

    expect(
      getDroppedResourcePath(
        createDataTransfer({
          files: [droppedFile],
          types: ["Files"],
        }),
        resolveDroppedFilePath,
      ),
    ).toBe("/external/external.md");
    expect(resolveDroppedFilePath).toHaveBeenCalledWith(droppedFile);
  });

  it("reads the first usable file URI from text/uri-list", () => {
    expect(
      getDroppedResourcePath(
        createDataTransfer({
          uriList:
            "# Finder source\nhttps://example.com/nope\nfile:///Users/mde/My%20Note.md\nfile:///Users/mde/second.md",
        }),
      ),
    ).toBe("/Users/mde/My Note.md");
  });

  it("normalizes Windows file URIs from text/uri-list", () => {
    expect(
      getDroppedResourcePath(
        createDataTransfer({
          uriList: "file:///C:/Users/MDE/Notes/Win%20Note.md",
        }),
      ),
    ).toBe("C:/Users/MDE/Notes/Win Note.md");
  });

  it("computes workspace-relative paths without matching similar prefixes", () => {
    expect(getRelativeWorkspacePath("/workspace", "/workspace")).toBe("");
    expect(getRelativeWorkspacePath("/workspace/docs/a.md", "/workspace")).toBe(
      "docs/a.md",
    );
    expect(getRelativeWorkspacePath("/workspace-other/a.md", "/workspace")).toBe(
      null,
    );
    expect(
      getRelativeWorkspacePath(
        "C:\\Users\\MDE\\workspace\\docs\\a.md",
        "C:\\Users\\MDE\\workspace",
      ),
    ).toBe("docs/a.md");
  });

  it("plans current-window actions for resources inside an open workspace", () => {
    expect(
      createDropOpenPlan({
        currentWorkspace: {
          rootPath: "/workspace",
          type: "workspace",
        },
        droppedPath: {
          kind: "markdown-file",
          path: "/workspace/docs/a.md",
        },
      }),
    ).toEqual({
      filePath: "docs/a.md",
      kind: "load-workspace-file",
      refreshDirectoryPaths: ["docs"],
    });
    expect(
      createDropOpenPlan({
        currentWorkspace: {
          rootPath: "/workspace",
          type: "workspace",
        },
        droppedPath: {
          kind: "directory",
          path: "/workspace/docs",
        },
      }),
    ).toEqual({
      directoryPath: "docs",
      kind: "refresh-workspace-directory",
      refreshDirectoryPaths: ["docs"],
    });
    expect(
      createDropOpenPlan({
        currentWorkspace: {
          rootPath: "/workspace",
          type: "workspace",
        },
        droppedPath: {
          kind: "directory",
          path: "/workspace",
        },
      }),
    ).toEqual({
      kind: "refresh-workspace-root",
    });
  });

  it("plans external resources for a new window when a workspace or file is already open", () => {
    expect(
      createDropOpenPlan({
        currentWorkspace: {
          rootPath: "/workspace",
          type: "workspace",
        },
        droppedPath: {
          kind: "markdown-file",
          path: "/other/note.md",
        },
      }),
    ).toEqual({
      kind: "open-new-window",
      resourcePath: "/other/note.md",
    });
    expect(
      createDropOpenPlan({
        currentWorkspace: {
          rootPath: "/workspace",
          type: "file",
        },
        droppedPath: {
          kind: "markdown-file",
          path: "/workspace/sibling.md",
        },
      }),
    ).toEqual({
      kind: "open-new-window",
      resourcePath: "/workspace/sibling.md",
    });
  });

  it("plans external resources for the current window when nothing is open", () => {
    expect(
      createDropOpenPlan({
        currentWorkspace: null,
        droppedPath: {
          kind: "directory",
          path: "/workspace",
        },
      }),
    ).toEqual({
      kind: "open-current-window",
      resourcePath: "/workspace",
    });
  });

  it("rejects unsupported dropped files before changing window state", () => {
    expect(
      createDropOpenPlan({
        currentWorkspace: {
          rootPath: "/workspace",
          type: "workspace",
        },
        droppedPath: {
          kind: "unsupported-file",
          path: "/other/plain.txt",
        },
      }),
    ).toEqual({
      kind: "unsupported",
      resourcePath: "/other/plain.txt",
    });
  });
});
