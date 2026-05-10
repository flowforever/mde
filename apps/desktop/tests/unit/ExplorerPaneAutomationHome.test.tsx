import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("ExplorerPane Automation Home", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders Home to the left of the Explorer header and keeps the sidebar toggle", async () => {
    const user = userEvent.setup();
    const onOpenAutomationCenter = vi.fn();
    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenAutomationCenter={onOpenAutomationCenter}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState()}
        text={text}
      />,
    );

    const homeButton = screen.getByRole("button", {
      name: text("explorer.openAutomationCenter"),
    });
    const header = container.querySelector(
      `[data-component-id="${COMPONENT_IDS.explorer.header}"]`,
    );

    expect(homeButton).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.explorer.automationHomeButton,
    );
    expect(homeButton.querySelector("svg")).toBeInTheDocument();
    expect(header).not.toBeNull();
    expect(
      homeButton.compareDocumentPosition(header!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: text("explorer.collapseSidebar") }),
    ).toHaveClass("explorer-sidebar-toggle");

    await user.click(homeButton);
    expect(onOpenAutomationCenter).toHaveBeenCalledTimes(1);
  });

  it("keeps the sidebar toggle when the Explorer pane is collapsed", () => {
    render(
      <ExplorerPane
        isCollapsed
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenAutomationCenter={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        onToggleCollapsed={vi.fn()}
        state={createState()}
        text={text}
      />,
    );

    expect(
      screen.getByRole("button", { name: text("explorer.expandSidebar") }),
    ).toHaveClass("explorer-sidebar-toggle");
  });
});
