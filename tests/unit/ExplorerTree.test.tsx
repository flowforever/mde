import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerTree } from "../../apps/desktop/src/renderer/src/explorer/ExplorerTree";
import { ExplorerPane } from "../../apps/desktop/src/renderer/src/explorer/ExplorerPane";
import { COMPONENT_IDS } from "../../apps/desktop/src/renderer/src/componentIds";
import type { AppState } from "../../apps/desktop/src/renderer/src/app/appTypes";
import type { TreeNode } from "@mde/editor-host/file-tree";
import type { RecentWorkspace } from "../../apps/desktop/src/renderer/src/workspaces/recentWorkspaces";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../apps/desktop/src/renderer/src/i18n/appLanguage";

const EXPLORER_INTERACTION_TEST_TIMEOUT = 30_000;
const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

describe("ExplorerTree", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const tree: readonly TreeNode[] = Object.freeze([
    {
      name: "docs",
      path: "docs",
      type: "directory",
      children: Object.freeze<TreeNode[]>([
        {
          name: "nested",
          path: "docs/nested",
          type: "directory",
          children: Object.freeze<TreeNode[]>([
            {
              name: "deep.md",
              path: "docs/nested/deep.md",
              type: "file",
            },
          ]),
        },
        {
          name: "intro.md",
          path: "docs/intro.md",
          type: "file",
        },
      ]),
    },
    {
      name: "README.md",
      path: "README.md",
      type: "file",
    },
  ]);
  const treeWithHiddenEntries: readonly TreeNode[] = Object.freeze([
    {
      name: ".vscode",
      path: ".vscode",
      type: "directory",
      children: Object.freeze<TreeNode[]>([
        {
          name: "settings.md",
          path: ".vscode/settings.md",
          type: "file",
        },
      ]),
    },
    {
      name: "docs",
      path: "docs",
      type: "directory",
      children: Object.freeze<TreeNode[]>([]),
    },
    {
      name: ".draft.md",
      path: ".draft.md",
      type: "file",
    },
    {
      name: "README.md",
      path: "README.md",
      type: "file",
    },
  ]);

  it("renders nested folders and files after expansion", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        text={text}
        selectedFilePath={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /expand docs/i }));
    await user.click(screen.getByRole("button", { name: /expand nested/i }));

    expect(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /intro\.md Markdown file/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /deep\.md Markdown file/i }),
    ).toBeInTheDocument();
  });

  it("marks tree, disclosure, and rows with internal component ids", () => {
    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        text={text}
        selectedFilePath={null}
      />,
    );

    expect(screen.getByRole("list")).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.explorer.tree,
    );
    expect(screen.getByRole("button", { name: /expand docs/i })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.explorer.directoryDisclosureButton,
    );
    expect(screen.getByRole("button", { name: /docs folder/i })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.explorer.treeRow,
    );
  });

  it("toggles a directory from the visible row button with expanded state", async () => {
    const user = userEvent.setup();
    const onSelectEntry = vi.fn();

    const { rerender } = render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={onSelectEntry}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        text={text}
        selectedFilePath={null}
      />,
    );

    const docsRow = screen.getByRole("button", { name: /docs folder/i });

    expect(docsRow).toHaveAttribute("aria-expanded", "false");

    await user.click(docsRow);

    expect(onSelectEntry).toHaveBeenLastCalledWith("docs");
    expect(docsRow).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /intro\.md Markdown file/i }),
    ).toBeInTheDocument();

    rerender(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={onSelectEntry}
        onSelectFile={vi.fn()}
        selectedEntryPath="docs"
        text={text}
        selectedFilePath={null}
      />,
    );
    await user.click(docsRow);

    expect(onSelectEntry).toHaveBeenLastCalledWith(null);
    expect(docsRow).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /intro\.md Markdown file/i }),
    ).not.toBeInTheDocument();
  });

  it("collapses an expanded directory without selecting it when it was not selected", async () => {
    const user = userEvent.setup();
    const onSelectEntry = vi.fn();
    const onDirectoryExpandedChange = vi.fn();

    render(
      <ExplorerTree
        expandedDirectoryPaths={new Set(["docs"])}
        nodes={tree}
        onDirectoryExpandedChange={onDirectoryExpandedChange}
        onSelectEntry={onSelectEntry}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        text={text}
        selectedFilePath={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /docs folder/i }));

    expect(onSelectEntry).not.toHaveBeenCalled();
    expect(onDirectoryExpandedChange).toHaveBeenCalledWith("docs", false);
  });

  it("calls onSelectFile when a Markdown file is selected", async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();

    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={onSelectFile}
        selectedEntryPath={null}
        text={text}
        selectedFilePath={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
    );

    expect(onSelectFile).toHaveBeenCalledWith("README.md");
  });

  it("resets expanded folders when the workspace root changes", async () => {
    const user = userEvent.setup();
    const createState = (rootPath: string): AppState => ({
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: "workspace",
        rootPath,
        tree,
      },
    });

    const { rerender } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={createState("/workspace-one")}
      />,
    );

    await user.click(screen.getByRole("button", { name: /docs folder/i }));
    expect(
      screen.getByRole("button", { name: /intro\.md Markdown file/i }),
    ).toBeInTheDocument();

    rerender(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={createState("/workspace-two")}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /intro\.md Markdown file/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /docs folder/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes accessible names for workspace and selected-entry controls", () => {
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    const newMarkdownButton = screen.getByRole("button", {
      name: /new markdown file/i,
    });
    const newFolderButton = screen.getByRole("button", { name: /new folder/i });
    const searchButton = screen.getByRole("button", {
      name: /search workspace contents/i,
    });
    const showHiddenButton = screen.getByRole("button", {
      name: /show hidden entries/i,
    });
    const refreshButton = screen.getByRole("button", {
      name: /refresh explorer/i,
    });
    const toolbar = screen.getByLabelText(/workspace actions/i);
    const workspaceManagerButton = screen.getByRole("button", {
      name: /manage workspaces/i,
    });
    const toolbarButtons = Array.from(
      toolbar.querySelectorAll("button"),
    ) as HTMLElement[];

    expect(workspaceManagerButton).toHaveTextContent("workspace");
    expect(workspaceManagerButton).toHaveTextContent("/workspace");
    expect(
      container.querySelector(".explorer-workspace-name"),
    ).not.toBeInTheDocument();
    for (const button of [
      searchButton,
      newMarkdownButton,
      newFolderButton,
      showHiddenButton,
      refreshButton,
    ]) {
      expect(toolbar).toContainElement(button);
      expect(button.textContent?.trim()).toBe("");
      expect(
        button.querySelector('svg[aria-hidden="true"]'),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: /rename selected/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete selected/i }),
    ).not.toBeInTheDocument();
    expect(toolbarButtons).toHaveLength(6);
    expect(toolbarButtons.indexOf(searchButton)).toBe(0);
    expect(toolbarButtons.indexOf(refreshButton)).toBe(
      toolbarButtons.indexOf(showHiddenButton) + 1,
    );
  });

  it("toggles deleted documents independently from recent files", async () => {
    const user = userEvent.setup();
    const onSetDeletedDocumentHistoryVisible = vi.fn();
    const onSelectDeletedDocumentHistoryEntry = vi.fn();
    const deletedDocument = {
      deletedAt: "2026-05-02T01:00:00.000Z",
      documentId: "doc_1",
      latestVersionId: "version_1",
      path: "drafts/old.md",
      reason: "deleted-in-mde" as const,
      versionCount: 2,
    };
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDeletedDocumentHistoryVisible: false,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
      deletedDocumentHistory: [deletedDocument],
      historyPreview: null,
    };

    const { rerender } = render(
      <ExplorerPane
        deletedDocumentHistory={[deletedDocument]}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectDeletedDocumentHistoryEntry={
          onSelectDeletedDocumentHistoryEntry
        }
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        onSetDeletedDocumentHistoryVisible={
          onSetDeletedDocumentHistoryVisible
        }
        text={text}
        state={state}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /recover deleted documents/i }),
    );

    expect(onSetDeletedDocumentHistoryVisible).toHaveBeenCalledWith(true);
    rerender(
      <ExplorerPane
        deletedDocumentHistory={[deletedDocument]}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectDeletedDocumentHistoryEntry={
          onSelectDeletedDocumentHistoryEntry
        }
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        onSetDeletedDocumentHistoryVisible={
          onSetDeletedDocumentHistoryVisible
        }
        text={text}
        state={{ ...state, isDeletedDocumentHistoryVisible: true }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^deleted documents/i }),
    ).toBeVisible();
    expect(
      screen
        .getByRole("button", { name: /drafts\/old\.md/i })
        .closest(".explorer-recent-files-section"),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: /recent files/i }));

    expect(
      screen.getByRole("button", { name: /^deleted documents/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /drafts\/old\.md/i }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: /drafts\/old\.md/i }));

    expect(onSelectDeletedDocumentHistoryEntry).toHaveBeenCalledWith(
      deletedDocument,
    );

    await user.click(
      screen.getByRole("button", { name: /recover deleted documents/i }),
    );

    expect(onSetDeletedDocumentHistoryVisible).toHaveBeenLastCalledWith(false);
    rerender(
      <ExplorerPane
        deletedDocumentHistory={[deletedDocument]}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectDeletedDocumentHistoryEntry={
          onSelectDeletedDocumentHistoryEntry
        }
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        onSetDeletedDocumentHistoryVisible={
          onSetDeletedDocumentHistoryVisible
        }
        text={text}
        state={state}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^deleted documents/i }),
    ).not.toBeInTheDocument();
  });

  it("labels explorer rows with entry type and active state", () => {
    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        selectedEntryPath="README.md"
        selectedFilePath="README.md"
        text={text}
      />,
    );

    expect(
      screen.getByRole("button", { name: /docs folder/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps empty explorer state visible by text", () => {
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: null,
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^open workspace$/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/open a folder to browse markdown files/i),
    ).toBeVisible();
  });

  it("searches recent workspace resources and removes them from the manager popup", async () => {
    const user = userEvent.setup();
    const onForgetWorkspace = vi.fn();
    const recentWorkspaces: readonly RecentWorkspace[] = [
      {
        name: "Docs",
        rootPath: "/workspaces/docs",
        type: "workspace",
      },
      {
        filePath: "/notes/API.md",
        name: "API.md",
        openedFilePath: "API.md",
        rootPath: "/notes",
        type: "file",
      },
    ];
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: null,
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onForgetWorkspace={onForgetWorkspace}
        onOpenFile={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        recentWorkspaces={recentWorkspaces}
        text={text}
        state={state}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^open workspace$/i }));

    expect(
      screen.getByRole("dialog", { name: /workspace manager/i }),
    ).toHaveClass("workspace-dialog");
    expect(
      screen.getByRole("button", { name: /open markdown file/i }),
    ).toBeVisible();

    await user.type(
      screen.getByRole("searchbox", { name: /search workspaces and files/i }),
      "api",
    );

    expect(
      screen.getByRole("button", { name: /switch to file API\.md/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /switch to workspace Docs/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove recent file API\.md/i }),
    );

    expect(onForgetWorkspace).toHaveBeenCalledWith(recentWorkspaces[1]);
  });

  it("opens remembered resources in a new window without switching current workspace", async () => {
    const user = userEvent.setup();
    const onOpenWorkspaceInNewWindow = vi.fn();
    const onSwitchWorkspace = vi.fn();
    const recentWorkspaces: readonly RecentWorkspace[] = [
      {
        name: "Docs",
        rootPath: "/workspaces/docs",
        type: "workspace",
      },
      {
        filePath: "/notes/API.md",
        name: "API.md",
        openedFilePath: "API.md",
        rootPath: "/notes",
        type: "file",
      },
    ];
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: null,
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenWorkspaceInNewWindow={onOpenWorkspaceInNewWindow}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        onSwitchWorkspace={onSwitchWorkspace}
        recentWorkspaces={recentWorkspaces}
        text={text}
        state={state}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^open workspace$/i }));
    await user.click(
      screen.getByRole("button", {
        name: /open workspace Docs in new window/i,
      }),
    );

    expect(onOpenWorkspaceInNewWindow).toHaveBeenCalledWith(
      recentWorkspaces[0],
    );
    expect(onSwitchWorkspace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /workspace manager/i }),
    ).toBeVisible();
  });

  it(
    "submits create file and create folder actions from the toolbar",
    async () => {
      const user = userEvent.setup();
      const onCreateFile = vi.fn();
      const onCreateFolder = vi.fn();
      const state: AppState = {
        draftMarkdown: null,
        errorMessage: null,
        fileErrorMessage: null,
        isDirty: false,
        isLoadingFile: false,
        isOpeningWorkspace: false,
        isSavingFile: false,
        loadedFile: null,
        loadingWorkspaceRoot: null,
        selectedEntryPath: null,
        selectedFilePath: null,
        workspace: {
          name: "workspace",
          rootPath: "/workspace",
          tree,
        },
      };

      render(
        <ExplorerPane
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteEntry={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onRenameEntry={vi.fn()}
          onSelectEntry={vi.fn()}
          onSelectFile={vi.fn()}
          text={text}
          state={state}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /new markdown file/i }),
      );
      await user.clear(screen.getByLabelText(/new markdown file name/i));
      await user.type(
        screen.getByLabelText(/new markdown file name/i),
        "daily.md",
      );
      await user.keyboard("{Enter}");

      expect(onCreateFile).toHaveBeenCalledWith("daily.md");

      await user.click(screen.getByRole("button", { name: /new folder/i }));
      await user.clear(screen.getByLabelText(/new folder name/i));
      await user.type(screen.getByLabelText(/new folder name/i), "daily");
      await user.keyboard("{Enter}");

      expect(onCreateFolder).toHaveBeenCalledWith("daily");
    },
    EXPLORER_INTERACTION_TEST_TIMEOUT,
  );

  it(
    "creates entries inside the selected directory and uses the root for file selections",
    async () => {
      const user = userEvent.setup();
      const onCreateFile = vi.fn();
      const onCreateFolder = vi.fn();
      const createState = (selectedEntryPath: string | null): AppState => ({
        draftMarkdown: null,
        errorMessage: null,
        fileErrorMessage: null,
        isDirty: false,
        isLoadingFile: false,
        isOpeningWorkspace: false,
        isSavingFile: false,
        loadedFile: null,
        loadingWorkspaceRoot: null,
        selectedEntryPath,
        selectedFilePath:
          selectedEntryPath === "README.md" ? "README.md" : null,
        workspace: {
          name: "workspace",
          rootPath: "/workspace",
          tree,
        },
      });
      const renderPane = (state: AppState) => (
        <ExplorerPane
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteEntry={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onRenameEntry={vi.fn()}
          onSelectEntry={vi.fn()}
          onSelectFile={vi.fn()}
          text={text}
          state={state}
        />
      );

      const { rerender } = render(renderPane(createState("docs")));

      await user.click(
        screen.getByRole("button", { name: /new markdown file/i }),
      );
      const docsRow = screen.getByRole("button", { name: /docs folder/i });
      const docsItem = docsRow.closest("li") as HTMLElement;
      const nestedFileInput = await within(docsItem).findByLabelText(
        /new markdown file name/i,
      );

      expect(nestedFileInput).toHaveValue("Untitled.md");
      await user.clear(nestedFileInput);
      await user.type(nestedFileInput, "daily.md");
      await user.keyboard("{Enter}");

      expect(onCreateFile).toHaveBeenLastCalledWith("docs/daily.md");

      await user.click(screen.getByRole("button", { name: /new folder/i }));
      const nestedFolderInput =
        await within(docsItem).findByLabelText(/new folder name/i);

      expect(nestedFolderInput).toHaveValue("notes");
      await user.clear(nestedFolderInput);
      await user.type(nestedFolderInput, "assets");
      await user.keyboard("{Enter}");

      expect(onCreateFolder).toHaveBeenLastCalledWith("docs/assets");

      rerender(renderPane(createState("README.md")));

      await user.click(
        screen.getByRole("button", { name: /new markdown file/i }),
      );
      expect(screen.getByLabelText(/new markdown file name/i)).toHaveValue(
        "Untitled.md",
      );
      await user.clear(screen.getByLabelText(/new markdown file name/i));
      await user.type(
        screen.getByLabelText(/new markdown file name/i),
        "root.md",
      );
      await user.keyboard("{Enter}");

      expect(onCreateFile).toHaveBeenLastCalledWith("root.md");
    },
    EXPLORER_INTERACTION_TEST_TIMEOUT,
  );

  it("submits rename and confirmed delete from the selected entry context menu", async () => {
    const user = userEvent.setup();
    const onRenameEntry = vi.fn();
    const onDeleteEntry = vi.fn();
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={onDeleteEntry}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={onRenameEntry}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /rename selected README\.md/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete selected README\.md/i }),
    ).not.toBeInTheDocument();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 72, clientY: 96 },
    );
    await user.click(screen.getByRole("menuitem", { name: /^rename$/i }));
    await user.clear(screen.getByLabelText(/rename README\.md/i));
    await user.type(screen.getByLabelText(/rename README\.md/i), "renamed.md");
    await user.keyboard("{Enter}");

    expect(onRenameEntry).toHaveBeenCalledWith("renamed.md");

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 72, clientY: 96 },
    );
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    expect(screen.getByText(/delete README\.md/i)).toBeVisible();
    const deleteConfirmation = screen
      .getByText(/delete README\.md/i)
      .closest(".explorer-delete-confirmation")!;

    expect(deleteConfirmation).toHaveStyle({
      "--delete-confirmation-x": "72px",
      "--delete-confirmation-y": "96px",
    });
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(onDeleteEntry).toHaveBeenCalledTimes(1);
  });

  it("copies and pastes entries from the row context menu", async () => {
    const user = userEvent.setup();
    const onCopyEntry = vi.fn();
    const onCopyEntryPath = vi.fn();
    const onPasteEntry = vi.fn();
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCopyEntry={onCopyEntry}
        onCopyEntryPath={onCopyEntryPath}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onPasteEntry={onPasteEntry}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 72, clientY: 96 },
    );
    await user.click(screen.getByRole("menuitem", { name: /^copy$/i }));
    expect(onCopyEntry).toHaveBeenCalledWith("README.md");

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 72, clientY: 96 },
    );
    await user.click(screen.getByRole("menuitem", { name: /^paste$/i }));
    expect(onPasteEntry).toHaveBeenCalledWith("");

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 72, clientY: 96 },
    );
    await user.click(
      screen.getByRole("menuitem", { name: /copy relative path/i }),
    );
    expect(onCopyEntryPath).toHaveBeenCalledWith("README.md", "relative");

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 72, clientY: 96 },
    );
    await user.click(
      screen.getByRole("menuitem", { name: /copy absolute path/i }),
    );
    expect(onCopyEntryPath).toHaveBeenCalledWith("README.md", "absolute");

    fireEvent.keyDown(window, { key: "c", metaKey: true });
    expect(onCopyEntry).toHaveBeenLastCalledWith("README.md");

    fireEvent.keyDown(window, { key: "v", metaKey: true });
    expect(onPasteEntry).toHaveBeenLastCalledWith("");
  });

  it("keeps delete confirmation inside the viewport and closes it on scroll", async () => {
    const user = userEvent.setup();
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 240,
    });

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 318, clientY: 238 },
    );
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));

    const deleteConfirmation = screen
      .getByText(/delete README\.md/i)
      .closest(".explorer-delete-confirmation")!;

    expect(deleteConfirmation).toHaveStyle({
      "--delete-confirmation-x": "88px",
      "--delete-confirmation-y": "120px",
    });

    fireEvent.scroll(window);

    expect(screen.queryByText(/delete README\.md/i)).not.toBeInTheDocument();
  });

  it(
    "opens row context menus with icons and directory create actions",
    async () => {
      const user = userEvent.setup();
      const onCreateFile = vi.fn();
      const onCreateFolder = vi.fn();
      const onRenameEntry = vi.fn();
      const onDeleteEntry = vi.fn();
      const onSelectEntry = vi.fn();
      const state: AppState = {
        draftMarkdown: "# Fixture Workspace",
        errorMessage: null,
        fileErrorMessage: null,
        isDirty: false,
        isLoadingFile: false,
        isOpeningWorkspace: false,
        isSavingFile: false,
        loadedFile: {
          contents: "# Fixture Workspace",
          path: "README.md",
        },
        loadingWorkspaceRoot: null,
        selectedEntryPath: "README.md",
        selectedFilePath: "README.md",
        workspace: {
          name: "workspace",
          rootPath: "/workspace",
          tree,
        },
      };

      render(
        <ExplorerPane
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteEntry={onDeleteEntry}
          onOpenWorkspace={vi.fn()}
          onRenameEntry={onRenameEntry}
          onSelectEntry={onSelectEntry}
          onSelectFile={vi.fn()}
          text={text}
          state={state}
        />,
      );

      fireEvent.contextMenu(
        screen.getByRole("button", { name: /README\.md Markdown file/i }),
        { clientX: 36, clientY: 48 },
      );

      expect(onSelectEntry).toHaveBeenCalledWith("README.md");
      expect(
        screen.getByRole("menu", { name: /README\.md actions/i }),
      ).toBeVisible();
      expect(screen.getByRole("menuitem", { name: /^rename$/i })).toBeVisible();
      expect(screen.getByRole("menuitem", { name: /^hide$/i })).toBeVisible();
      expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeVisible();
      expect(
        screen.queryByRole("menuitem", { name: /new markdown file/i }),
      ).not.toBeInTheDocument();
      for (const menuItem of screen.getAllByRole("menuitem")) {
        expect(
          menuItem.querySelector('svg[aria-hidden="true"]'),
        ).toBeInTheDocument();
      }

      await user.click(screen.getByRole("menuitem", { name: /^hide$/i }));

      expect(
        screen.queryByRole("button", { name: /README\.md Markdown file/i }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: /show hidden entries/i }),
      );

      expect(
        screen.getByRole("button", { name: /README\.md Markdown file/i }),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: /hide hidden entries/i }),
      );

      expect(
        screen.queryByRole("button", { name: /README\.md Markdown file/i }),
      ).not.toBeInTheDocument();

      fireEvent.contextMenu(
        screen.getByRole("button", { name: /docs folder/i }),
        {
          clientX: 36,
          clientY: 48,
        },
      );
      expect(
        screen.getByRole("menuitem", { name: /new markdown file/i }),
      ).toBeVisible();
      expect(
        screen.getByRole("menuitem", { name: /new folder/i }),
      ).toBeVisible();
      for (const menuItem of screen.getAllByRole("menuitem")) {
        expect(
          menuItem.querySelector('svg[aria-hidden="true"]'),
        ).toBeInTheDocument();
      }
      await user.click(
        screen.getByRole("menuitem", { name: /new markdown file/i }),
      );
      const docsItem = screen
        .getByRole("button", { name: /docs folder/i })
        .closest("li") as HTMLElement;

      await user.clear(
        within(docsItem).getByLabelText(/new markdown file name/i),
      );
      await user.type(
        within(docsItem).getByLabelText(/new markdown file name/i),
        "context-note.md",
      );
      await user.keyboard("{Enter}");

      expect(onCreateFile).toHaveBeenCalledWith("docs/context-note.md");

      fireEvent.contextMenu(
        screen.getByRole("button", { name: /docs folder/i }),
        {
          clientX: 36,
          clientY: 48,
        },
      );
      await user.click(screen.getByRole("menuitem", { name: /new folder/i }));
      await user.clear(within(docsItem).getByLabelText(/new folder name/i));
      await user.type(
        within(docsItem).getByLabelText(/new folder name/i),
        "context-assets",
      );
      await user.keyboard("{Enter}");

      expect(onCreateFolder).toHaveBeenCalledWith("docs/context-assets");

      fireEvent.contextMenu(
        screen.getByRole("button", { name: /docs folder/i }),
        {
          clientX: 36,
          clientY: 48,
        },
      );
      await user.click(screen.getByRole("menuitem", { name: /^rename$/i }));
      await user.clear(screen.getByLabelText(/rename docs/i));
      await user.type(screen.getByLabelText(/rename docs/i), "guides");
      await user.keyboard("{Enter}");

      expect(onRenameEntry).toHaveBeenCalledWith("guides");

      fireEvent.contextMenu(
        screen.getByRole("button", { name: /docs folder/i }),
        {
          clientX: 36,
          clientY: 48,
        },
      );
      await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
      await user.click(screen.getByRole("button", { name: /confirm delete/i }));

      expect(onDeleteEntry).toHaveBeenCalledTimes(1);
    },
    EXPLORER_INTERACTION_TEST_TIMEOUT,
  );

  it("closes the row context menu when focus moves outside or Escape is pressed", async () => {
    const user = userEvent.setup();
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 36, clientY: 48 },
    );

    expect(
      screen.getByRole("menu", { name: /README\.md actions/i }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: /docs folder/i }));

    expect(
      screen.queryByRole("menu", { name: /README\.md actions/i }),
    ).not.toBeInTheDocument();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
      { clientX: 36, clientY: 48 },
    );

    expect(
      screen.getByRole("menu", { name: /README\.md actions/i }),
    ).toBeVisible();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("menu", { name: /README\.md actions/i }),
    ).not.toBeInTheDocument();
  });

  it("shows create inputs under the selected folder and cancels inline editing with Escape", async () => {
    const user = userEvent.setup();
    const onCreateFile = vi.fn();
    const onCreateFolder = vi.fn();
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: "docs",
      selectedFilePath: null,
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    const docsRow = screen.getByRole("button", { name: /docs folder/i });

    await user.click(
      screen.getByRole("button", { name: /new markdown file/i }),
    );

    const docsItem = docsRow.closest("li");
    const fileInput = within(docsItem as HTMLElement).getByLabelText(
      /new markdown file name/i,
    );

    expect(fileInput).toHaveValue("Untitled.md");

    await user.clear(fileInput);
    await user.type(fileInput, "daily.md");
    await user.keyboard("{Enter}");

    expect(onCreateFile).toHaveBeenCalledWith("docs/daily.md");

    await user.click(screen.getByRole("button", { name: /new folder/i }));

    const folderInput = within(docsItem as HTMLElement).getByLabelText(
      /new folder name/i,
    );

    expect(folderInput).toHaveValue("notes");

    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText(/new folder name/i)).not.toBeInTheDocument();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it("refreshes a directory when it is expanded", async () => {
    const user = userEvent.setup();
    const onRefreshTree = vi.fn().mockResolvedValue(undefined);
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: "workspace",
        rootPath: "/workspace-refresh-expand",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshTree={onRefreshTree}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    await user.click(screen.getByRole("button", { name: /expand docs/i }));

    await waitFor(() => {
      expect(onRefreshTree).toHaveBeenCalledWith(["docs"]);
    });
  });

  it("refreshes expanded directories and locates the current open file", async () => {
    const user = userEvent.setup();
    const onRefreshTree = vi.fn().mockResolvedValue(undefined);
    const scrollIntoView = vi.fn();
    const state: AppState = {
      draftMarkdown: "# Deep",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Deep",
        path: "docs/nested/deep.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "docs/nested/deep.md",
      selectedFilePath: "docs/nested/deep.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace-refresh-locate",
        tree,
      },
    };

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshTree={onRefreshTree}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    expect(screen.getByRole("button", { name: /collapse docs/i }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: /collapse nested/i }))
      .toBeVisible();
    onRefreshTree.mockClear();

    await user.click(screen.getByRole("button", { name: /refresh explorer/i }));

    await waitFor(() => {
      expect(onRefreshTree).toHaveBeenCalledWith(["docs", "docs/nested"]);
    });
    expect(
      screen.getByRole("button", { name: /deep\.md Markdown file/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("renames entries inline at their original tree row and cancels with Escape", async () => {
    const user = userEvent.setup();
    const onRenameEntry = vi.fn();
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={onRenameEntry}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    const readmeRow = screen.getByRole("button", {
      name: /README\.md Markdown file/i,
    });
    const readmeItem = readmeRow.closest("li");

    fireEvent.contextMenu(readmeRow, { clientX: 72, clientY: 96 });
    await user.click(screen.getByRole("menuitem", { name: /^rename$/i }));

    const renameInput = within(readmeItem as HTMLElement).getByLabelText(
      /rename README\.md/i,
    );

    expect(renameInput).toHaveValue("README.md");

    await user.keyboard("{Escape}");

    expect(
      screen.queryByLabelText(/rename README\.md/i),
    ).not.toBeInTheDocument();
    expect(onRenameEntry).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /README\.md Markdown file/i }),
    ).toBeVisible();
  });

  it("shows recent files below the tree and supports collapse and resizing", async () => {
    const user = userEvent.setup();
    const onOpenRecentFile = vi.fn();
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace-recent-files",
        tree,
      },
    };

    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenRecentFile={onOpenRecentFile}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        recentFilePaths={["docs/intro.md", "README.md"]}
        text={text}
        state={state}
      />,
    );

    const recentFileButtons = screen.getAllByRole("button", {
      name: /open recent file/i,
    });

    expect(recentFileButtons[0]).toHaveTextContent("intro.md");
    expect(recentFileButtons[1]).toHaveTextContent("README.md");

    await user.click(recentFileButtons[1]);

    expect(onOpenRecentFile).toHaveBeenCalledWith("README.md");

    await user.click(screen.getByRole("button", { name: /recent files/i }));

    expect(
      container.querySelector(".explorer-recent-files-section"),
    ).toHaveClass("is-collapsed");
    expect(
      screen.queryByRole("button", { name: /open recent file README\.md/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /recent files/i }));

    const resizeHandle = screen.getByRole("separator", {
      name: /resize recent files panel/i,
    });
    const explorerContent = container.querySelector(".explorer-content")!;

    vi.spyOn(explorerContent, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      height: 500,
      left: 0,
      right: 288,
      toJSON: () => ({}),
      top: 0,
      width: 288,
      x: 0,
      y: 0,
    });

    const pointerDown = new Event("pointerdown", { bubbles: true });

    Object.defineProperty(pointerDown, "clientY", { value: 360 });
    fireEvent(resizeHandle, pointerDown);
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "140");

    const pointerMove = new Event("pointermove");

    Object.defineProperty(pointerMove, "clientY", { value: 300 });
    window.dispatchEvent(pointerMove);
    fireEvent.pointerUp(window);

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "200");
    expect(localStorage.getItem("mde.explorerRecentFilesPanel")).toContain(
      '"height":200',
    );
  });

  it("renders settings and theme controls as separate buttons in one footer row", () => {
    const state: AppState = {
      draftMarkdown: "# Fixture Workspace",
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: "# Fixture Workspace",
        path: "README.md",
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: "README.md",
      selectedFilePath: "README.md",
      workspace: {
        name: "workspace",
        rootPath: "/workspace-footer-controls",
        tree,
      },
    };

    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    const footer = container.querySelector(".explorer-theme-footer");
    const settingsButton = screen.getByRole("button", {
      name: /^open settings$/i,
    });
    const themeButton = screen.getByRole("button", {
      name: /^change theme$/i,
    });

    expect(footer).not.toBeNull();
    expect(settingsButton).toHaveClass("explorer-footer-settings-button");
    expect(themeButton).toHaveClass("theme-selector-button");
    expect(settingsButton.parentElement).toBe(footer);
    expect(themeButton.parentElement).toBe(footer);
    expect(Array.from(footer?.children ?? [])).toEqual([
      settingsButton,
      themeButton,
    ]);
    expect(settingsButton).not.toContainElement(themeButton);
    expect(themeButton).toHaveTextContent("Carbon");
  });

  it("keeps hidden entries scoped by workspace and can show them from the context menu", async () => {
    const user = userEvent.setup();
    const createState = (rootPath: string): AppState => ({
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: rootPath.endsWith("one") ? "Workspace One" : "Workspace Two",
        rootPath,
        tree,
      },
    });
    const renderPane = (state: AppState) => (
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />
    );

    const { rerender } = render(renderPane(createState("/workspace-one")));

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /docs folder/i }),
      {
        clientX: 36,
        clientY: 48,
      },
    );
    await user.click(screen.getByRole("menuitem", { name: /^hide$/i }));

    expect(
      screen.queryByRole("button", { name: /docs folder/i }),
    ).not.toBeInTheDocument();

    rerender(renderPane(createState("/workspace-two")));

    expect(
      screen.getByRole("button", { name: /docs folder/i }),
    ).toBeInTheDocument();

    rerender(renderPane(createState("/workspace-one")));

    expect(
      screen.queryByRole("button", { name: /docs folder/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /show hidden entries/i }),
    );

    expect(
      screen.getByRole("button", { name: /docs folder/i }),
    ).toBeInTheDocument();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /docs folder/i }),
      {
        clientX: 36,
        clientY: 48,
      },
    );

    expect(screen.getByRole("menuitem", { name: /^show$/i })).toBeVisible();

    await user.click(screen.getByRole("menuitem", { name: /^show$/i }));

    expect(
      screen.getByRole("button", { name: /docs folder/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show hidden entries/i }),
    ).toBeDisabled();
  });

  it("defaults dot-prefixed workspace entries to hidden on first open", async () => {
    const user = userEvent.setup();
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: "workspace",
        rootPath: "/workspace-with-hidden-entries",
        tree: treeWithHiddenEntries,
      },
    };

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />,
    );

    expect(screen.getByRole("button", { name: /docs folder/i })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /\.vscode folder/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\.draft\.md Markdown file/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /show hidden entries/i }),
    );

    expect(
      screen.getByRole("button", { name: /\.vscode folder/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /\.draft\.md Markdown file/i }),
    ).toBeVisible();
  });

  it("does not reapply default hidden entries after a user shows one", async () => {
    const user = userEvent.setup();
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: "workspace",
        rootPath: "/workspace-default-hidden-override",
        tree: treeWithHiddenEntries,
      },
    };
    const renderPane = () => (
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />
    );

    let renderedPane = render(renderPane());

    await user.click(
      screen.getByRole("button", { name: /show hidden entries/i }),
    );
    fireEvent.contextMenu(
      screen.getByRole("button", { name: /\.vscode folder/i }),
      { clientX: 36, clientY: 48 },
    );
    await user.click(screen.getByRole("menuitem", { name: /^show$/i }));

    renderedPane.unmount();
    renderedPane = render(renderPane());

    expect(
      screen.getByRole("button", { name: /\.vscode folder/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /\.draft\.md Markdown file/i }),
    ).not.toBeInTheDocument();
    renderedPane.unmount();
  });

  it("persists hidden entries across explorer remounts", async () => {
    const user = userEvent.setup();
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree,
      },
    };
    const renderPane = () => (
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        text={text}
        state={state}
      />
    );

    let renderedPane = render(renderPane());

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /docs folder/i }),
      {
        clientX: 36,
        clientY: 48,
      },
    );
    await user.click(screen.getByRole("menuitem", { name: /^hide$/i }));

    expect(
      screen.queryByRole("button", { name: /docs folder/i }),
    ).not.toBeInTheDocument();

    renderedPane.unmount();
    renderedPane = render(renderPane());

    expect(
      screen.queryByRole("button", { name: /docs folder/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /show hidden entries/i }),
    );
    fireEvent.contextMenu(
      screen.getByRole("button", { name: /docs folder/i }),
      {
        clientX: 36,
        clientY: 48,
      },
    );
    await user.click(screen.getByRole("menuitem", { name: /^show$/i }));

    renderedPane.unmount();
    renderedPane = render(renderPane());

    expect(
      screen.getByRole("button", { name: /docs folder/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show hidden entries/i }),
    ).toBeDisabled();
    renderedPane.unmount();
  });
});
