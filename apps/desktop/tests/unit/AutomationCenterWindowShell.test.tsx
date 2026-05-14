import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomationCenterWindow } from "../../src/renderer/src/automation/AutomationCenterWindow";
import { App } from "../../src/renderer/src/app/App";
import { COMPONENT_IDS } from "../../src/renderer/src/componentIds";
import { APP_THEME_STORAGE_KEY } from "../../src/renderer/src/theme/appThemes";
import type { AutomationApi, AutomationProjection } from "../../src/shared/automation";
import {
  AUTOMATION_CENTER_WINDOW_MODE,
  EDITOR_WINDOW_MODE,
} from "../../src/shared/windowMode";
import { MdeWindowRoot } from "../../src/renderer/src/windowRoot";

const createMatchMediaMock = (matches: boolean): typeof window.matchMedia =>
  vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));

describe("AutomationCenterWindow shell", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    Reflect.deleteProperty(window, "mdeAutomation");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: createMatchMediaMock(false),
    });
  });

  const createProjection = (
    overrides: Partial<AutomationProjection> = {},
  ): AutomationProjection => ({
    buckets: {
      done: [],
      needsMe: [],
      ready: [],
      running: [],
    },
    decisions: [],
    diagnostics: [],
    filters: {},
    flows: [],
    generatedAt: "2026-05-10T08:00:00.000Z",
    reports: [],
    runs: [],
    tasks: [],
    ...overrides,
  });

  const createAutomationApi = (
    projection: AutomationProjection,
  ): AutomationApi =>
    ({
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      listCapabilityReports: vi.fn(),
      listReports: vi.fn(),
    }) as unknown as AutomationApi;

  it("requests projection through window.mdeAutomation and renders loaded tasks", async () => {
    const projection = createProjection({
      buckets: {
        done: [],
        needsMe: [],
        ready: [
          {
            automationFlowId: "flow-a",
            bucket: "ready",
            sourceItemId: "source-a",
            taskId: "task-a",
            title: "READY Loaded task",
          },
        ],
        running: [],
      },
      tasks: [
        {
          automationFlowId: "flow-a",
          bucket: "ready",
          sourceItemId: "source-a",
          taskId: "task-a",
          title: "READY Loaded task",
        },
      ],
    });
    const automationApi = createAutomationApi(projection);

    Object.defineProperty(window, "mdeAutomation", {
      configurable: true,
      value: automationApi,
    });

    render(<AutomationCenterWindow />);

    expect(
      screen.getByRole("main", { name: "Automation Center" }),
    ).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.automation.centerWindow,
    );

    expect(screen.getByRole("region", { name: "Signal Stack" })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.automation.signalStack,
    );
    let loadedTaskTitle: HTMLElement | undefined;
    await waitFor(() => {
      const signalStack = screen.getByRole("region", { name: "Signal Stack" });
      loadedTaskTitle = within(signalStack).getByText("READY Loaded task");
      expect(loadedTaskTitle).toBeInTheDocument();
    });
    expect(loadedTaskTitle?.closest("button")).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.automation.signalTaskRow,
    );
    expect(
      within(screen.getByRole("region", { name: "Signal Stack" })).queryByText(
        "Review release notes",
      ),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Flowline" })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.automation.flowline,
    );
    expect(automationApi.getProjection).toHaveBeenCalledTimes(1);
  });

  it("applies the persisted manual app theme to the Automation Center shell", () => {
    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: "blue-hour",
        lastLightThemeId: "manuscript",
        mode: "dark",
      }),
    );

    render(
      <AutomationCenterWindow
        automationApi={createAutomationApi(createProjection())}
      />,
    );

    const shell = screen.getByRole("main", { name: "Automation Center" });

    expect(shell).toHaveAttribute("data-theme", "blue-hour");
    expect(shell).toHaveAttribute("data-theme-family", "dark");
    expect(shell).toHaveAttribute("data-panel-family", "dark");
    expect(shell).toHaveAttribute("data-theme-mode", "dark");
  });

  it("resolves follow-system theme preferences before rendering Automation Center shell attributes", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: createMatchMediaMock(true),
    });
    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: "moss",
        lastLightThemeId: "porcelain",
        mode: "system",
      }),
    );

    render(
      <AutomationCenterWindow
        automationApi={createAutomationApi(createProjection())}
      />,
    );

    const shell = screen.getByRole("main", { name: "Automation Center" });

    expect(shell).toHaveAttribute("data-theme", "moss");
    expect(shell).toHaveAttribute("data-theme-family", "dark");
    expect(shell).toHaveAttribute("data-theme-mode", "system");
  });

  it("renders loading, empty, diagnostics, and error states through i18n text", async () => {
    const emptyApi = createAutomationApi(
      createProjection({
        diagnostics: [
          {
            code: "automationAdapter.missingExecutable",
            diagnosticId: "diagnostic-1",
            message: "Adapter setup is incomplete.",
            severity: "error",
          },
        ],
      }),
    );

    render(<AutomationCenterWindow automationApi={emptyApi} />);

    expect(screen.getByText("Loading automation tasks...")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Workspace flows" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize Automation Center sidebar" }),
    ).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.automation.sidebarResizeHandle,
    );
    expect(await screen.findByText("No automation tasks yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Setup diagnostics" }),
    ).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.automation.diagnosticList,
    );
    expect(
      screen.queryByText(
        "Automation setup needs attention. Check the automation-flow configuration.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Adapter setup is incomplete.")).not.toBeInTheDocument();

    const failingApi = {
      ...emptyApi,
      getProjection: vi.fn(() => Promise.reject(new Error("Projection failed"))),
    } as unknown as AutomationApi;

    cleanup();
    render(<AutomationCenterWindow automationApi={failingApi} />);

    await waitFor(() => {
      expect(screen.getByText("Unable to load automation tasks.")).toBeInTheDocument();
    });
  });

  it("selects the normal editor app for editor windows", () => {
    const root = MdeWindowRoot({
      windowMode: EDITOR_WINDOW_MODE,
    });

    expect(root.type).toBe(App);
  });

  it("selects AutomationCenterWindow for automation center windows", () => {
    const root = MdeWindowRoot({
      windowMode: AUTOMATION_CENTER_WINDOW_MODE,
    });

    expect(root.type).toBe(AutomationCenterWindow);
  });
});
