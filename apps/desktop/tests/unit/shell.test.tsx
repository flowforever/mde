import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPONENT_IDS } from "../../src/renderer/src/componentIds";

interface MockMarkdownBlockEditorProps {
  readonly activeSearchMatchIndex?: number;
  readonly colorScheme: "dark" | "light";
  readonly errorMessage: string | null;
  readonly isDirty: boolean;
  readonly isReadOnly?: boolean;
  readonly isSaving: boolean;
  readonly lineSpacing?: "compact" | "relaxed" | "standard";
  readonly markdown: string;
  readonly onExitHistoryPreview?: () => void;
  readonly onMarkdownChange: (contents: string) => void;
  readonly onOpenLink?: (href: string) => void;
  readonly onRestoreHistoryPreview?: () => void;
  readonly onSearchStateChange?: (state: {
    readonly activeMatchIndex: number;
    readonly matchCount: number;
  }) => void;
  readonly path: string;
  readonly pinnedSearchQueries?: readonly string[];
  readonly searchQuery?: string;
}

const mockEditorState = vi.hoisted(() => ({
  changeIndex: 0,
}));

vi.mock("@mde/editor-react", async (importOriginal) => {
  const actual = await importOriginal();
  const MockMarkdownBlockEditor = (props: MockMarkdownBlockEditorProps) => (
    <section
      aria-label="Mock editor"
      onDrop={(event) => {
        event.stopPropagation();
      }}
    >
      <span>{props.path}</span>
      <span>{props.markdown}</span>
      <span data-testid="mock-editor-color-scheme">{props.colorScheme}</span>
      <span data-testid="mock-editor-line-spacing">
        {props.lineSpacing ?? "standard"}
      </span>
      {props.searchQuery ? (
        <span data-testid="mock-editor-search-query">{props.searchQuery}</span>
      ) : null}
      {props.pinnedSearchQueries && props.pinnedSearchQueries.length > 0 ? (
        <span data-testid="mock-editor-pinned-search-queries">
          {props.pinnedSearchQueries.join(",")}
        </span>
      ) : null}
      {props.isReadOnly ? (
        <span data-testid="mock-editor-readonly">read-only</span>
      ) : null}
      {props.isDirty ? <span>Unsaved changes</span> : null}
      {props.isSaving ? <span>Saving...</span> : null}
      {props.errorMessage ? <p role="alert">{props.errorMessage}</p> : null}
      <button
        onClick={() => {
          if (props.isReadOnly) {
            return;
          }

          mockEditorState.changeIndex += 1;
          props.onMarkdownChange(`# Changed ${mockEditorState.changeIndex}`);
        }}
        type="button"
      >
        Change mock markdown
      </button>
      <button
        onClick={() => {
          if (props.isReadOnly) {
            return;
          }

          props.onMarkdownChange("");
        }}
        type="button"
      >
        Clear mock markdown
      </button>
      <button
        onClick={() => {
          props.onExitHistoryPreview?.();
        }}
        type="button"
      >
        Exit preview
      </button>
      <button
        onClick={() => {
          props.onRestoreHistoryPreview?.();
        }}
        type="button"
      >
        Restore this version
      </button>
      <button
        onClick={() => {
          props.onOpenLink?.("docs/intro.md");
        }}
        type="button"
      >
        Open mock workspace link
      </button>
      <button
        onClick={() => {
          props.onOpenLink?.("https://example.com/docs");
        }}
        type="button"
      >
        Open mock external link
      </button>
      <button
        onClick={() => {
          props.onOpenLink?.("/other-workspace/docs/guide.md");
        }}
        type="button"
      >
        Open mock known workspace link
      </button>
    </section>
  );

  return { ...(actual as object), MarkdownBlockEditor: MockMarkdownBlockEditor };
});

import { App } from "../../src/renderer/src/app/App";
import { APP_THEME_STORAGE_KEY } from "../../src/renderer/src/theme/appThemes";
import type { AiApi, AiGenerationResult } from "../../src/shared/ai";
import type { TreeNode } from "@mde/editor-host/file-tree";
import type { UpdateApi } from "../../src/shared/update";
import type { EditorApi } from "../../src/shared/workspace";

const createDeferred = <Value,>(): {
  readonly promise: Promise<Value>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: Value) => void;
} => {
  let resolveDeferred: (value: Value) => void = () => undefined;
  let rejectDeferred: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  return {
    promise,
    reject: rejectDeferred,
    resolve: resolveDeferred,
  };
};

const mockSystemThemePreference = (initialMatches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    addEventListener: vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.add(listener);
        }
      },
    ),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    dispatchEvent: vi.fn(),
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    removeEventListener: vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.delete(listener);
        }
      },
    ),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue(mediaQueryList),
  });

  return {
    setMatches: (matches: boolean) => {
      Object.defineProperty(mediaQueryList, "matches", {
        configurable: true,
        value: matches,
      });
      listeners.forEach((listener) => {
        listener({
          matches,
          media: "(prefers-color-scheme: dark)",
        } as MediaQueryListEvent);
      });
    },
  };
};

const mockNavigatorLanguages = (languages: readonly string[]): void => {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: languages,
  });
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: languages[0] ?? "en-US",
  });
};

describe("App shell", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    mockEditorState.changeIndex = 0;
    localStorage.clear();
    document.title = "MDE";
    Reflect.deleteProperty(window, "aiApi");
    Reflect.deleteProperty(window, "editorApi");
    Reflect.deleteProperty(window, "updateApi");
    mockNavigatorLanguages(["en-US"]);
  });

  it("uses the system language on first launch and persists Preference language changes", async () => {
    const user = userEvent.setup();

    mockNavigatorLanguages(["zh-CN", "en-US"]);

    render(<App />);

    expect(
      await screen.findByRole("dialog", { name: /工作区管理/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /打开工作区/ })).toBeVisible();
    expect(document.documentElement.lang).toBe("zh-CN");

    await user.click(screen.getByRole("button", { name: /设置/ }));
    await user.click(screen.getByRole("button", { name: /偏好/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /语言/ }),
      "en",
    );

    expect(screen.getByRole("heading", { name: /^Settings$/ })).toBeVisible();
    expect(localStorage.getItem("mde.appLanguagePreference")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("opens a centered workspace popup on initial empty launch", () => {
    render(<App />);

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-theme",
      "manuscript",
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-theme-family",
      "light",
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-panel-family",
      "light",
    );
    expect(
      screen.getByRole("button", { name: /open settings/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("dialog", { name: /workspace manager/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^open workspace$/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /open new workspace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open markdown file/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search workspaces and files/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /search workspaces and files/i }),
    ).toHaveAttribute("type", "text");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("reopens the initial workspace popup from the trigger after dismissal", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole("button", { name: /close workspace popup/i }),
    );

    expect(
      screen.queryByRole("dialog", { name: /workspace manager/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^open workspace$/i }));

    expect(
      screen.getByRole("dialog", { name: /workspace manager/i }),
    ).toBeInTheDocument();
  });

  it("keeps initial empty states visible by text", () => {
    render(<App />);

    expect(
      screen.getByText(/open a folder to browse markdown files/i),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /select a folder to begin/i }),
    ).toBeVisible();
  });

  it("surfaces a useful error when the preload editor API is missing", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole("button", { name: /open new workspace/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /editor api unavailable/i,
    );
  });

  it("opens a launch path supplied by preload", async () => {
    const editorApi = {
      consumeLaunchPath: vi
        .fn()
        .mockResolvedValueOnce("/notes/API.md")
        .mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/notes/API.md",
        name: "API.md",
        openedFilePath: "API.md",
        rootPath: "/notes",
        tree: [{ name: "API.md", path: "API.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# API",
        path: "API.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    await waitFor(() => {
      expect(editorApi.openPath).toHaveBeenCalledWith("/notes/API.md");
    });

    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith("API.md", "/notes");
    expect(
      await screen.findByRole("button", { name: /manage workspaces/i }),
    ).toHaveTextContent("API.md");
    await waitFor(() => {
      expect(document.title).toBe("API.md - /notes");
    });
    expect(
      screen.queryByRole("dialog", { name: /workspace manager/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a non-blocking notice after repairing image assets on file open", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openWorkspace: vi.fn().mockResolvedValue({
        name: "Workspace",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# README\n\n![Moved](.mde/assets/moved.png)",
        path: "README.md",
        repairedImageAssetCount: 1,
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /open new workspace/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /README\.md Markdown file/i }),
    );

    expect(
      await screen.findByText("Restored 1 missing image asset."),
    ).toBeVisible();
    expect(await screen.findByLabelText("Mock editor")).toBeVisible();
  });

  it("switches to a remembered workspace from the workspace menu", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Error invoking remote method 'workspace:open-path': Error: No handler registered for 'workspace:open-path'",
          ),
        ),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Second Workspace",
        rootPath: "/workspaces/second",
        tree: [],
        type: "workspace",
      }),
      readMarkdownFile: vi.fn(),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.recentWorkspaces",
      JSON.stringify([
        {
          name: "Second Workspace",
          rootPath: "/workspaces/second",
          type: "workspace",
        },
      ]),
    );

    render(<App />);

    await screen.findByRole("dialog", { name: /workspace manager/i });
    await user.click(
      screen.getByRole("button", {
        name: /switch to workspace Second Workspace/i,
      }),
    );

    expect(editorApi.openWorkspaceByPath).toHaveBeenCalledWith(
      "/workspaces/second",
    );
    expect(editorApi.openPath).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: /manage workspaces/i }),
    ).toHaveTextContent("Second Workspace");
    expect(document.title).toBe("/workspaces/second");
  });

  it("opens a new workspace dialog selection in another window when one is already active", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openPathInNewWindow: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Current Workspace",
        rootPath: "/workspaces/current",
        tree: [],
        type: "workspace",
      }),
      openWorkspaceInNewWindow: vi.fn().mockResolvedValue(true),
      readMarkdownFile: vi.fn(),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Current Workspace",
        rootPath: "/workspaces/current",
        type: "workspace",
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("button", { name: /manage workspaces/i }),
    ).toHaveTextContent("Current Workspace");

    await user.click(
      screen.getByRole("button", { name: /manage workspaces/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /open new workspace/i }),
    );

    expect(editorApi.openWorkspaceInNewWindow).toHaveBeenCalledTimes(1);
    expect(editorApi.openWorkspace).not.toHaveBeenCalled();
    expect(editorApi.openWorkspaceByPath).toHaveBeenCalledWith(
      "/workspaces/current",
    );
    expect(
      screen.getByRole("button", { name: /manage workspaces/i }),
    ).toHaveTextContent("Current Workspace");
  });

  it("opens a dropped external path in a new window when a workspace is active", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      inspectPath: vi.fn().mockResolvedValue({
        kind: "markdown-file",
        path: "/external/external.md",
      }),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openPathInNewWindow: vi.fn().mockResolvedValue(undefined),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Current Workspace",
        rootPath: "/workspaces/current",
        tree: [],
        type: "workspace",
      }),
      openWorkspaceInNewWindow: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;
    const droppedFile = new File(["# External"], "external.md", {
      type: "text/markdown",
    });

    Object.defineProperty(droppedFile, "path", {
      configurable: true,
      value: "/external/external.md",
    });
    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Current Workspace",
        rootPath: "/workspaces/current",
        type: "workspace",
      }),
    );

    render(<App />);

    await screen.findByRole("button", { name: /manage workspaces/i });

    fireEvent.drop(screen.getByRole("main"), {
      dataTransfer: {
        files: [droppedFile],
        getData: vi.fn().mockReturnValue(""),
      },
    });

    await waitFor(() => {
      expect(editorApi.openPathInNewWindow).toHaveBeenCalledWith(
        "/external/external.md",
      );
    });
    expect(editorApi.openPath).not.toHaveBeenCalledWith(
      "/external/external.md",
    );
  });

  it("captures dropped files inside the editor and resolves paths through preload", async () => {
    const editorApi = {
      consumeLaunchPath: vi
        .fn()
        .mockResolvedValueOnce("/workspaces/current/README.md")
        .mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      getDroppedFilePath: vi.fn().mockReturnValue("/external/external.md"),
      inspectPath: vi.fn().mockResolvedValue({
        kind: "markdown-file",
        path: "/external/external.md",
      }),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspaces/current/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspaces/current",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openPathInNewWindow: vi.fn().mockResolvedValue(undefined),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Current",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;
    const droppedFile = new File(["# External"], "external.md", {
      type: "text/markdown",
    });

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    const editorRegion = await screen.findByRole("region", {
      name: /mock editor/i,
    });

    fireEvent.drop(editorRegion, {
      dataTransfer: {
        files: [droppedFile],
        getData: vi.fn().mockReturnValue(""),
      },
    });

    await waitFor(() => {
      expect(editorApi.getDroppedFilePath).toHaveBeenCalledWith(droppedFile);
      expect(editorApi.openPathInNewWindow).toHaveBeenCalledWith(
        "/external/external.md",
      );
    });
    expect(editorApi.openPath).toHaveBeenCalledTimes(1);
  });

  it("opens same-workspace editor links in the current window", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openExternalLink: vi.fn(),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openPathInNewWindow: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Workspace",
        rootPath: "/workspace",
        tree: [
          { name: "README.md", path: "README.md", type: "file" },
          {
            children: [
              { name: "intro.md", path: "docs/intro.md", type: "file" },
            ],
            name: "docs",
            path: "docs",
            type: "directory",
          },
        ],
        type: "workspace",
      }),
      readMarkdownFile: vi
        .fn()
        .mockResolvedValueOnce({
          contents: "# README",
          path: "README.md",
        })
        .mockResolvedValueOnce({
          contents: "# Intro",
          path: "docs/intro.md",
        }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Workspace",
        rootPath: "/workspace",
        type: "workspace",
      }),
    );
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: "README.md",
          recentFilePaths: ["README.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );

    render(<App />);

    await screen.findByText("# README");
    await user.click(
      screen.getByRole("button", { name: /open mock workspace link/i }),
    );

    await waitFor(() => {
      expect(editorApi.readMarkdownFile).toHaveBeenCalledWith(
        "docs/intro.md",
        "/workspace",
      );
    });
    expect(editorApi.openPathInNewWindow).not.toHaveBeenCalled();
    expect(editorApi.openExternalLink).not.toHaveBeenCalled();
  });

  it("opens http editor links in the external browser", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openExternalLink: vi.fn().mockResolvedValue(undefined),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openPathInNewWindow: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Workspace",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# README",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Workspace",
        rootPath: "/workspace",
        type: "workspace",
      }),
    );
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: "README.md",
          recentFilePaths: ["README.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );

    render(<App />);

    await screen.findByText("# README");
    await user.click(
      screen.getByRole("button", { name: /open mock external link/i }),
    );

    expect(editorApi.openExternalLink).toHaveBeenCalledWith(
      "https://example.com/docs",
    );
    expect(editorApi.openPathInNewWindow).not.toHaveBeenCalled();
  });

  it("opens editor links under remembered workspaces in a new workspace window", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openPathInNewWindow: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Workspace",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      openWorkspaceFileInNewWindow: vi.fn().mockResolvedValue(undefined),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# README",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Workspace",
        rootPath: "/workspace",
        type: "workspace",
      }),
    );
    localStorage.setItem(
      "mde.recentWorkspaces",
      JSON.stringify([
        {
          name: "Other",
          rootPath: "/other-workspace",
          type: "workspace",
        },
      ]),
    );
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: "README.md",
          recentFilePaths: ["README.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );

    render(<App />);

    await screen.findByText("# README");
    await user.click(
      screen.getByRole("button", {
        name: /open mock known workspace link/i,
      }),
    );

    expect(editorApi.openWorkspaceFileInNewWindow).toHaveBeenCalledWith(
      "/other-workspace",
      "docs/guide.md",
    );
    expect(editorApi.openPathInNewWindow).not.toHaveBeenCalled();
  });

  it("switches to a remembered file from the workspace menu without generic openPath IPC", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn().mockResolvedValue({
        filePath: "/notes/API.md",
        name: "API.md",
        openedFilePath: "API.md",
        rootPath: "/notes",
        tree: [{ name: "API.md", path: "API.md", type: "file" }],
        type: "file",
      }),
      openPath: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Error invoking remote method 'workspace:open-path': Error: No handler registered for 'workspace:open-path'",
          ),
        ),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# API",
        path: "API.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.recentWorkspaces",
      JSON.stringify([
        {
          filePath: "/notes/API.md",
          name: "API.md",
          openedFilePath: "API.md",
          rootPath: "/notes",
          type: "file",
        },
      ]),
    );

    render(<App />);

    await screen.findByRole("dialog", { name: /workspace manager/i });
    await user.click(
      screen.getByRole("button", {
        name: /switch to file API\.md/i,
      }),
    );

    expect(editorApi.openFileByPath).toHaveBeenCalledWith("/notes/API.md");
    expect(editorApi.openPath).not.toHaveBeenCalled();
    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith("API.md", "/notes");
    expect(
      await screen.findByRole("button", { name: /manage workspaces/i }),
    ).toHaveTextContent("API.md");
    expect(document.title).toBe("API.md - /notes");
  });

  it("restores the active workspace and last opened file on renderer launch", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Workspace",
        rootPath: "/workspace",
        tree: [
          { name: "README.md", path: "README.md", type: "file" },
          {
            children: [
              { name: "intro.md", path: "docs/intro.md", type: "file" },
            ],
            name: "docs",
            path: "docs",
            type: "directory",
          },
        ],
        type: "workspace",
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Intro",
        path: "docs/intro.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Workspace",
        rootPath: "/workspace",
        type: "workspace",
      }),
    );
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: "docs/intro.md",
          recentFilePaths: ["docs/intro.md", "README.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );

    render(<App />);

    await waitFor(() => {
      expect(editorApi.openWorkspaceByPath).toHaveBeenCalledWith("/workspace");
    });
    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith(
      "docs/intro.md",
      "/workspace",
    );
    expect(await screen.findAllByText("docs/intro.md")).not.toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: /open recent file README\.md/i }),
    );
    await waitFor(() => {
      expect(editorApi.readMarkdownFile).toHaveBeenCalledWith(
        "README.md",
        "/workspace",
      );
    });
    expect(
      screen.queryByRole("dialog", { name: /workspace manager/i }),
    ).not.toBeInTheDocument();
  });

  it("hydrates and renders at most twenty recent files in the explorer", async () => {
    const recentFilePaths = Array.from(
      { length: 24 },
      (_value, index) => `docs/recent-${index + 1}.md`,
    );
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "Workspace",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Recent 1",
        path: "docs/recent-24.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "Workspace",
        rootPath: "/workspace",
        type: "workspace",
      }),
    );
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: "docs/recent-24.md",
          recentFilePaths,
          workspaceRoot: "/workspace",
        },
      ]),
    );

    render(<App />);

    await waitFor(() => {
      expect(editorApi.openWorkspaceByPath).toHaveBeenCalledWith("/workspace");
    });

    expect(
      await screen.findAllByRole("button", { name: /open recent file/i }),
    ).toHaveLength(20);
    expect(
      screen.getByRole("button", {
        name: /open recent file docs\/recent-1\.md/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /open recent file docs\/recent-20\.md/i,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /open recent file docs\/recent-21\.md/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("refreshes the root, expanded folders, and current file ancestors from explorer refresh", async () => {
    const user = userEvent.setup();
    const nestedChildren: readonly TreeNode[] = [
      { name: "deep.md", path: "docs/nested/deep.md", type: "file" },
    ];
    const docsChildren: readonly TreeNode[] = [
      {
        children: nestedChildren,
        name: "nested",
        path: "docs/nested",
        type: "directory",
      },
      { name: "intro.md", path: "docs/intro.md", type: "file" },
    ];
    const rootTree: readonly TreeNode[] = [
      {
        children: docsChildren,
        name: "docs",
        path: "docs",
        type: "directory",
      },
    ];
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(
        (directoryPath: string): Promise<readonly TreeNode[]> => {
          if (directoryPath === "docs") {
            return Promise.resolve(docsChildren);
          }

          if (directoryPath === "docs/nested") {
            return Promise.resolve(nestedChildren);
          }

          return Promise.resolve(rootTree);
        },
      ),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: "workspace",
        rootPath: "/workspace",
        tree: rootTree,
        type: "workspace",
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Deep",
        path: "docs/nested/deep.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      "mde.activeWorkspace",
      JSON.stringify({
        name: "workspace",
        rootPath: "/workspace",
        type: "workspace",
      }),
    );
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: "docs/nested/deep.md",
          recentFilePaths: ["docs/nested/deep.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );

    render(<App />);

    await waitFor(() => {
      expect(editorApi.readMarkdownFile).toHaveBeenCalledWith(
        "docs/nested/deep.md",
        "/workspace",
      );
    });
    const docsRow = screen.getByRole("button", { name: /docs folder/i });

    expect(docsRow).toHaveAttribute("aria-expanded", "true");
    await user.click(docsRow);
    await waitFor(() => {
      expect(docsRow).toHaveAttribute("aria-expanded", "false");
    });
    editorApi.listDirectory.mockClear();

    await user.click(screen.getByRole("button", { name: /refresh explorer/i }));

    await waitFor(() => {
      expect(
        editorApi.listDirectory.mock.calls.map(
          ([directoryPath]) => directoryPath,
        ),
      ).toEqual(["", "docs", "docs/nested"]);
    });
  });

  it("searches and forgets remembered workspace resources in the popup", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      "mde.recentWorkspaces",
      JSON.stringify([
        ...Array.from({ length: 12 }, (_, index) => ({
          name: `Workspace ${index + 1}`,
          rootPath: `/workspaces/${index + 1}`,
          type: "workspace",
        })),
        {
          filePath: "/notes/API.md",
          name: "API.md",
          openedFilePath: "API.md",
          rootPath: "/notes",
          type: "file",
        },
      ]),
    );

    render(<App />);

    await screen.findByRole("dialog", { name: /workspace manager/i });
    await user.type(
      screen.getByRole("searchbox", { name: /search workspaces and files/i }),
      "api",
    );

    expect(
      screen.getByRole("button", { name: /switch to file API\.md/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /switch to workspace Workspace 1/i,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove recent file API\.md/i }),
    );

    expect(
      screen.queryByRole("button", { name: /switch to file API\.md/i }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("mde.recentWorkspaces")).not.toContain(
      "API.md",
    );
  });

  it("opens a standalone markdown file and remembers it from the popup", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn().mockResolvedValue({
        filePath: "/notes/API.md",
        name: "API.md",
        openedFilePath: "API.md",
        rootPath: "/notes",
        tree: [{ name: "API.md", path: "API.md", type: "file" }],
        type: "file",
      }),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# API",
        path: "API.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    await screen.findByRole("dialog", { name: /workspace manager/i });
    await user.click(
      screen.getByRole("button", { name: /open markdown file/i }),
    );

    expect(editorApi.openFile).toHaveBeenCalledTimes(1);
    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith("API.md", "/notes");
    expect(
      await screen.findByRole("button", { name: /manage workspaces/i }),
    ).toHaveTextContent("API.md");
    expect(localStorage.getItem("mde.recentWorkspaces")).toContain(
      '"type":"file"',
    );
  });

  it("shows a macOS update dialog and opens the downloaded installer", async () => {
    const user = userEvent.setup();
    const updateApi = {
      checkForUpdates: vi.fn().mockResolvedValue({
        currentVersion: "1.1.1",
        update: {
          assetName: "MDE-1.2.0-mac-arm64.dmg",
          assetSize: 456,
          currentVersion: "1.1.1",
          installMode: "open-dmg",
          latestVersion: "1.2.0",
          publishedAt: "2026-04-29T09:11:32.622Z",
          releaseName: "MDE 1.2.0",
          releaseNotes: "Editor update improvements.",
          releaseUrl: "https://github.com/flowforever/mde/releases/tag/v1.2.0",
        },
        updateAvailable: true,
      }),
      downloadAndOpenUpdate: vi.fn().mockResolvedValue({
        filePath:
          "/Users/test/Library/Application Support/MDE/updates/MDE-1.2.0-mac-arm64.dmg",
        version: "1.2.0",
      }),
      installWindowsUpdate: vi.fn(),
      onUpdateAvailable: vi.fn(() => vi.fn()),
      onUpdateDownloadProgress: vi.fn(() => vi.fn()),
      onUpdateReady: vi.fn(() => vi.fn()),
    } satisfies UpdateApi;

    Object.defineProperty(window, "updateApi", {
      configurable: true,
      value: updateApi,
    });

    render(<App />);

    expect(
      await screen.findByRole("dialog", { name: /mde update/i }),
    ).toBeVisible();
    expect(screen.getByText(/editor update improvements/i)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /download and install/i }),
    );

    await waitFor(() => {
      expect(updateApi.downloadAndOpenUpdate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/installer has opened/i)).toBeVisible();
    expect(screen.getByText(/drag MDE to Applications/i)).toBeVisible();
  });

  it("checks for updates from the unified settings panel", async () => {
    const user = userEvent.setup();
    const updateApi = {
      checkForUpdates: vi.fn().mockResolvedValue({
        currentVersion: "1.2.12",
        message: "MDE is up to date.",
        updateAvailable: false,
      }),
      downloadAndOpenUpdate: vi.fn(),
      installWindowsUpdate: vi.fn(),
      onUpdateAvailable: vi.fn(() => vi.fn()),
      onUpdateDownloadProgress: vi.fn(() => vi.fn()),
      onUpdateReady: vi.fn(() => vi.fn()),
    } satisfies UpdateApi;

    Object.defineProperty(window, "updateApi", {
      configurable: true,
      value: updateApi,
    });

    render(<App />);

    await waitFor(() => {
      expect(updateApi.checkForUpdates).toHaveBeenCalledTimes(1);
    });
    updateApi.checkForUpdates.mockClear();

    await user.click(screen.getByRole("button", { name: /open settings/i }));
    await user.click(screen.getByRole("button", { name: /check update/i }));

    const settingsDialog = screen.getByRole("dialog", { name: /settings/i });
    const checkUpdatesButton = screen.getByRole("button", {
      name: /check for updates/i,
    });

    expect(settingsDialog).toBeVisible();
    expect(settingsDialog).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.settings.dialog,
    );
    expect(checkUpdatesButton).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.settings.checkUpdatesButton,
    );
    expect(screen.getByText(/current version/i)).toBeVisible();

    await user.click(checkUpdatesButton);

    await waitFor(() => {
      expect(updateApi.checkForUpdates).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/mde is up to date/i)).toBeVisible();
  });

  it("toggles the editor between centered and full-width views", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    const editorPane = screen.getByRole("region", { name: /editor/i });
    const fullWidthButton = await screen.findByRole("button", {
      name: /use full-width editor view/i,
    });

    expect(editorPane).not.toHaveClass("is-editor-full-width");

    await user.click(fullWidthButton);

    expect(editorPane).toHaveClass("is-editor-full-width");
    expect(localStorage.getItem("mde.editorViewMode")).toBe("full-width");

    await user.click(
      screen.getByRole("button", { name: /use centered editor view/i }),
    );

    expect(editorPane).not.toHaveClass("is-editor-full-width");
    expect(localStorage.getItem("mde.editorViewMode")).toBe("centered");
  });

  it("collapses overflowing editor actions with prioritized visible buttons", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: "/fake/codex", id: "codex", name: "Codex" }],
      }),
      summarizeMarkdown: vi.fn(),
      translateMarkdown: vi.fn(),
    } satisfies AiApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    await screen.findByRole("button", { name: /translate markdown/i });
    const actionBar = document.querySelector<HTMLElement>(".editor-action-bar");
    expect(actionBar).not.toBeNull();

    const readActionButtonLabels = (): string[] =>
      within(actionBar!)
        .getAllByRole("button")
        .map(
          (button) =>
            button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
        );

    await waitFor(() => {
      expect(readActionButtonLabels()).toEqual([
        "Show all editor actions",
        "Version history",
        "Summarize Markdown",
        "Translate Markdown",
        "Search current Markdown",
      ]);
    });
    expect(
      screen.queryByRole("button", { name: /use full-width editor view/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /editor line spacing/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /show all editor actions/i }),
    );

    expect(readActionButtonLabels()).toEqual([
      "Collapse editor actions",
      "Editor line spacing",
      "Use full-width editor view",
      "Version history",
      "Summarize Markdown",
      "Translate Markdown",
      "Search current Markdown",
    ]);
    expect(
      screen.getByRole("button", { name: /use full-width editor view/i }),
    ).not.toHaveAttribute("aria-pressed");

    await user.click(
      screen.getByRole("button", { name: /collapse editor actions/i }),
    );

    expect(readActionButtonLabels()).toEqual([
      "Show all editor actions",
      "Version history",
      "Summarize Markdown",
      "Translate Markdown",
      "Search current Markdown",
    ]);
  });

  it("restores the remembered full-width editor view on launch", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem("mde.editorViewMode", "full-width");

    render(<App />);

    expect(screen.getByRole("region", { name: /editor/i })).toHaveClass(
      "is-editor-full-width",
    );
    expect(
      await screen.findByRole("button", {
        name: /use centered editor view/i,
      }),
    ).toBeVisible();
  });

  it("changes and persists editor line spacing from the toolbar", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    expect(await screen.findByTestId("mock-editor-line-spacing")).toHaveTextContent(
      "standard",
    );

    await user.click(
      screen.getByRole("button", {
        name: /editor line spacing/i,
      }),
    );
    await user.click(screen.getByRole("menuitemradio", { name: /relaxed/i }));

    expect(screen.getByTestId("mock-editor-line-spacing")).toHaveTextContent(
      "relaxed",
    );
    expect(localStorage.getItem("mde.editorLineSpacing")).toBe("relaxed");
  });

  it("restores the remembered editor line spacing on launch", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem("mde.editorLineSpacing", "compact");

    render(<App />);

    expect(await screen.findByTestId("mock-editor-line-spacing")).toHaveTextContent(
      "compact",
    );
  });

  it("shows AI actions for detected CLIs and renders read-only generated results", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: "/fake/codex", id: "codex", name: "Codex" }],
      }),
      generateAppLanguagePack: vi.fn().mockResolvedValue({
        entries: [
          { key: "settings.title", text: "Ajustes" },
          { key: "workspace.openWorkspace", text: "Abrir workspace" },
        ],
        language: "Spanish",
        tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
      }),
      summarizeMarkdown: vi
        .fn()
        .mockResolvedValueOnce({
          cached: false,
          contents: "## Summary\n\n- Original summarized.",
          kind: "summary",
          path: ".mde/translations/README-summary.md",
          tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
        })
        .mockResolvedValueOnce({
          cached: false,
          contents: "## Summary\n\n- Shorter original summary.",
          kind: "summary",
          path: ".mde/translations/README-summary.md",
          tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
        }),
      translateMarkdown: vi.fn().mockResolvedValue({
        cached: false,
        contents: "# English\n\nOriginal translated.",
        kind: "translation",
        language: "English",
        path: ".mde/translations/README.English.md",
        tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
      }),
    } satisfies AiApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    const summaryButton = await screen.findByRole("button", {
      name: /summarize markdown/i,
    });

    await user.click(summaryButton);

    expect(aiApi.summarizeMarkdown).toHaveBeenCalledWith(
      "README.md",
      "# Original",
      "/workspace",
      undefined,
      undefined,
    );
    const summaryResult = await screen.findByRole("region", {
      name: /ai result/i,
    });

    expect(summaryResult).toHaveTextContent("Original summarized");
    expect(
      within(summaryResult).getByTestId("mock-editor-readonly"),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /refine summary instruction/i }),
    ).toBeVisible();

    await user.type(
      screen.getByRole("textbox", { name: /refine summary instruction/i }),
      "Make it shorter",
    );
    await user.click(
      screen.getByRole("button", { name: /regenerate summary/i }),
    );

    expect(aiApi.summarizeMarkdown).toHaveBeenLastCalledWith(
      "README.md",
      "# Original",
      "/workspace",
      "Make it shorter",
      undefined,
    );
    expect(
      await screen.findByRole("region", { name: /ai result/i }),
    ).toHaveTextContent("Shorter original summary");

    await user.click(
      screen.getByRole("button", { name: /translate markdown/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /English/i }));

    expect(aiApi.translateMarkdown).toHaveBeenCalledWith(
      "README.md",
      "# Original",
      "English",
      "/workspace",
      undefined,
    );
    expect(
      await screen.findByRole("region", { name: /ai result/i }),
    ).toHaveTextContent("Original translated");
    expect(
      screen.queryByRole("textbox", { name: /refine summary instruction/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /translate markdown/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /custom translation language/i }),
      "Japanese",
    );
    await user.click(
      screen.getByRole("button", { name: /add translation language/i }),
    );

    expect(aiApi.translateMarkdown).toHaveBeenLastCalledWith(
      "README.md",
      "# Original",
      "Japanese",
      "/workspace",
      undefined,
    );
    expect(localStorage.getItem("mde.customTranslationLanguages")).toContain(
      "Japanese",
    );

    await user.click(
      screen.getByRole("button", { name: /translate markdown/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /remove custom language Japanese/i }),
    );

    expect(
      localStorage.getItem("mde.customTranslationLanguages"),
    ).not.toContain("Japanese");

    await user.click(screen.getByRole("button", { name: /open settings/i }));
    await user.click(screen.getByRole("button", { name: /preference/i }));
    await user.type(
      screen.getByRole("textbox", { name: /custom app language/i }),
      "Spanish",
    );
    await user.click(
      screen.getByRole("button", { name: /generate language pack/i }),
    );

    await waitFor(() => {
      expect(aiApi.generateAppLanguagePack).toHaveBeenCalled();
    });
    expect(localStorage.getItem("mde.customAppLanguagePacks")).toContain(
      "Spanish",
    );
    expect(localStorage.getItem("mde.appLanguagePreference")).toBe(
      "custom:spanish",
    );
  });

  it("marks custom app languages and updates the selected pack through AI", async () => {
    const user = userEvent.setup();
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: "/fake/codex", id: "codex", name: "Codex" }],
      }),
      generateAppLanguagePack: vi.fn().mockResolvedValue({
        entries: [
          { key: "settings.title", text: "Ajustes actualizados" },
          {
            key: "settings.updateCustomLanguageAction",
            text: "Actualizar paquete seleccionado",
          },
          { key: "workspace.openWorkspace", text: "Abrir workspace" },
        ],
        language: "Spanish",
        tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
      }),
      summarizeMarkdown: vi.fn(),
      translateMarkdown: vi.fn(),
    } satisfies AiApi;

    localStorage.setItem(
      "mde.customAppLanguagePacks",
      JSON.stringify([
        {
          id: "custom:spanish",
          label: "Spanish",
          locale: "es",
          messages: {
            "settings.title": "Ajustes",
            "workspace.openWorkspace": "Abrir workspace",
          },
        },
      ]),
    );
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: /open settings/i }));
    await user.click(screen.getByRole("button", { name: /preference/i }));

    expect(
      screen.getByRole("option", { name: "Spanish (Custom)" }),
    ).toBeVisible();

    await user.selectOptions(
      screen.getByRole("combobox", { name: /language/i }),
      "custom:spanish",
    );

    expect(localStorage.getItem("mde.appLanguagePreference")).toBe(
      "custom:spanish",
    );

    await user.click(
      await screen.findByRole("button", {
        name: /update selected language pack/i,
      }),
    );

    await waitFor(() => {
      expect(aiApi.generateAppLanguagePack).toHaveBeenCalled();
    });

    const firstLanguagePackCall = aiApi.generateAppLanguagePack.mock
      .calls[0] as Parameters<NonNullable<AiApi["generateAppLanguagePack"]>>;

    expect(firstLanguagePackCall[0]).toBe("Spanish");
    expect(firstLanguagePackCall[1]).toEqual(
      expect.arrayContaining([
        { key: "settings.title", text: "Ajustes" },
        {
          key: "settings.updateCustomLanguageAction",
          text: "Update selected language pack",
        },
      ]),
    );
    expect(localStorage.getItem("mde.customAppLanguagePacks")).toContain(
      "Ajustes actualizados",
    );
  });

  it("opens current editor search from the action bar and keyboard shortcut", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: "/fake/codex", id: "codex", name: "Codex" }],
      }),
      summarizeMarkdown: vi.fn(),
      translateMarkdown: vi.fn(),
    } satisfies AiApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    const searchButton = await screen.findByRole("button", {
      name: /search current markdown/i,
    });
    const summaryButton = await screen.findByRole("button", {
      name: /summarize markdown/i,
    });

    expect(
      summaryButton.compareDocumentPosition(searchButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(searchButton);
    const editorSearchBox = screen.getByRole("searchbox", {
      name: /search current markdown/i,
    });

    expect(searchButton).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.editor.actionButton,
    );
    expect(editorSearchBox).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.search.editorSearchField,
    );
    expect(
      document.querySelector(
        `[data-component-id="${COMPONENT_IDS.search.editorSearchBar}"]`,
      ),
    ).toBeInTheDocument();
    expect(editorSearchBox).toHaveAttribute("type", "text");

    await user.type(editorSearchBox, "Original{Enter}");

    expect(screen.getByTestId("mock-editor-search-query")).toHaveTextContent(
      "Original",
    );
    expect(localStorage.getItem("mde.editorSearchHistory")).toContain(
      "Original",
    );

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("searchbox", { name: /search current markdown/i }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    await waitFor(() => {
      expect(
        screen.getByRole("searchbox", { name: /search current markdown/i }),
      ).toHaveFocus();
    });
    expect(
      await screen.findByRole("button", {
        name: /use editor search history item Original/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /pin editor search history item Original/i,
      }),
    );

    expect(
      await screen.findByTestId("mock-editor-pinned-search-queries"),
    ).toHaveTextContent("Original");

    await user.click(
      screen.getByRole("button", {
        name: /delete pinned editor search keyword Original/i,
      }),
    );

    expect(
      screen.queryByTestId("mock-editor-pinned-search-queries"),
    ).not.toBeInTheDocument();
  });

  it("opens a global workspace search result and keeps the query highlighted", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [
          { name: "README.md", path: "README.md", type: "file" },
          {
            children: [
              { name: "guide.md", path: "docs/guide.md", type: "file" },
            ],
            name: "docs",
            path: "docs",
            type: "directory",
          },
        ],
        type: "workspace",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockImplementation((filePath: string) =>
        Promise.resolve(
          filePath === "docs/guide.md"
            ? {
                contents: "# Guide\n\nAlpha details",
                path: "docs/guide.md",
              }
            : {
                contents: "# Original",
                path: "README.md",
              },
        ),
      ),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      searchWorkspaceMarkdown: vi.fn().mockResolvedValue({
        limited: false,
        query: "alpha",
        results: [
          {
            matches: [
              { columnNumber: 1, lineNumber: 3, preview: "Alpha details" },
            ],
            path: "docs/guide.md",
          },
        ],
      }),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    await screen.findByRole("button", { name: /search workspace contents/i });
    fireEvent.keyDown(window, { key: "f", metaKey: true, shiftKey: true });

    await waitFor(() => {
      expect(
        screen.getByRole("searchbox", { name: /search workspace contents/i }),
      ).toHaveFocus();
    });
    const workspaceSearchBox = screen.getByRole("searchbox", {
      name: /search workspace contents/i,
    });

    expect(workspaceSearchBox).toHaveAttribute("type", "text");

    await user.type(workspaceSearchBox, "alpha");
    await waitFor(() => {
      expect(editorApi.searchWorkspaceMarkdown).toHaveBeenCalledWith(
        "alpha",
        "/workspace",
      );
    });
    expect(
      await screen.findByText("Alpha", {
        selector: ".global-search-result-match",
      }),
    ).toBeVisible();

    await user.click(
      await screen.findByRole("button", {
        name: /open search result docs\/guide\.md line 3/i,
      }),
    );

    expect(editorApi.readMarkdownFile).toHaveBeenLastCalledWith(
      "docs/guide.md",
      "/workspace",
    );
    expect(
      await screen.findByTestId("mock-editor-search-query"),
    ).toHaveTextContent("alpha");
    await waitFor(() => {
      expect(document.title).toBe("guide.md - /workspace");
    });

    expect(localStorage.getItem("mde.globalSearchHistory")).toContain("alpha");

    fireEvent.keyDown(window, { key: "f", metaKey: true, shiftKey: true });
    await waitFor(() => {
      expect(
        screen.getByRole("searchbox", { name: /search workspace contents/i }),
      ).toHaveFocus();
    });
    expect(
      await screen.findByRole("listbox", { name: /workspace search history/i }),
    ).toHaveClass("global-search-history-tags");

    const historyTag = await screen.findByRole("button", {
      name: /use workspace search history item alpha/i,
    });

    await user.click(historyTag);

    expect(
      screen.getByRole("searchbox", { name: /search workspace contents/i }),
    ).toHaveValue("alpha");
    expect(
      screen.getByRole("searchbox", { name: /search workspace contents/i }),
    ).toHaveFocus();

    await waitFor(() => {
      expect(editorApi.searchWorkspaceMarkdown).toHaveBeenLastCalledWith(
        "alpha",
        "/workspace",
      );
    });
  });

  it("renders global workspace search history as filtered tags capped at sixteen", async () => {
    const user = userEvent.setup();
    const storedHistory = [
      "alpha",
      "alphabet",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      "eta",
      "theta",
      "iota",
      "kappa",
      "lambda",
      "mu",
      "nu",
      "xi",
      "omicron",
      "pi",
      "rho",
    ];

    localStorage.setItem("mde.globalSearchHistory", JSON.stringify(storedHistory));

    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      searchWorkspaceMarkdown: vi.fn().mockResolvedValue({
        limited: false,
        query: "alpha",
        results: [],
      }),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    await screen.findByRole("button", { name: /search workspace contents/i });
    fireEvent.keyDown(window, { key: "f", metaKey: true, shiftKey: true });

    const searchBox = await screen.findByRole("searchbox", {
      name: /search workspace contents/i,
    });
    const historyRegion = await screen.findByRole("listbox", {
      name: /workspace search history/i,
    });

    expect(historyRegion).toHaveClass("global-search-history-tags");
    expect(within(historyRegion).getByText(/up to 16/i)).toBeVisible();
    expect(within(historyRegion).getAllByRole("button")).toHaveLength(16);

    await user.type(searchBox, "alp");

    expect(within(historyRegion).getAllByRole("button")).toHaveLength(2);
    expect(
      within(historyRegion).getByRole("button", {
        name: "Use workspace search history item alpha",
      }),
    ).toBeVisible();
    expect(
      within(historyRegion).getByRole("button", {
        name: "Use workspace search history item alphabet",
      }),
    ).toBeVisible();

    await user.clear(searchBox);
    await user.type(searchBox, "zzz");

    expect(
      screen.queryByRole("listbox", { name: /workspace search history/i }),
    ).not.toBeInTheDocument();
  });

  it("persists the selected AI CLI and sends it with AI actions", async () => {
    const user = userEvent.setup();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [
          { commandPath: "/fake/codex", id: "codex", name: "Codex" },
          { commandPath: "/fake/claude", id: "claude", name: "Claude Code" },
        ],
      }),
      summarizeMarkdown: vi.fn().mockResolvedValue({
        cached: false,
        contents: "## Summary\n\n- Original summarized.",
        kind: "summary",
        path: ".mde/translations/README-summary.md",
        tool: {
          commandPath: "/fake/claude",
          id: "claude",
          name: "Claude Code",
        },
      }),
      translateMarkdown: vi.fn(),
    } satisfies AiApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    await screen.findByRole("button", { name: /summarize markdown/i });
    await user.click(screen.getByRole("button", { name: /open settings/i }));
    await user.click(screen.getByRole("button", { name: /^ai$/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /ai cli/i }),
      "claude",
    );
    await user.type(
      screen.getByRole("textbox", { name: /default model name/i }),
      "claude-sonnet-4-6",
    );
    await user.click(screen.getByRole("button", { name: /close settings/i }));
    await user.click(
      screen.getByRole("button", { name: /summarize markdown/i }),
    );

    expect(localStorage.getItem("mde.aiCliSettings")).toBe(
      JSON.stringify({
        modelNames: {
          claude: "claude-sonnet-4-6",
        },
        selectedToolId: "claude",
      }),
    );
    expect(aiApi.summarizeMarkdown).toHaveBeenCalledWith(
      "README.md",
      "# Original",
      "/workspace",
      undefined,
      {
        modelName: "claude-sonnet-4-6",
        toolId: "claude",
      },
    );
  });

  it("keeps AI button state scoped to the active Markdown file", async () => {
    const user = userEvent.setup();
    const translation = createDeferred<AiGenerationResult>();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [
          { name: "README.md", path: "README.md", type: "file" },
          { name: "notes.md", path: "notes.md", type: "file" },
        ],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn((filePath: string) =>
        Promise.resolve({
          contents: filePath === "notes.md" ? "# Notes" : "# Original",
          path: filePath,
        }),
      ),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: "/fake/codex", id: "codex", name: "Codex" }],
      }),
      summarizeMarkdown: vi.fn(),
      translateMarkdown: vi.fn().mockReturnValue(translation.promise),
    } satisfies AiApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    expect(await screen.findByText("# Original")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /translate markdown/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /English/i }));

    expect(
      screen.getByRole("button", { name: /summarize markdown/i }),
    ).toHaveAttribute("aria-busy", "false");
    expect(
      screen.getByRole("button", { name: /translate markdown/i }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /notes\.md Markdown file/i }),
    );

    expect(await screen.findByText("# Notes")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /summarize markdown/i }),
    ).toHaveAttribute("aria-busy", "false");
    expect(
      screen.getByRole("button", { name: /translate markdown/i }),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("ai-action-spinner")).not.toBeInTheDocument();

    await act(async () => {
      translation.resolve({
        cached: false,
        contents: "# English\n\nOriginal translated.",
        kind: "translation",
        language: "English",
        path: ".mde/translations/README.English.md",
        tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
      });
      await Promise.resolve();
    });

    expect(
      screen.queryByRole("region", { name: /ai result/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("# Notes")).toBeVisible();
  });

  it("keeps a cached AI result visible while the current Markdown file reloads", async () => {
    const user = userEvent.setup();
    const reloadedFile = createDeferred<{ contents: string; path: string }>();
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi
        .fn()
        .mockResolvedValueOnce({
          contents: "# Original",
          path: "README.md",
        })
        .mockReturnValueOnce(reloadedFile.promise),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: "/fake/codex", id: "codex", name: "Codex" }],
      }),
      summarizeMarkdown: vi.fn().mockResolvedValue({
        cached: true,
        contents: "## Summary\n\n- Cached summary.",
        kind: "summary",
        path: ".mde/translations/README-summary.md",
        tool: { commandPath: "/fake/codex", id: "codex", name: "Codex" },
      }),
      translateMarkdown: vi.fn(),
    } satisfies AiApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    Object.defineProperty(window, "aiApi", {
      configurable: true,
      value: aiApi,
    });

    render(<App />);

    await screen.findByText("# Original");
    await user.click(
      screen.getByRole("button", { name: /summarize markdown/i }),
    );

    const aiResult = await screen.findByRole("region", {
      name: /ai result/i,
    });

    expect(aiResult).toHaveTextContent("Cached summary");

    await user.click(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
    );

    await waitFor(() => {
      expect(editorApi.readMarkdownFile).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("region", { name: /ai result/i })).toHaveTextContent(
      "Cached summary",
    );

    await act(async () => {
      reloadedFile.resolve({
        contents: "# Original",
        path: "README.md",
      });
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("region", { name: /ai result/i }),
    ).toHaveTextContent("Cached summary");
  });

  it("reloads the current Markdown file when it changes on disk", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      markdownFileExists: vi.fn().mockResolvedValue(true),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi
        .fn()
        .mockResolvedValueOnce({
          contents: "# Original",
          path: "README.md",
        })
        .mockResolvedValueOnce({
          contents: "# Changed on disk",
          path: "README.md",
        }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    expect(await screen.findByText("# Original")).toBeVisible();

    await waitFor(
      () => {
        expect(screen.getByText("# Changed on disk")).toBeVisible();
      },
      { timeout: 8000 },
    );
    expect(editorApi.readMarkdownFile).toHaveBeenCalledTimes(2);
  });

  it("clears the current editor when the open Markdown file disappears on disk", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn().mockResolvedValue([]),
      markdownFileExists: vi.fn().mockResolvedValue(false),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    expect(await screen.findByText("# Original")).toBeVisible();

    await waitFor(
      () => {
        expect(screen.queryByText("# Original")).not.toBeInTheDocument();
      },
      { timeout: 8000 },
    );
    expect(screen.getByText(/select a folder to begin/i)).toBeVisible();
  });

  it("validates recent files when the recent files panel expands", async () => {
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: null,
          recentFilePaths: ["README.md", "missing.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );
    localStorage.setItem(
      "mde.explorerRecentFilesPanel",
      JSON.stringify({ height: 164, isCollapsed: true }),
    );

    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      markdownFileExists: vi
        .fn()
        .mockImplementation((filePath: string) =>
          Promise.resolve(filePath === "README.md"),
        ),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        name: "workspace",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    const recentFilesToggle = await screen.findByRole("button", {
      name: /recent files/i,
    });

    fireEvent.click(recentFilesToggle);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: /open recent file missing\.md/i,
        }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /open recent file README\.md/i }),
    ).toBeVisible();
    expect(editorApi.markdownFileExists).toHaveBeenCalledWith(
      "README.md",
      "/workspace",
    );
    expect(JSON.parse(localStorage.getItem("mde.workspaceFileHistory") ?? "[]"))
      .toEqual([
        {
          lastOpenedFilePath: null,
          recentFilePaths: ["README.md"],
          workspaceRoot: "/workspace",
        },
      ]);
  });

  it("validates recent files when the expanded recent files panel opens with a workspace", async () => {
    localStorage.setItem(
      "mde.workspaceFileHistory",
      JSON.stringify([
        {
          lastOpenedFilePath: null,
          recentFilePaths: ["README.md", "missing.md"],
          workspaceRoot: "/workspace",
        },
      ]),
    );

    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      markdownFileExists: vi
        .fn()
        .mockImplementation((filePath: string) =>
          Promise.resolve(filePath === "README.md"),
        ),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        name: "workspace",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "workspace",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn(),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    expect(
      await screen.findByRole("button", {
        name: /open recent file README\.md/i,
      }),
    ).toBeVisible();

    await waitFor(() => {
      expect(editorApi.markdownFileExists).toHaveBeenCalledWith(
        "README.md",
        "/workspace",
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: /open recent file missing\.md/i,
        }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /open recent file README\.md/i }),
    ).toBeVisible();
  });

  it("opens the theme settings panel and persists the selected theme", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: "cedar",
        lastLightThemeId: "porcelain",
        mode: "dark",
      }),
    );

    render(<App />);

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "cedar");
    await user.click(screen.getByRole("button", { name: /change theme/i }));

    expect(
      screen.getByRole("switch", { name: /follow system appearance/i }),
    ).not.toBeChecked();

    expect(screen.getByRole("dialog", { name: /settings/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^theme$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const colorwayPicker = screen.getByRole("radiogroup", {
      name: /theme colorways/i,
    });

    expect(
      within(colorwayPicker).queryByText(/^Dark$/i),
    ).not.toBeInTheDocument();
    expect(
      within(colorwayPicker).queryByText(/Light panel/i),
    ).not.toBeInTheDocument();
    expect(
      within(colorwayPicker).queryByText(/Dark panel/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /glacier/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /cedar/i })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /sage paper/i }));

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-theme",
      "sage-paper",
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-theme-family",
      "light",
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-panel-family",
      "light",
    );
    expect(localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe(
      JSON.stringify({
        lastDarkThemeId: "cedar",
        lastLightThemeId: "sage-paper",
        mode: "light",
      }),
    );
  });

  it("updates follow-system themes when the OS appearance changes", () => {
    const systemTheme = mockSystemThemePreference(false);

    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: "moss",
        lastLightThemeId: "porcelain",
        mode: "system",
      }),
    );

    render(<App />);

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "porcelain");

    act(() => {
      systemTheme.setMatches(true);
    });

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "moss");
    expect(localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe(
      JSON.stringify({
        lastDarkThemeId: "moss",
        lastLightThemeId: "porcelain",
        mode: "system",
      }),
    );
  });

  it("selects only the current system family while keeping follow-system enabled", async () => {
    const user = userEvent.setup();
    mockSystemThemePreference(false);
    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: "moss",
        lastLightThemeId: "porcelain",
        mode: "system",
      }),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: /change theme/i }));

    expect(screen.getByRole("dialog", { name: /settings/i })).toBeVisible();
    const colorwayPicker = screen.getByRole("radiogroup", {
      name: /theme colorways/i,
    });

    expect(
      within(colorwayPicker).queryByText(/^Dark$/i),
    ).not.toBeInTheDocument();
    expect(
      within(colorwayPicker).queryByText(/Light panel/i),
    ).not.toBeInTheDocument();
    expect(
      within(colorwayPicker).queryByText(/Dark panel/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /blue hour/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /glacier/i })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /binder/i }));

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "binder");
    expect(
      screen.getByRole("switch", { name: /follow system appearance/i }),
    ).toBeChecked();
    expect(localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe(
      JSON.stringify({
        lastDarkThemeId: "moss",
        lastLightThemeId: "binder",
        mode: "system",
      }),
    );
  });

  it("passes the resolved color scheme to the Markdown editor", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });
    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: "blue-hour",
        lastLightThemeId: "manuscript",
        mode: "dark",
      }),
    );

    render(<App />);

    expect(
      await screen.findByTestId("mock-editor-color-scheme"),
    ).toHaveTextContent("dark");
  });

  it("auto-saves the latest dirty editor contents after five idle seconds", async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    const changeButton = await screen.findByRole("button", {
      name: /change mock markdown/i,
    });

    vi.useFakeTimers();
    fireEvent.click(changeButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    fireEvent.click(changeButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });

    expect(editorApi.writeMarkdownFile).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(editorApi.writeMarkdownFile).toHaveBeenCalledWith(
      "README.md",
      "# Changed 2",
      "/workspace",
    );
  });

  it("blocks empty autosave when a non-empty document would be cleared", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Original",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    const clearButton = await screen.findByRole("button", {
      name: /clear mock markdown/i,
    });

    vi.useFakeTimers();
    fireEvent.click(clearButton);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      "Autosave detected this operation would clear this document. Continue saving it as an empty document?",
    );
    expect(editorApi.writeMarkdownFile).not.toHaveBeenCalled();
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  it("opens document history and previews a selected version in the editor", async () => {
    const historyVersion = {
      blobHash: "hash",
      byteLength: 10,
      createdAt: "2026-05-02T01:00:00.000Z",
      documentId: "doc_1",
      event: "manual-save" as const,
      id: "version_1",
      path: "README.md",
    };
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      listDocumentHistory: vi.fn().mockResolvedValue([historyVersion]),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readDocumentHistoryVersion: vi.fn().mockResolvedValue({
        contents: "# Previous",
        version: historyVersion,
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Current",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      restoreDeletedDocumentHistoryVersion: vi.fn(),
      restoreDocumentHistoryVersion: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /^version history$/i }),
    );

    expect(editorApi.listDocumentHistory).toHaveBeenCalledWith(
      "README.md",
      "/workspace",
    );
    expect(screen.getByRole("complementary", { name: /version history/i }));
    expect(screen.getByText(/document history/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^all$/i })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /preview manual save before/i }),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: /preview manual save before/i }),
    );

    expect(editorApi.readDocumentHistoryVersion).toHaveBeenCalledWith(
      "version_1",
      "/workspace",
    );
    expect(await screen.findByTestId("mock-editor-readonly")).toBeVisible();
    expect(screen.getByText("# Previous")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /^version history$/i }),
    );

    expect(
      screen.queryByRole("complementary", { name: /version history/i }),
    ).not.toBeInTheDocument();
  });

  it("toggles the recovery history panel from a deleted document preview", async () => {
    const deletedDocument = {
      deletedAt: "2026-05-02T01:00:00.000Z",
      documentId: "doc_deleted",
      latestVersionId: "version_deleted",
      path: "deleted.md",
      reason: "deleted-in-mde" as const,
      versionCount: 1,
    };
    const historyVersion = {
      blobHash: "hash",
      byteLength: 14,
      createdAt: "2026-05-02T01:00:00.000Z",
      documentId: "doc_deleted",
      event: "delete" as const,
      id: "version_deleted",
      path: "deleted.md",
    };
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue("/workspace/README.md"),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDeletedDocumentHistory: vi.fn().mockResolvedValue([deletedDocument]),
      listDirectory: vi.fn(),
      listDocumentHistory: vi.fn().mockResolvedValue([historyVersion]),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: "/workspace/README.md",
        name: "README.md",
        openedFilePath: "README.md",
        rootPath: "/workspace",
        tree: [{ name: "README.md", path: "README.md", type: "file" }],
        type: "file",
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readDocumentHistoryVersion: vi.fn().mockResolvedValue({
        contents: "# Deleted",
        version: historyVersion,
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: "# Current",
        path: "README.md",
      }),
      renameEntry: vi.fn(),
      restoreDeletedDocumentHistoryVersion: vi.fn(),
      restoreDocumentHistoryVersion: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn(),
    } satisfies EditorApi;

    Object.defineProperty(window, "editorApi", {
      configurable: true,
      value: editorApi,
    });

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", {
        name: /recover deleted documents/i,
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: /preview deleted document deleted\.md/i,
      }),
    );

    expect(editorApi.listDocumentHistory).toHaveBeenCalledWith(
      "deleted.md",
      "/workspace",
    );
    expect(await screen.findByTestId("mock-editor-readonly")).toBeVisible();
    expect(
      screen.getByRole("complementary", { name: /version history/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^deleted documents/i }),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: /^version history$/i }),
    );

    expect(
      screen.queryByRole("complementary", { name: /version history/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^deleted documents/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /^version history$/i }),
    );

    expect(editorApi.listDeletedDocumentHistory).toHaveBeenCalledTimes(2);
    expect(editorApi.listDocumentHistory).toHaveBeenLastCalledWith(
      "deleted.md",
      "/workspace",
    );
    expect(
      await screen.findByRole("complementary", { name: /version history/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^deleted documents/i }),
    ).toBeVisible();
  });

  it("resizes the explorer sidebar from the drag separator", () => {
    render(<App />);

    const shell = screen.getByRole("main");
    const resizeHandle = screen.getByRole("separator", {
      name: /resize explorer sidebar/i,
    });

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "288");
    expect(shell.style.getPropertyValue("--explorer-width")).toBe("288px");

    fireEvent.pointerDown(resizeHandle, { clientX: 288, pointerId: 1 });
    const pointerMove = new Event("pointermove");

    Object.defineProperty(pointerMove, "clientX", { value: 360 });
    window.dispatchEvent(pointerMove);
    fireEvent.pointerUp(window);

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "360");
    expect(shell.style.getPropertyValue("--explorer-width")).toBe("360px");
  });

  it("toggles the explorer sidebar between collapsed and expanded states", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole("button", { name: /collapse explorer sidebar/i }),
    );

    expect(screen.getByRole("main")).toHaveClass("is-explorer-collapsed");
    expect(
      screen.queryByRole("button", { name: /^open workspace$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("separator", { name: /resize explorer sidebar/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /expand explorer sidebar/i }),
    );

    expect(screen.getByRole("main")).not.toHaveClass("is-explorer-collapsed");
    expect(
      screen.getByRole("button", { name: /^open workspace$/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("separator", { name: /resize explorer sidebar/i }),
    ).toBeVisible();
  });
});
