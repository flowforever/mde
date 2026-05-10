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

import type { AppText } from "../i18n/appLanguage";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
  getAppLanguagePack,
  readAppLanguagePreference,
  readCustomAppLanguagePacks,
} from "../i18n/appLanguage";
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
import { createAutomationCenterViewModel } from "./automationViewModel";
import { AutomationFlowEditorHost } from "./AutomationFlowEditorHost";
import { SignalStack } from "./SignalStack";
import { WorkspaceFlowFilters } from "./WorkspaceFlowFilters";
import { QuietFlowline } from "./QuietFlowline";
import "./styles.css";

declare global {
  interface Window {
    readonly mdeAutomation?: AutomationApi;
    readonly mdeWindow?: MdeWindowApi;
  }
}

interface AutomationCenterWindowProps {
  readonly automationApi?: AutomationApi;
  readonly text?: AppText;
}

const AUTOMATION_SIDEBAR_WIDTH_DEFAULT = 288;
const AUTOMATION_SIDEBAR_WIDTH_MAX = 440;
const AUTOMATION_SIDEBAR_WIDTH_MIN = 220;
const AUTOMATION_SIDEBAR_WIDTH_STORAGE_KEY =
  "mde.automationCenter.sidebarWidth";

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

  const storedWidth = Number(
    window.localStorage.getItem(AUTOMATION_SIDEBAR_WIDTH_STORAGE_KEY),
  );

  return Number.isFinite(storedWidth)
    ? clampAutomationSidebarWidth(storedWidth)
    : AUTOMATION_SIDEBAR_WIDTH_DEFAULT;
};

export const AutomationCenterWindow = ({
  automationApi,
  text = createDefaultText(),
}: AutomationCenterWindowProps = {}): JSX.Element => {
  const resolvedAutomationApi = automationApi ?? window.mdeAutomation;
  const [projection, setProjection] = useState<AutomationProjection | null>(null);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [editorState, setEditorState] = useState<AutomationEditorState | null>(
    null,
  );
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readAutomationSidebarWidth);
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
    projection === null ? null : createAutomationCenterViewModel(projection);
  const effectiveLoadState =
    resolvedAutomationApi === undefined ? "error" : loadState;
  const createDefaultSetup = useCallback(
    (
      templates: readonly AutomationFlowTemplateSummary[],
    ): AutomationCreateFlowFromTemplateRequest => ({
      defaultEngine: "codex",
      flowId: `automation-flow-${(projection?.flows.length ?? 0) + 1}`,
      scope: "workspace",
      templateId:
        templates.find((template) => template.templateId === "local-dev-task")
          ?.templateId ??
        templates[0]?.templateId ??
        "local-dev-task",
    }),
    [projection?.flows.length],
  );
  const openCreateEditor = useCallback(async () => {
    if (resolvedAutomationApi === undefined) {
      return;
    }

    const { templates } = await resolvedAutomationApi.listTemplates();
    const setup = createDefaultSetup(templates);

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
  const startTask = useCallback(
    async (taskId: string) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      await resolvedAutomationApi.startRun({ taskId });
      await refreshProjection();
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const submitDecision = useCallback(
    async (decisionId: string, response: string) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      await resolvedAutomationApi.submitDecision({ decisionId, response });
      await refreshProjection();
    },
    [refreshProjection, resolvedAutomationApi],
  );
  const selectFlowFilter = useCallback(
    async (flowId: string | undefined) => {
      if (resolvedAutomationApi === undefined) {
        return;
      }

      const currentFilters = projection?.filters ?? {};
      const nextFilters: AutomationProjectionFilters =
        flowId === undefined
          ? {
              ...(currentFilters.archivedVisible !== undefined
                ? { archivedVisible: currentFilters.archivedVisible }
                : {}),
              ...(currentFilters.bucket !== undefined
                ? { bucket: currentFilters.bucket }
                : {}),
              ...(currentFilters.workspaceId !== undefined
                ? { workspaceId: currentFilters.workspaceId }
                : {}),
            }
          : {
              ...currentFilters,
              flowId,
            };

      await resolvedAutomationApi.updateFilters({ filters: nextFilters });
      await refreshProjection();
    },
    [projection?.filters, refreshProjection, resolvedAutomationApi],
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
      ref={automationCenterRef}
      style={
        {
          "--explorer-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      {viewModel === null ? (
        <section className="editor-pane automation-console-pane automation-console-pane--loading">
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
        </section>
      ) : (
        <>
          <WorkspaceFlowFilters
            onCreateFlow={() => {
              void openCreateEditor();
            }}
            onEditFlow={(flow) => {
              void openEditEditor(flow);
            }}
            onReturnToWorkspace={returnToWorkspace}
            onSelectFlow={(flowId) => {
              void selectFlowFilter(flowId);
            }}
            flows={projection?.flows ?? []}
            selectedFlowId={projection?.filters.flowId}
            taskStackCounts={{
              done: viewModel.doneTasks.length,
              needsMe: viewModel.needsMeTasks.length,
              ready: viewModel.readyTasks.length,
              running: viewModel.runningTasks.length,
            }}
            text={text}
            workspaceName={projection?.filters.workspaceId}
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
            }`}
          >
            <div
              className={`automation-console${
                editorState === null ? "" : " automation-console--editor-open"
              }`}
            >
              {editorState === null ? (
                <>
                  <SignalStack
                    onStartTask={(task) => {
                      void startTask(task.taskId);
                    }}
                    text={text}
                    viewModel={viewModel}
                  />
                  <QuietFlowline
                    onSubmitDecision={(decisionId, response) => {
                      void submitDecision(decisionId, response);
                    }}
                    text={text}
                    viewModel={viewModel}
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
                  setup={
                    editorState.mode === "create" ? editorState.setup : undefined
                  }
                  setupDiagnostics={
                    editorState.mode === "create"
                      ? editorState.diagnostics
                      : undefined
                  }
                  templates={
                    editorState.mode === "create" ? editorState.templates : undefined
                  }
                  text={text}
                  workspaceRoot={projection?.filters.workspaceId}
                />
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
};
