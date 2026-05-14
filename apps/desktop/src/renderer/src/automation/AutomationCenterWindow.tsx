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
  AutomationCreateFlowFromTemplateRequest,
  AutomationDiagnostic,
  AutomationFlowDefinitionDocument,
  AutomationFlowRow,
  AutomationFlowTemplateSummary,
  AutomationProjection,
  AutomationProjectionFilters
} from "../../../shared/automation";
import type { MdeWindowApi } from "../../../shared/windowApi";
import type { AgentChatApi } from "../../../shared/agentChat";
import { createAutomationCenterViewModel } from "./automationViewModel";
import { AutomationAgentChatEntry } from "./AutomationAgentChatEntry";
import { AutomationFlowEditorHost } from "./AutomationFlowEditorHost";
import { SignalStack } from "./SignalStack";
import {
  WorkspaceFlowFilters,
  type AutomationFlowCreateTarget,
} from "./WorkspaceFlowFilters";
import { QuietFlowline } from "./QuietFlowline";
import "./styles.css";

declare global {
  interface Window {
    readonly mdeAutomation?: AutomationApi;
    readonly agentChatApi?: AgentChatApi;
    readonly mdeWindow?: MdeWindowApi;
  }
}

interface AutomationCenterWindowProps {
  readonly agentChatApi?: AgentChatApi;
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

type AutomationEditorState =
  | {
      readonly diagnostics: readonly AutomationDiagnostic[]
      readonly document?: AutomationFlowDefinitionDocument
      readonly mode: 'create'
      readonly setup: AutomationCreateFlowFromTemplateRequest
      readonly templates: readonly AutomationFlowTemplateSummary[]
    }
  | {
      readonly document: AutomationFlowDefinitionDocument
      readonly mode: 'edit'
    }

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
): string =>
  diagnostic?.messageKey !== undefined && isAppTextKey(diagnostic.messageKey)
    ? text(diagnostic.messageKey)
    : text(fallbackKey);

export const AutomationCenterWindow = ({
  agentChatApi,
  automationApi,
  text = createDefaultText(),
}: AutomationCenterWindowProps = {}): JSX.Element => {
  const resolvedAutomationApi = automationApi ?? window.mdeAutomation;
  const resolvedAgentChatApi = agentChatApi ?? window.agentChatApi;
  const [projection, setProjection] = useState<AutomationProjection | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<
    string | null | undefined
  >(undefined);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [editorState, setEditorState] = useState<AutomationEditorState | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readAutomationSidebarWidth);
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemThemeFamily, setSystemThemeFamily] =
    useState<AppThemeFamily>(readSystemThemeFamily);
  const automationCenterRef = useRef<HTMLElement | null>(null);

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
      await resolvedAutomationApi.getProjection();

    setProjection(nextProjection);
    setLoadState("ready");
  }, [resolvedAutomationApi]);
  const applyLocalFilters = useCallback(
    (nextFilters: AutomationProjectionFilters): void => {
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
      .getProjection()
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
  }, [resolvedAutomationApi]);

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
      : createAutomationCenterViewModel(projection, selectedTaskId);
  const agentChatWorkspaceRoot = projection?.workspaceRoot;
  const effectiveLoadState =
    resolvedAutomationApi === undefined ? "error" : loadState;
  const resolvedTheme = resolveThemePreference(
    themePreference,
    systemThemeFamily,
  );
  const createDefaultSetup = useCallback(
    (
      templates: readonly AutomationFlowTemplateSummary[],
      target: AutomationFlowCreateTarget = { scope: "workspace" },
    ): AutomationCreateFlowFromTemplateRequest => ({
      defaultEngine: "codex",
      flowId: `automation-flow-${(projection?.flows.length ?? 0) + 1}`,
      scope: target.scope,
      templateId:
        templates.find(
          (template) =>
            template.templateId === "local-dev-task" &&
            template.allowedScopes.includes(target.scope),
        )?.templateId ??
        templates.find((template) => template.allowedScopes.includes(target.scope))
          ?.templateId ??
        templates[0]?.templateId ??
        "local-dev-task",
    }),
    [projection?.flows.length],
  );
  const openCreateEditor = useCallback(async (target?: AutomationFlowCreateTarget) => {
    if (resolvedAutomationApi === undefined) {
      return;
    }

    const { templates } = await resolvedAutomationApi.listTemplates();
    const setup = createDefaultSetup(templates, target);

    setEditorState({
      diagnostics: [],
      mode: "create",
      setup,
      templates,
    });
  }, [createDefaultSetup, resolvedAutomationApi]);
  const createFlowFromTemplate = useCallback(
    async (setup: AutomationCreateFlowFromTemplateRequest) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      const validation = await resolvedAutomationApi.validateTemplateInput(setup);

      if (!validation.ok) {
        setEditorState((current) =>
          current?.mode === "create"
            ? { ...current, diagnostics: validation.diagnostics, setup }
            : current,
        );
        return;
      }

      const document = await resolvedAutomationApi.createFlowFromTemplate(setup);
      await refreshProjection();

      setEditorState((current) =>
        current?.mode === "create"
          ? {
              ...current,
              diagnostics: document.diagnostics,
              document,
              setup,
            }
          : current,
      );
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const openEditEditor = useCallback(
    async (flow: AutomationFlowRow) => {
      if (
        resolvedAutomationApi === undefined ||
        flow.definitionPath === undefined
      ) {
        return;
      }

      const document = await resolvedAutomationApi.loadFlowDefinition({
        filePath: flow.definitionPath,
      });

      setEditorState({
        document,
        mode: "edit",
      });
    },
    [resolvedAutomationApi],
  );
  const saveEditorDocument = useCallback(
    async (
      document: AutomationFlowDefinitionDocument,
      markdown: string,
    ): Promise<AutomationFlowDefinitionDocument> => {
      if (resolvedAutomationApi === undefined) {
        return document;
      }

      const savedDocument = await resolvedAutomationApi.saveFlowDefinition({
        filePath: document.path,
        markdown,
      });

      await refreshProjection();

      return savedDocument;
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const setFlowLifecycle = useCallback(
    async (
      flow: AutomationFlowRow,
      lifecycle: "disabled" | "enabled",
    ): Promise<void> => {
      if (
        resolvedAutomationApi === undefined ||
        flow.definitionPath === undefined
      ) {
        return;
      }

      await resolvedAutomationApi.setFlowLifecycle({
        filePath: flow.definitionPath,
        lifecycle,
      });
      await refreshProjection();
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const archiveFlow = useCallback(
    async (flow: AutomationFlowRow): Promise<void> => {
      if (
        resolvedAutomationApi === undefined ||
        flow.definitionPath === undefined
      ) {
        return;
      }

      await resolvedAutomationApi.archiveFlow({
        filePath: flow.definitionPath,
      });
      await refreshProjection();
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const restoreFlow = useCallback(
    async (flow: AutomationFlowRow): Promise<void> => {
      if (
        resolvedAutomationApi === undefined ||
        flow.definitionPath === undefined
      ) {
        return;
      }

      await resolvedAutomationApi.restoreFlow({
        filePath: flow.definitionPath,
      });
      await refreshProjection();
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const startTask = useCallback(
    async (taskId: string) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      setStatusMessage(null);
      try {
        const result = await resolvedAutomationApi.startRun({ taskId });

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
  const updateFilters = useCallback(
    async (nextFilters: AutomationProjectionFilters) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      applyLocalFilters(nextFilters);
      await resolvedAutomationApi.updateFilters({ filters: nextFilters });
      setSelectedTaskId(undefined);
      await refreshProjection();
    },
    [applyLocalFilters, refreshProjection, resolvedAutomationApi],
  );
  const returnToWorkspace = useCallback((): void => {
    void window.mdeWindow?.focusWorkspaceWindow();
  }, []);

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
        onArchiveFlow={(flow) => {
          void archiveFlow(flow);
        }}
        onCreateFlow={(target) => {
          void openCreateEditor(target);
        }}
        onEditFlow={(flow) => {
          void openEditEditor(flow);
        }}
        onReturnToWorkspace={returnToWorkspace}
        onRestoreFlow={(flow) => {
          void restoreFlow(flow);
        }}
        onSetFlowLifecycle={(flow, lifecycle) => {
          void setFlowLifecycle(flow, lifecycle);
        }}
        onUpdateFilters={(filters) => {
          void updateFilters(filters);
        }}
        filters={projection?.filters ?? {}}
        flows={projection?.flows ?? []}
        taskStackCounts={{
          done: viewModel?.doneTasks.length ?? 0,
          needsMe: viewModel?.needsMeTasks.length ?? 0,
          ready: viewModel?.readyTasks.length ?? 0,
          running: viewModel?.runningTasks.length ?? 0,
        }}
        text={text}
        workspaceName={agentChatWorkspaceRoot}
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
          editorState === null ? "" : " automation-console-pane--editor-open"
        }${viewModel === null ? " automation-console-pane--loading" : ""}`}
      >
        <div
          className={`automation-console${
            editorState === null ? "" : " automation-console--editor-open"
          }`}
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
          ) : editorState === null ? (
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
                onSelectTask={(task) => {
                  setStatusMessage(null);
                  setSelectedTaskId(task.taskId);
                }}
                selectedTaskId={viewModel.selectedTask?.taskId}
                text={text}
                viewModel={viewModel}
              />
              <QuietFlowline
                onClearSelection={() => {
                  setStatusMessage(null);
                  setSelectedTaskId(null);
                }}
                onStartTask={(taskId) => {
                  void startTask(taskId);
                }}
                onSubmitDecision={(decisionId, response) => {
                  void submitDecision(decisionId, response);
                }}
                text={text}
                viewModel={viewModel}
              />
              <AutomationAgentChatEntry
                agentChatApi={resolvedAgentChatApi}
                text={text}
                workspaceRoot={agentChatWorkspaceRoot}
              />
            </>
          ) : (
            <AutomationFlowEditorHost
              document={editorState.document}
              key={editorState.document?.path ?? editorState.mode}
              mode={editorState.mode}
              onClose={() => {
                setEditorState(null);
              }}
              onCreateFromTemplate={createFlowFromTemplate}
              onSaveDocument={(markdown) => {
                if (editorState.document === undefined) {
                  throw new Error(text("automation.saveFlowFailed"));
                }

                return saveEditorDocument(editorState.document, markdown);
              }}
              onSetupChange={(setup) => {
                setEditorState((current) =>
                  current?.mode === "create" ? { ...current, setup } : current,
                );
              }}
              setup={editorState.mode === "create" ? editorState.setup : undefined}
              setupDiagnostics={
                editorState.mode === "create" ? editorState.diagnostics : undefined
              }
              templates={
                editorState.mode === "create" ? editorState.templates : undefined
              }
              text={text}
              workspaceRoot={agentChatWorkspaceRoot}
            />
          )}
        </div>
      </section>
    </main>
  );
};
