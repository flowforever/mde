import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { AppText, AppTextKey } from "../i18n/appLanguage";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
  getAppLanguagePack,
  isAppTextKey,
  readAppLanguagePreference,
  readCustomAppLanguagePacks,
} from "../i18n/appLanguage";
import {
  APP_THEME_STORAGE_KEY,
  readSystemThemeFamily,
  readThemePreference,
  resolveThemePreference,
  SYSTEM_DARK_COLOR_SCHEME_QUERY,
  type AppThemeFamily,
} from "../theme/appThemes";
import { COMPONENT_IDS } from "../componentIds";
import type {
  AutomationApi,
  AutomationDiagnostic,
  AutomationProjection,
  AutomationCenterFilters,
  AutomationCenterScopeId,
  AutomationFlowRow,
  AutomationGetProjectionRequest,
} from "../../../shared/automation";
import type { EditorApi } from "../../../shared/workspace";
import type { MdeWindowApi } from "../../../shared/windowApi";
import { createAutomationCenterViewModel } from "./automationViewModel";
import { readRecentWorkspaces } from "../workspaces/recentWorkspaces";
import { SignalStack } from "./SignalStack";
import { WorkspaceFlowFilters } from "./WorkspaceFlowFilters";
import { QuietFlowline } from "./QuietFlowline";
import "./styles.css";

declare global {
  interface Window {
    readonly mdeAutomation?: AutomationApi;
    readonly editorApi?: EditorApi;
    readonly mdeWindow?: MdeWindowApi;
  }
}

interface AutomationCenterWindowProps {
  readonly agentChatApi?: unknown;
  readonly automationApi?: AutomationApi;
  readonly text?: AppText;
}

const AUTOMATION_SIDEBAR_WIDTH_DEFAULT = 260;
const AUTOMATION_SIDEBAR_WIDTH_MAX = 440;
const AUTOMATION_SIDEBAR_WIDTH_MIN = 220;
const AUTOMATION_SIDEBAR_WIDTH_STORAGE_KEY =
  "mde.automationCenter.sidebarWidth";

const AUTOMATION_DECISION_DIAGNOSTIC_KEYS = {
  "automationRun.decisionUnavailable":
    "automation.diagnostics.automationRun.decisionUnavailable",
  "automationRun.resumeFailed":
    "automation.diagnostics.automationRun.resumeFailed",
} as const satisfies Record<string, AppTextKey>;

const createDefaultText = (): AppText => {
  if (typeof window === "undefined") {
    return createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);
  }

  return createAppText(
    getAppLanguagePack(
      readAppLanguagePreference(window.localStorage, window.navigator.languages),
      readCustomAppLanguagePacks(window.localStorage),
    ),
  );
};

const clampAutomationSidebarWidth = (width: number): number =>
  Math.min(
    AUTOMATION_SIDEBAR_WIDTH_MAX,
    Math.max(AUTOMATION_SIDEBAR_WIDTH_MIN, Math.round(width)),
  );

const readAutomationSidebarWidth = (): number => {
  if (typeof window === "undefined") {
    return AUTOMATION_SIDEBAR_WIDTH_DEFAULT;
  }

  const storedValue = window.localStorage.getItem(
    AUTOMATION_SIDEBAR_WIDTH_STORAGE_KEY,
  );

  if (storedValue === null) {
    return AUTOMATION_SIDEBAR_WIDTH_DEFAULT;
  }

  const storedWidth = Number(storedValue);

  return Number.isFinite(storedWidth)
    ? clampAutomationSidebarWidth(storedWidth)
    : AUTOMATION_SIDEBAR_WIDTH_DEFAULT;
};

const uniqueWorkspaceRoots = (
  entries: readonly { readonly rootPath: string }[],
): readonly string[] =>
  Object.freeze(
    Array.from(
      new Set(
        entries
          .map((entry) => entry.rootPath.trim())
          .filter((rootPath) => rootPath.length > 0),
      ),
    ),
  );

const getDecisionSubmitFailureMessage = (
  diagnostic: AutomationDiagnostic | undefined,
  text: AppText,
): string => {
  const textKey =
    diagnostic !== undefined &&
    diagnostic.code in AUTOMATION_DECISION_DIAGNOSTIC_KEYS
      ? AUTOMATION_DECISION_DIAGNOSTIC_KEYS[
          diagnostic.code as keyof typeof AUTOMATION_DECISION_DIAGNOSTIC_KEYS
        ]
      : undefined;

  return text(textKey ?? "automation.submitDecisionFailed");
};

const getAutomationCommandFailureMessage = (
  diagnostic: AutomationDiagnostic | undefined,
  text: AppText,
  fallbackKey: AppTextKey,
): string => {
  if (
    diagnostic?.code === "automationRun.invalidExecutionRoot" &&
    diagnostic.executionRoot !== undefined &&
    diagnostic.taskTitle !== undefined &&
    diagnostic.userSafeReason !== undefined
  ) {
    const reasonKey =
      diagnostic.userSafeReason === "the path is empty or malformed"
        ? "automation.executionRootReasonMalformed"
        : diagnostic.userSafeReason === "the path is not a valid absolute local path"
          ? "automation.executionRootReasonInvalidAbsolutePath"
          : diagnostic.userSafeReason === "the path is not an existing directory"
            ? "automation.executionRootReasonMissingDirectory"
            : undefined;

    return text("automation.executionRootDiagnosticDetail", {
      reason:
        reasonKey === undefined
          ? text("automation.executionRootReasonInvalidAbsolutePath")
          : text(reasonKey),
      root: diagnostic.executionRoot,
      task: diagnostic.taskTitle,
    });
  }

  return diagnostic?.messageKey !== undefined && isAppTextKey(diagnostic.messageKey)
    ? text(diagnostic.messageKey)
    : text(fallbackKey);
};

export const AutomationCenterWindow = ({
  automationApi,
  text = createDefaultText(),
}: AutomationCenterWindowProps = {}): JSX.Element => {
  const resolvedAutomationApi = automationApi ?? window.mdeAutomation;
  const [projection, setProjection] = useState<AutomationProjection | null>(null);
  const [workspaceEntries] = useState(() =>
    readRecentWorkspaces()
      .filter((workspace) => workspace.type === "workspace")
      .map((workspace) => ({
        name: workspace.name,
        rootPath: workspace.rootPath,
      })),
  );
  const [selectedTaskKey, setSelectedTaskKey] = useState<
    string | null | undefined
  >(undefined);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readAutomationSidebarWidth);
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemThemeFamily, setSystemThemeFamily] =
    useState<AppThemeFamily>(readSystemThemeFamily);
  const automationCenterRef = useRef<HTMLElement | null>(null);
  const createProjectionRequest = useCallback(():
    | AutomationGetProjectionRequest
    | undefined => {
    const workspaceRoots = uniqueWorkspaceRoots(workspaceEntries);

    return workspaceRoots.length === 0
      ? undefined
      : {
          workspaceRoots,
        };
  }, [workspaceEntries]);

  const updateSidebarWidth = useCallback((width: number): void => {
    const nextWidth = clampAutomationSidebarWidth(width);

    setSidebarWidth(nextWidth);
    window.localStorage.setItem(
      AUTOMATION_SIDEBAR_WIDTH_STORAGE_KEY,
      String(nextWidth),
    );
  }, []);

  const updateSidebarWidthFromPointer = useCallback(
    (clientX: number): void => {
      const shellLeft =
        automationCenterRef.current?.getBoundingClientRect().left ?? 0;

      updateSidebarWidth(clientX - shellLeft);
    },
    [updateSidebarWidth],
  );

  const beginSidebarResize = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    updateSidebarWidthFromPointer(event.clientX);
    setIsResizingSidebar(true);
  };

  const resizeSidebarFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateSidebarWidth(sidebarWidth - 16);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      updateSidebarWidth(sidebarWidth + 16);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateSidebarWidth(AUTOMATION_SIDEBAR_WIDTH_MIN);
    } else if (event.key === "End") {
      event.preventDefault();
      updateSidebarWidth(AUTOMATION_SIDEBAR_WIDTH_MAX);
    }
  };

  const refreshProjection = useCallback(async (): Promise<void> => {
    if (resolvedAutomationApi === undefined) {
      setLoadState("error");
      return;
    }

    const { projection: nextProjection } =
      await resolvedAutomationApi.getProjection(createProjectionRequest());

    setProjection(nextProjection);
    setLoadState("ready");
  }, [createProjectionRequest, resolvedAutomationApi]);
  const applyLocalFilters = useCallback(
    (nextFilters: AutomationCenterFilters): void => {
      setProjection((currentProjection) =>
        currentProjection === null
          ? currentProjection
          : {
              ...currentProjection,
              filters: nextFilters,
            },
      );
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    if (resolvedAutomationApi === undefined) {
      return () => {
        cancelled = true;
      };
    }

    void resolvedAutomationApi
      .getProjection(createProjectionRequest())
      .then(({ projection: nextProjection }) => {
        if (!cancelled) {
          setProjection(nextProjection);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [createProjectionRequest, resolvedAutomationApi]);

  useEffect(() => {
    let mediaQueryList: MediaQueryList;

    try {
      mediaQueryList = window.matchMedia(SYSTEM_DARK_COLOR_SCHEME_QUERY);
    } catch {
      return undefined;
    }

    const updateSystemThemeFamily = (
      eventOrQueryList: MediaQueryList | MediaQueryListEvent,
    ): void => {
      setSystemThemeFamily(eventOrQueryList.matches ? "dark" : "light");
    };

    updateSystemThemeFamily(mediaQueryList);
    mediaQueryList.addEventListener?.("change", updateSystemThemeFamily);
    mediaQueryList.addListener?.(updateSystemThemeFamily);

    return () => {
      mediaQueryList.removeEventListener?.("change", updateSystemThemeFamily);
      mediaQueryList.removeListener?.(updateSystemThemeFamily);
    };
  }, []);

  useEffect(() => {
    const updateThemePreferenceFromStorage = (event: StorageEvent): void => {
      if (event.key === APP_THEME_STORAGE_KEY) {
        setThemePreference(readThemePreference());
      }
    };

    window.addEventListener("storage", updateThemePreferenceFromStorage);

    return () => {
      window.removeEventListener("storage", updateThemePreferenceFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      updateSidebarWidthFromPointer(event.clientX);
    };
    const stopResize = (): void => {
      setIsResizingSidebar(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("blur", stopResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("blur", stopResize);
    };
  }, [isResizingSidebar, updateSidebarWidthFromPointer]);

  const viewModel =
    projection === null
      ? null
      : createAutomationCenterViewModel(projection, selectedTaskKey);
  const currentWorkspaceRoot = projection?.workspaceRoot;
  const effectiveLoadState =
    resolvedAutomationApi === undefined ? "error" : loadState;
  const resolvedTheme = resolveThemePreference(
    themePreference,
    systemThemeFamily,
  );
  const startTask = useCallback(
    async (input: {
      readonly executorId: string
      readonly executorSnapshotId?: string
      readonly taskDataId: string
      readonly taskDataSnapshotId: string
      readonly taskId: string
      readonly taskKey?: string
    }) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      setStatusMessage(null);
      try {
        const result = await resolvedAutomationApi.startRun(input);

        if (!result.accepted) {
          setStatusMessage(
            getAutomationCommandFailureMessage(
              result.diagnostic,
              text,
              "automation.startTaskFailed",
            ),
          );
        }
      } catch {
        setStatusMessage(text("automation.startTaskFailed"));
      } finally {
        await refreshProjection().catch(() => {
          setLoadState("error");
        });
      }
    },
    [refreshProjection, resolvedAutomationApi, text],
  );
  const submitDecision = useCallback(
    async (decisionId: string, response: string) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      setStatusMessage(null);

      try {
        const result = await resolvedAutomationApi.submitDecision({
          decisionId,
          response,
        });

        if (!result.accepted) {
          setStatusMessage(
            getDecisionSubmitFailureMessage(result.diagnostic, text),
          );
        }
      } catch {
        setStatusMessage(text("automation.submitDecisionFailed"));
      } finally {
        await refreshProjection();
      }
    },
    [refreshProjection, resolvedAutomationApi, text],
  );
  const openNativeSession = useCallback(
    async (runId: string): Promise<void> => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      setStatusMessage(null);

      try {
        const result = await resolvedAutomationApi.openNativeSession({ runId });

        if (!result.accepted) {
          setStatusMessage(text("automation.openNativeSessionFailed"));
        }
      } catch {
        setStatusMessage(text("automation.openNativeSessionFailed"));
      }
    },
    [resolvedAutomationApi, text],
  );
  const updateFilters = useCallback(
    async (nextFilters: AutomationCenterFilters) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      applyLocalFilters(nextFilters);
      await resolvedAutomationApi.updateFilters({ filters: nextFilters });
      setSelectedTaskKey(undefined);
      await refreshProjection();
    },
    [applyLocalFilters, refreshProjection, resolvedAutomationApi],
  );
  const returnToWorkspace = useCallback((): void => {
    void window.mdeWindow?.focusWorkspaceWindow();
  }, []);
  const manageScope = useCallback(
    async (target: {
      readonly scopeId: AutomationCenterScopeId
      readonly workspaceId?: string
    }): Promise<void> => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      const managementTarget =
        await resolvedAutomationApi.openAutomationManagementTarget({
          target: target.scopeId === "global" ? "global" : "workspace",
          ...(target.workspaceId !== undefined
            ? { workspaceRoot: target.workspaceId }
            : {}),
        });
      if (window.editorApi?.openPathInNewWindow !== undefined) {
        await window.editorApi.openPathInNewWindow({
          type: "workspace-automation-flows",
          workspaceRoot: managementTarget.rootPath,
        });
      } else {
        await window.mdeWindow?.focusWorkspaceWindow();
      }
      await refreshProjection();
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const openDiagnosticsTarget = useCallback((): void => {
    const target =
      currentWorkspaceRoot === undefined
        ? ({ scopeId: "global" } as const)
        : ({
            scopeId: `workspace:${currentWorkspaceRoot}` as AutomationCenterScopeId,
            workspaceId: currentWorkspaceRoot,
          } as const);

    void manageScope(target);
  }, [currentWorkspaceRoot, manageScope]);
  const setFlowLifecycle = useCallback(
    async (
      flow: AutomationFlowRow,
      lifecycle: Extract<AutomationFlowRow["lifecycle"], "disabled" | "enabled">,
    ): Promise<void> => {
      if (
        resolvedAutomationApi === undefined ||
        flow.definitionPath === undefined
      ) {
        return;
      }

      setStatusMessage(null);

      try {
        await resolvedAutomationApi.setFlowLifecycle({
          filePath: flow.definitionPath,
          lifecycle,
          ...(flow.workspaceId !== undefined
            ? { workspaceRoot: flow.workspaceId }
            : {}),
        });
      } catch {
        setStatusMessage(text("automation.updateFlowLifecycleFailed"));
      } finally {
        await refreshProjection().catch(() => {
          setLoadState("error");
        });
      }
    },
    [refreshProjection, resolvedAutomationApi, text],
  );

  return (
    <main
      aria-label={text("automation.centerTitle")}
      className={[
        "app-shell",
        "automation-center-window",
        isResizingSidebar ? "is-resizing-explorer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-component-id={COMPONENT_IDS.automation.centerWindow}
      data-panel-family={resolvedTheme.panelFamily}
      data-theme={resolvedTheme.id}
      data-theme-family={resolvedTheme.family}
      data-theme-mode={themePreference.mode}
      ref={automationCenterRef}
      style={
        {
          "--explorer-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <WorkspaceFlowFilters
        currentWorkspaceRoot={currentWorkspaceRoot}
        onManageScope={(target) => {
          void manageScope(target);
        }}
        onReturnToWorkspace={returnToWorkspace}
        onOpenNativeSession={(runId) => {
          void openNativeSession(runId);
        }}
        onSetFlowLifecycle={(flow, lifecycle) => {
          void setFlowLifecycle(flow, lifecycle);
        }}
        onUpdateFilters={(filters) => {
          void updateFilters(filters);
        }}
        filters={projection?.filters ?? {}}
        flows={projection?.flows ?? []}
        runs={projection?.runs ?? []}
        taskStackCounts={{
          done: viewModel?.doneTasks.length ?? 0,
          needsMe: viewModel?.needsMeTasks.length ?? 0,
          ready: viewModel?.readyTasks.length ?? 0,
          running: viewModel?.runningTasks.length ?? 0,
        }}
        text={text}
        workspaceName={currentWorkspaceRoot}
        workspaces={workspaceEntries}
      />
      <div
        aria-label={text("automation.resizeSidebar")}
        aria-orientation="vertical"
        aria-valuemax={AUTOMATION_SIDEBAR_WIDTH_MAX}
        aria-valuemin={AUTOMATION_SIDEBAR_WIDTH_MIN}
        aria-valuenow={sidebarWidth}
        className="explorer-resize-handle automation-sidebar-resize-handle"
        data-component-id={COMPONENT_IDS.automation.sidebarResizeHandle}
        onKeyDown={resizeSidebarFromKeyboard}
        onPointerDown={beginSidebarResize}
        role="separator"
        tabIndex={0}
      />
      <section
        aria-label={text("automation.centerTitle")}
        className={`editor-pane automation-console-pane${
          viewModel === null ? " automation-console-pane--loading" : ""
        }`}
      >
        <div
          className="automation-console"
        >
          {viewModel === null ? (
            <section
              aria-label={text("automation.signalStack")}
              className="automation-signal-stack"
              data-component-id={COMPONENT_IDS.automation.signalStack}
            >
              <h2>{text("automation.signalStack")}</h2>
              {effectiveLoadState === "loading" ? (
                <p>{text("automation.loadingProjection")}</p>
              ) : null}
              {effectiveLoadState === "error" ? (
                <p>{text("automation.projectionError")}</p>
              ) : null}
            </section>
          ) : (
            <>
              {statusMessage !== null ? (
                <p
                  className="automation-status-message"
                  data-component-id={COMPONENT_IDS.automation.decisionStatusMessage}
                  role="alert"
                >
                  {statusMessage}
                </p>
              ) : null}
              <SignalStack
                onOpenDiagnosticsTarget={openDiagnosticsTarget}
                onSelectTask={(task) => {
                  setStatusMessage(null);
                  setSelectedTaskKey(task.taskKey ?? task.taskId);
                }}
                selectedTaskKey={
                  viewModel.selectedTask?.taskKey ?? viewModel.selectedTask?.taskId
                }
                text={text}
                viewModel={viewModel}
              />
              <QuietFlowline
                onClearSelection={() => {
                  setStatusMessage(null);
                  setSelectedTaskKey(null);
                }}
                onStartTask={(task, executor) => {
                  if (
                    task?.taskDataId !== undefined &&
                    task.taskDataSnapshotId !== undefined &&
                    executor !== undefined
                  ) {
                    void startTask({
                      executorId: executor.executorId,
                      ...(executor.executorSnapshotId !== undefined
                        ? { executorSnapshotId: executor.executorSnapshotId }
                        : {}),
                      taskDataId: task.taskDataId,
                      taskDataSnapshotId: task.taskDataSnapshotId,
                      taskId: task.taskId,
                      ...(task.taskKey !== undefined
                        ? { taskKey: task.taskKey }
                        : {}),
                    });
                  }
                }}
                onSubmitDecision={(decisionId, response) => {
                  void submitDecision(decisionId, response);
                }}
                text={text}
                viewModel={viewModel}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
};
