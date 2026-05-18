import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPONENT_IDS } from "../../src/renderer/src/componentIds";
import { ExplorerPane } from "../../src/renderer/src/explorer/ExplorerPane";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../src/renderer/src/i18n/appLanguage";
import type { AppState } from "../../src/renderer/src/app/appTypes";
import type { AutomationExplorerProjection } from "../../src/shared/automation";

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
  workspace: {
    name: "Workspace",
    rootPath: "/workspace",
    tree: [],
    type: "workspace",
  },
});

const createProjection = (): AutomationExplorerProjection => ({
  diagnostics: [],
  flows: [
    {
      executors: [
        {
          displayName: "Implementation",
          executorId: "implementation",
          sourcePath: "/workspace/.mde/automation-flows/review/implementation.md",
          type: "markdown",
        },
        {
          displayName: "Code review skill",
          executorId: "code-review",
          sourceClass: "repo-local",
          sourcePath: "/workspace/.codex/skills/code-review/SKILL.md",
          type: "skill",
        },
        {
          diagnostics: [
            {
              code: "skill.unresolved",
              diagnosticId: "skill.unresolved",
              message: "Unresolved skill",
              severity: "warning",
            },
          ],
          displayName: "Missing skill",
          executorId: "missing",
          sourceClass: "unresolved",
          type: "skill",
        },
      ],
      flowOwnerKey: "workspace:review:flow:review",
      id: "review",
      name: "Review",
      scope: "workspace",
      sourceFile: "/workspace/.mde/automation-flows/review.md",
    },
    {
      appliedToWorkspace: true,
      executors: [
        {
          displayName: "Global Implementation",
          executorId: "implementation",
          sourcePath:
            "/Users/example/.mde/automation-flows/weekly/implementation.md",
          type: "markdown",
        },
      ],
      flowOwnerKey: "global:flow:weekly",
      id: "weekly",
      name: "Weekly",
      scope: "user",
      sourceFile: "/Users/example/.mde/automation-flows/weekly.md",
    },
  ],
  workspaceRoot: "/workspace",
});

describe("ExplorerPane Automation Flows", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders automation flows above recent files and exposes management actions", async () => {
    const user = userEvent.setup();
    const onCreateAutomationFlow = vi.fn();
    const onApplyGlobalAutomationFlow = vi.fn();
    const onRefreshAutomationFlows = vi.fn();
    const onRefreshAutomationSkills = vi.fn();
    const onOpenAutomationFlow = vi.fn();
    const onOpenAutomationExecutor = vi.fn();
    const onOpenAutomationSkillExecutor = vi.fn();
    const onAddAutomationExecutor = vi.fn();
    const onDeleteAutomationFlow = vi.fn();
    const onJumpGlobalAutomationFlow = vi.fn();
    const onRemoveAppliedGlobalAutomationFlow = vi.fn();
    const onRenameAutomationFlow = vi.fn();
    const { container } = render(
      <ExplorerPane
        automationFlowsProjection={createProjection()}
        onAddAutomationExecutor={onAddAutomationExecutor}
        onApplyGlobalAutomationFlow={onApplyGlobalAutomationFlow}
        onCreateAutomationFlow={onCreateAutomationFlow}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteAutomationFlow={onDeleteAutomationFlow}
        onDeleteEntry={vi.fn()}
        onJumpGlobalAutomationFlow={onJumpGlobalAutomationFlow}
        onOpenWorkspace={vi.fn()}
        onOpenAutomationExecutor={onOpenAutomationExecutor}
        onOpenAutomationFlow={onOpenAutomationFlow}
        onOpenAutomationSkillExecutor={onOpenAutomationSkillExecutor}
        onRefreshAutomationFlows={onRefreshAutomationFlows}
        onRefreshAutomationSkills={onRefreshAutomationSkills}
        onRemoveAppliedGlobalAutomationFlow={onRemoveAppliedGlobalAutomationFlow}
        onRenameAutomationFlow={onRenameAutomationFlow}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        recentFilePaths={["notes/today.md"]}
        state={createState()}
        text={text}
      />,
    );

    const automationPanel = screen.getByLabelText(text("explorer.automationFlows"));
    const recentPanel = screen.getByLabelText(text("explorer.recentFiles"));

    expect(automationPanel).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.explorer.automationFlowsPanel,
    );
    expect(
      automationPanel.compareDocumentPosition(recentPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      container.querySelectorAll(
        `[data-component-id="${COMPONENT_IDS.explorer.automationFlowRow}"]`,
      ),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll(
        `[data-component-id="${COMPONENT_IDS.explorer.automationExecutorRow}"]`,
      ),
    ).toHaveLength(4);

    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.addAutomationFlow"),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.applyGlobalAutomationFlow"),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.refreshAutomationSkills"),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.openAutomationFlow", { name: "Review" }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.automationMarkdownExecutorLabel", {
          name: "Implementation",
        }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.automationSkillExecutorLabel", {
          name: "Code review skill",
        }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.automationMarkdownExecutorLabel", {
          name: "Global Implementation",
        }),
      }),
    );

    expect(
      within(automationPanel).getByRole("button", {
        name: text("explorer.automationSkillExecutorLabel", {
          name: "Missing skill",
        }),
      }),
    ).toBeDisabled();

    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.addAutomationExecutorForFlow", { name: "Review" }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.addAutomationExecutorForFlow", { name: "Weekly" }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.renameAutomationFlow", { name: "Review" }),
      }),
    );
    const renameInput = within(automationPanel).getByRole("textbox", {
      name: text("explorer.renameAutomationFlow", { name: "Review" }),
    });
    await user.clear(renameInput);
    await user.type(renameInput, "Renamed Review{Enter}");
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.deleteAutomationFlow", { name: "Review" }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.jumpGlobalAutomationFlow", { name: "Weekly" }),
      }),
    );
    await user.click(
      within(automationPanel).getByRole("button", {
        name: text("explorer.removeGlobalAutomationFlow", { name: "Weekly" }),
      }),
    );

    expect(onCreateAutomationFlow).toHaveBeenCalledTimes(1);
    expect(onApplyGlobalAutomationFlow).toHaveBeenCalledTimes(1);
    expect(onRefreshAutomationSkills).toHaveBeenCalledTimes(1);
    expect(onRefreshAutomationFlows).toHaveBeenCalled();
    expect(onOpenAutomationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "review" }),
    );
    expect(onOpenAutomationExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ executorId: "implementation" }),
      expect.objectContaining({ id: "review" }),
    );
    expect(onOpenAutomationSkillExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ executorId: "code-review" }),
      expect.objectContaining({ id: "review" }),
    );
    expect(onAddAutomationExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ id: "review" }),
    );
    expect(onAddAutomationExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ id: "weekly", scope: "user" }),
    );
    expect(onOpenAutomationExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ executorId: "implementation" }),
      expect.objectContaining({ id: "weekly", scope: "user" }),
    );
    expect(onRenameAutomationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "review" }),
      "Renamed Review",
    );
    expect(onDeleteAutomationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "review" }),
    );
    expect(onJumpGlobalAutomationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "weekly" }),
    );
    expect(onRemoveAppliedGlobalAutomationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "weekly" }),
    );
  });

  it("persists collapsed state and refreshes when expanding", async () => {
    const user = userEvent.setup();
    const onRefreshAutomationFlows = vi.fn();
    const { unmount } = render(
      <ExplorerPane
        automationFlowsProjection={createProjection()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshAutomationFlows={onRefreshAutomationFlows}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState()}
        text={text}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(text("explorer.automationFlows")),
      }),
    );
    expect(localStorage.getItem("mde.explorerAutomationFlowsPanel")).toBe(
      "collapsed",
    );
    unmount();

    render(
      <ExplorerPane
        automationFlowsProjection={createProjection()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshAutomationFlows={onRefreshAutomationFlows}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState()}
        text={text}
      />,
    );

    expect(screen.queryByText("Review")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(text("explorer.automationFlows")),
      }),
    );
    expect(onRefreshAutomationFlows).toHaveBeenCalled();
    expect(localStorage.getItem("mde.explorerAutomationFlowsPanel")).toBe(
      "expanded",
    );
  });

  it("expands automation flows when a launch intent targets the panel", async () => {
    const onRefreshAutomationFlows = vi.fn();

    localStorage.setItem("mde.explorerAutomationFlowsPanel", "collapsed");

    render(
      <ExplorerPane
        automationFlowsPanelOpenRequest={1}
        automationFlowsProjection={createProjection()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshAutomationFlows={onRefreshAutomationFlows}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState()}
        text={text}
      />,
    );

    expect(await screen.findByText("Review")).toBeInTheDocument();
    expect(localStorage.getItem("mde.explorerAutomationFlowsPanel")).toBe(
      "expanded",
    );
    expect(onRefreshAutomationFlows).toHaveBeenCalled();
  });
});
