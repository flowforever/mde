import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPONENT_IDS } from "../../src/renderer/src/componentIds";
import { ExplorerPane } from "../../src/renderer/src/explorer/ExplorerPane";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../src/renderer/src/i18n/appLanguage";
import type { AppState } from "../../src/renderer/src/app/appTypes";

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

const createState = (): AppState => ({
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
});

describe("Explorer after automation removal", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it.each(["en", "zh"] as const)("keeps normal controls and ignores legacy state in %s", (language) => {
    localStorage.setItem("mde.explorerAutomationFlowsPanel", "collapsed");
    const pack = BUILT_IN_APP_LANGUAGE_PACKS[language];
    const legacyMessages = { "explorer.openAutomationCenter": "Legacy Center" };
    const localizedText = createAppText({ ...pack, messages: { ...pack.messages, ...legacyMessages } });
    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={{ ...createState(), workspace: { name: "Workspace", rootPath: "/workspace", tree: [], type: "workspace" } }}
        text={localizedText}
      />,
    );
    expect(container.querySelector('[data-component-id="explorer.automation-home-button"]')).toBeNull();
    expect(container.querySelector('[data-component-id="explorer.automation-flows-panel"]')).toBeNull();
    expect(screen.getByRole("button", { name: localizedText("explorer.collapseSidebar") })).toBeVisible();
    expect(container.querySelector(`[data-component-id="${COMPONENT_IDS.explorer.header}"]`)).toBeInTheDocument();
    expect(localStorage.getItem("mde.explorerAutomationFlowsPanel")).toBe("collapsed");
  });

  it("retains the collapsed sidebar toggle", () => {
    render(
      <ExplorerPane isCollapsed onCreateFile={vi.fn()} onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()} onOpenWorkspace={vi.fn()} onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()} onSelectFile={vi.fn()} onToggleCollapsed={vi.fn()}
        state={createState()} text={text} />,
    );
    expect(screen.getByRole("button", { name: text("explorer.expandSidebar") })).toHaveClass("explorer-sidebar-toggle");
  });
});
