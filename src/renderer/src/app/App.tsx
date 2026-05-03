import {
  type CSSProperties,
  Fragment,
  type JSX,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ChevronLeft,
  ChevronRight,
  History,
  Pin,
  PinOff,
  Search,
  StretchHorizontal,
  X,
} from "lucide-react";

import type { AiApi, AiGenerationResult, AiTool } from "../../../shared/ai";
import {
  DOCUMENT_HISTORY_EVENT_LABEL_KEYS,
  DOCUMENT_HISTORY_FILTERS,
  type DeletedDocumentHistoryEntry,
  type DocumentHistoryEvent,
  type DocumentHistoryFilterId,
  type DocumentHistoryVersion,
} from "../../../shared/documentHistory";
import type {
  EditorApi,
  Workspace,
  WorkspaceLaunchResource,
  WorkspaceSearchResult,
} from "../../../shared/workspace";
import type {
  AvailableUpdate,
  UpdateApi,
  UpdateCheckResult,
  UpdateDownloadProgress,
} from "../../../shared/update";
import packageJson from "../../../../package.json";
import { appReducer, createInitialAppState } from "./appReducer";
import {
  MarkdownBlockEditor,
  type MarkdownBlockEditorHandle,
} from "../editor/MarkdownBlockEditor";
import {
  readEditorViewMode,
  writeEditorViewMode,
} from "../editor/editorViewMode";
import {
  EDITOR_LINE_SPACING_OPTIONS,
  readEditorLineSpacing,
  writeEditorLineSpacing,
} from "../editor/editorLineSpacing";
import {
  collectMarkdownFilePaths,
  resolveEditorLinkTarget,
} from "../editor/editorLinks";
import { getNextSearchMatchIndex } from "../search/editorSearch";
import {
  EDITOR_SEARCH_HISTORY_STORAGE_KEY,
  filterSearchHistory,
  getSearchShortcutLabel,
  isSearchQueryPinned,
  readSearchHistory,
  rememberSearchHistoryItem,
  togglePinnedSearchQuery,
  writeSearchHistory,
} from "../search/searchHistory";
import { ExplorerPane } from "../explorer/ExplorerPane";
import { UpdateDialog, type UpdateDialogStatus } from "./UpdateDialog";
import {
  disableSystemThemePreference,
  enableSystemThemePreference,
  readThemePreference,
  resolveThemePreference,
  selectAppTheme,
  writeThemePreference,
  type AppThemeFamily,
  type AppThemeId,
  type ThemePreference,
} from "../theme/appThemes";
import {
  forgetRecentWorkspace,
  readActiveWorkspace,
  readRecentWorkspaces,
  rememberWorkspace,
  type RecentWorkspace,
  writeActiveWorkspace,
  writeRecentWorkspaces,
} from "../workspaces/recentWorkspaces";
import {
  getWorkspaceLastOpenedFile,
  getWorkspaceRecentFiles,
  readWorkspaceFileHistory,
  rememberWorkspaceFile,
  removeWorkspaceFileHistoryEntry,
  renameWorkspaceFileHistoryEntry,
  type WorkspaceFileHistory,
  writeWorkspaceFileHistory,
} from "../workspaces/workspaceFileHistory";
import type { TreeNode } from "../../../shared/fileTree";
import {
  AiSummaryActionButton,
  AiTranslateActionMenu,
  type AiActionBusyState,
} from "../ai/AiActionMenu";
import { AiResultPanel } from "../ai/AiResultPanel";
import {
  forgetCustomAiTranslationLanguage,
  readCustomAiTranslationLanguages,
  rememberCustomAiTranslationLanguage,
} from "../ai/aiLanguages";
import {
  readAiCliSettings,
  resolveAiGenerationOptions,
  writeAiCliSettings,
  type AiCliSettings,
} from "../ai/aiSettings";
import {
  createAppLanguagePackEntries,
  createAppText,
  createCustomAppLanguagePack,
  getAppLanguagePack,
  getSelectableAppLanguagePacks,
  readAppLanguagePreference,
  readCustomAppLanguagePacks,
  writeAppLanguagePreference,
  writeCustomAppLanguagePacks,
  type AppText,
  type AppTextKey,
} from "../i18n/appLanguage";

declare global {
  interface Window {
    readonly aiApi?: AiApi;
    readonly editorApi?: EditorApi;
    readonly updateApi?: UpdateApi;
  }
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getHistoryEventLabel = (
  event: DocumentHistoryEvent,
  text: AppText,
): string => text(DOCUMENT_HISTORY_EVENT_LABEL_KEYS[event] as AppTextKey);

const formatHistoryTimestamp = (timestamp: string): string =>
  new Date(timestamp).toLocaleString();

const EDITOR_ACTION_VISIBLE_LIMIT = 5;
const EDITOR_ACTION_COLLAPSED_ITEM_COUNT = EDITOR_ACTION_VISIBLE_LIMIT - 1;

interface EditorActionItem {
  readonly element: JSX.Element;
  readonly id: string;
}

const HISTORY_FILTER_LABEL_KEYS = Object.fromEntries(
  DOCUMENT_HISTORY_FILTERS.map((filter) => [filter.id, filter.labelKey]),
) as Record<DocumentHistoryFilterId, AppTextKey>;

const filterHistoryVersions = (
  versions: readonly DocumentHistoryVersion[],
  filterId: DocumentHistoryFilterId,
): readonly DocumentHistoryVersion[] => {
  switch (filterId) {
    case "ai":
      return versions.filter((version) => version.event === "ai-write");
    case "delete":
      return versions.filter(
        (version) =>
          version.event === "delete" || version.event === "external-delete",
      );
    case "saves":
      return versions.filter(
        (version) =>
          version.event === "manual-save" ||
          version.event === "autosave" ||
          version.event === "restore",
      );
    case "all":
      return versions;
  }
};

const findNodeByPath = (
  nodes: readonly TreeNode[],
  targetPath: string,
): TreeNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }

    if (node.type === "directory") {
      const childNode = findNodeByPath(node.children, targetPath);

      if (childNode) {
        return childNode;
      }
    }
  }

  return null;
};

const findFileNodeByPath = (
  nodes: readonly TreeNode[],
  targetPath: string,
): TreeNode | null => {
  const node = findNodeByPath(nodes, targetPath);

  return node?.type === "file" ? node : null;
};

const hasDirectoryNode = (
  nodes: readonly TreeNode[],
  targetPath: string,
): boolean => findNodeByPath(nodes, targetPath)?.type === "directory";

const replaceDirectoryChildren = (
  nodes: readonly TreeNode[],
  targetPath: string,
  children: readonly TreeNode[],
): readonly TreeNode[] =>
  nodes.map((node) => {
    if (node.type !== "directory") {
      return node;
    }

    if (node.path === targetPath) {
      return {
        ...node,
        children,
      };
    }

    return {
      ...node,
      children: replaceDirectoryChildren(node.children, targetPath, children),
    };
  });

const getDirectoryDepth = (directoryPath: string): number =>
  directoryPath.split("/").filter((segment) => segment.length > 0).length;

const sortDirectoryPaths = (
  directoryPaths: readonly string[],
): readonly string[] =>
  Array.from(new Set(directoryPaths))
    .filter((directoryPath) => directoryPath.length > 0)
    .sort(
      (leftPath, rightPath) =>
        getDirectoryDepth(leftPath) - getDirectoryDepth(rightPath) ||
        leftPath.localeCompare(rightPath),
    );

const getParentPath = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1 ? "" : entryPath.slice(0, separatorIndex);
};

const joinWorkspacePath = (parentPath: string, entryName: string): string =>
  parentPath ? `${parentPath}/${entryName}` : entryName;

const ensureMarkdownExtension = (filePath: string): string =>
  filePath.toLowerCase().endsWith(".md") ? filePath : `${filePath}.md`;

const EXPLORER_WIDTH_DEFAULT = 288;
const EXPLORER_WIDTH_MIN = 220;
const EXPLORER_WIDTH_MAX = 440;
const AUTO_SAVE_IDLE_DELAY_MS = 5000;
const SYSTEM_DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const APP_VERSION = packageJson.version;

interface SaveCurrentFileOptions {
  readonly source?: "autosave" | "manual";
}
type ActiveAiActionBusyState = Exclude<AiActionBusyState, "idle">;

interface ScopedAiGenerationResult {
  readonly documentKey: string;
  readonly result: AiGenerationResult;
}

interface ScopedAiErrorMessage {
  readonly documentKey: string;
  readonly message: string;
}

interface EditorSearchState {
  readonly activeMatchIndex: number;
  readonly matchCount: number;
}

const clampExplorerWidth = (width: number): number =>
  Math.min(EXPLORER_WIDTH_MAX, Math.max(EXPLORER_WIDTH_MIN, Math.round(width)));

const createAiDocumentKey = (workspaceRoot: string, filePath: string): string =>
  `${workspaceRoot}\u0000${filePath}`;

const normalizeNativePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/").replace(/\/+$/u, "");

const getRelativeWorkspacePath = (
  resourcePath: string,
  workspaceRoot: string,
): string | null => {
  const normalizedResourcePath = normalizeNativePath(resourcePath);
  const normalizedWorkspaceRoot = normalizeNativePath(workspaceRoot);

  if (normalizedResourcePath === normalizedWorkspaceRoot) {
    return "";
  }

  if (!normalizedResourcePath.startsWith(`${normalizedWorkspaceRoot}/`)) {
    return null;
  }

  return normalizedResourcePath.slice(normalizedWorkspaceRoot.length + 1);
};

const getDroppedResourcePath = (
  event: ReactDragEvent<HTMLElement>,
): string | null => {
  const [firstFile] = Array.from(event.dataTransfer.files);
  const nativeFilePath = (
    firstFile as (File & { readonly path?: string }) | undefined
  )?.path;

  if (nativeFilePath) {
    return nativeFilePath;
  }

  const uriList = event.dataTransfer.getData("text/uri-list");
  const firstUri = uriList
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));

  if (!firstUri?.startsWith("file://")) {
    return null;
  }

  try {
    const url = new URL(firstUri);

    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
};

const removeAiDocumentEntry = <Value,>(
  entries: Readonly<Record<string, Value>>,
  documentKey: string,
): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(entries).filter(
      ([candidateKey]) => candidateKey !== documentKey,
    ),
  ) as Record<string, Value>;

const getWindowTitle = (
  workspace: Workspace | null,
  loadedFilePath?: string | null,
): string => {
  if (!workspace) {
    return "MDE";
  }

  const titleFilePath =
    loadedFilePath ??
    (workspace.type === "file"
      ? (workspace.openedFilePath ?? workspace.name)
      : null);

  if (titleFilePath) {
    return `${titleFilePath.split("/").at(-1) ?? titleFilePath} - ${workspace.rootPath}`;
  }

  return workspace.rootPath;
};

const createRecentWorkspace = (workspace: Workspace): RecentWorkspace =>
  workspace.type === "file" && workspace.filePath && workspace.openedFilePath
    ? {
        filePath: workspace.filePath,
        name: workspace.name,
        openedFilePath: workspace.openedFilePath,
        rootPath: workspace.rootPath,
        type: "file",
      }
    : {
        name: workspace.name,
        rootPath: workspace.rootPath,
        type: "workspace",
      };

const readSystemThemeFamily = (): AppThemeFamily => {
  try {
    return window.matchMedia?.(SYSTEM_DARK_COLOR_SCHEME_QUERY).matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
};

export const App = (): React.JSX.Element => {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    createInitialAppState,
  );
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_WIDTH_DEFAULT);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState(readEditorViewMode);
  const [editorLineSpacing, setEditorLineSpacing] = useState(
    readEditorLineSpacing,
  );
  const [isEditorLineSpacingMenuOpen, setIsEditorLineSpacingMenuOpen] =
    useState(false);
  const [isEditorActionsExpanded, setIsEditorActionsExpanded] =
    useState(false);
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [customAppLanguagePacks, setCustomAppLanguagePacks] = useState(
    readCustomAppLanguagePacks,
  );
  const [appLanguageId, setAppLanguageId] = useState(() =>
    readAppLanguagePreference(globalThis.localStorage),
  );
  const [systemThemeFamily, setSystemThemeFamily] = useState<AppThemeFamily>(
    readSystemThemeFamily,
  );
  const [isResizingExplorer, setIsResizingExplorer] = useState(false);
  const [hasResolvedInitialLaunchPath, setHasResolvedInitialLaunchPath] =
    useState(() => !window.editorApi);
  const [recentWorkspaces, setRecentWorkspaces] =
    useState(readRecentWorkspaces);
  const [workspaceFileHistory, setWorkspaceFileHistory] = useState(
    readWorkspaceFileHistory,
  );
  const [aiTools, setAiTools] = useState<readonly AiTool[]>([]);
  const [aiSettings, setAiSettings] = useState(() =>
    readAiCliSettings(globalThis.localStorage),
  );
  const [aiResult, setAiResult] = useState<ScopedAiGenerationResult | null>(
    null,
  );
  const [aiErrorMessage, setAiErrorMessage] =
    useState<ScopedAiErrorMessage | null>(null);
  const [aiBusyStatesByDocument, setAiBusyStatesByDocument] = useState<
    Record<string, ActiveAiActionBusyState>
  >({});
  const [isTranslateMenuOpen, setIsTranslateMenuOpen] = useState(false);
  const [customAiTranslationLanguages, setCustomAiTranslationLanguages] =
    useState(readCustomAiTranslationLanguages);
  const [
    customAiTranslationLanguageInput,
    setCustomAiTranslationLanguageInput,
  ] = useState("");
  const [isEditorSearchOpen, setIsEditorSearchOpen] = useState(false);
  const [editorSearchQuery, setEditorSearchQuery] = useState("");
  const [editorSearchHistory, setEditorSearchHistory] = useState(() =>
    readSearchHistory(EDITOR_SEARCH_HISTORY_STORAGE_KEY, globalThis.localStorage),
  );
  const [isEditorSearchHistoryOpen, setIsEditorSearchHistoryOpen] =
    useState(false);
  const [pinnedEditorSearchQueries, setPinnedEditorSearchQueries] = useState<
    readonly string[]
  >([]);
  const [editorSearchState, setEditorSearchState] = useState<EditorSearchState>(
    {
      activeMatchIndex: -1,
      matchCount: 0,
    },
  );
  const [availableUpdate, setAvailableUpdate] =
    useState<AvailableUpdate | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateDialogStatus | null>(
    null,
  );
  const [updateProgress, setUpdateProgress] =
    useState<UpdateDownloadProgress | null>(null);
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(
    null,
  );
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
  const appShellRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<MarkdownBlockEditorHandle | null>(null);
  const editorSearchShellRef = useRef<HTMLDivElement | null>(null);
  const editorSearchInputRef = useRef<HTMLInputElement | null>(null);
  const hasConsumedInitialLaunchPathRef = useRef(false);
  const appLanguagePack = useMemo(
    () => getAppLanguagePack(appLanguageId, customAppLanguagePacks),
    [appLanguageId, customAppLanguagePacks],
  );
  const selectableAppLanguagePacks = useMemo(
    () => getSelectableAppLanguagePacks(customAppLanguagePacks),
    [customAppLanguagePacks],
  );
  const text = useMemo(() => createAppText(appLanguagePack), [appLanguagePack]);
  const editorSearchShortcutLabel = useMemo(
    () => getSearchShortcutLabel("editor"),
    [],
  );
  const editorSearchButtonTitle = text("editor.markdownSearchWithShortcut", {
    shortcut: editorSearchShortcutLabel,
  });
  const visibleEditorSearchHistory = useMemo(
    () => filterSearchHistory(editorSearchHistory, editorSearchQuery),
    [editorSearchHistory, editorSearchQuery],
  );
  const unpinnedVisibleEditorSearchHistory = useMemo(
    () =>
      visibleEditorSearchHistory.filter(
        (historyItem) =>
          !isSearchQueryPinned(pinnedEditorSearchQueries, historyItem),
      ),
    [pinnedEditorSearchQueries, visibleEditorSearchHistory],
  );

  const rememberOpenedWorkspace = useCallback((workspace: Workspace): void => {
    writeActiveWorkspace(
      globalThis.localStorage,
      createRecentWorkspace(workspace),
    );
    setRecentWorkspaces((currentWorkspaces) => {
      const nextWorkspaces = rememberWorkspace(currentWorkspaces, workspace);

      writeRecentWorkspaces(globalThis.localStorage, nextWorkspaces);

      return nextWorkspaces;
    });
  }, []);

  const updateWorkspaceFileHistory = useCallback(
    (
      createNextHistory: (
        history: WorkspaceFileHistory,
      ) => WorkspaceFileHistory,
    ): void => {
      setWorkspaceFileHistory((currentHistory) => {
        const nextHistory = createNextHistory(currentHistory);

        writeWorkspaceFileHistory(nextHistory);

        return nextHistory;
      });
    },
    [],
  );

  const updateThemePreference = useCallback(
    (
      createNextPreference: (preference: ThemePreference) => ThemePreference,
    ): void => {
      setThemePreference((currentPreference) => {
        const nextPreference = createNextPreference(currentPreference);

        writeThemePreference(globalThis.localStorage, nextPreference);

        return nextPreference;
      });
    },
    [],
  );

  const updateAiSettings = useCallback((settings: AiCliSettings): void => {
    writeAiCliSettings(globalThis.localStorage, settings);
    setAiSettings(settings);
  }, []);

  const selectAppLanguage = useCallback((languageId: string): void => {
    writeAppLanguagePreference(globalThis.localStorage, languageId);
    setAppLanguageId(languageId);
  }, []);

  const clearAiResultState = useCallback((): void => {
    setAiResult(null);
    setAiErrorMessage(null);
    setAiBusyStatesByDocument({});
    setIsTranslateMenuOpen(false);
  }, []);

  const closeAiMenus = useCallback((): void => {
    setIsTranslateMenuOpen(false);
  }, []);

  const openEditorSearch = useCallback((query?: string): void => {
    if (query !== undefined) {
      setEditorSearchQuery(query);
      setEditorSearchState({
        activeMatchIndex: query.trim().length > 0 ? 0 : -1,
        matchCount: 0,
      });
    }

    setIsEditorSearchOpen(true);
    setIsEditorSearchHistoryOpen(false);
    window.setTimeout(() => {
      editorSearchInputRef.current?.focus();
      editorSearchInputRef.current?.select();
    }, 0);
  }, []);

  const closeEditorSearch = useCallback((): void => {
    setIsEditorSearchOpen(false);
    setIsEditorSearchHistoryOpen(false);
    setEditorSearchQuery("");
    setEditorSearchState({
      activeMatchIndex: -1,
      matchCount: 0,
    });
  }, []);

  const cycleEditorSearchMatch = useCallback((): void => {
    setEditorSearchState((currentState) => ({
      ...currentState,
      activeMatchIndex: getNextSearchMatchIndex(
        currentState.activeMatchIndex,
        currentState.matchCount,
      ),
    }));
  }, []);

  const rememberEditorSearchQuery = useCallback((query: string): void => {
    setEditorSearchHistory((currentHistory) => {
      const nextHistory = rememberSearchHistoryItem(currentHistory, query);

      writeSearchHistory(
        EDITOR_SEARCH_HISTORY_STORAGE_KEY,
        nextHistory,
        globalThis.localStorage,
      );

      return nextHistory;
    });
  }, []);

  const applyEditorSearchQuery = useCallback((query: string): void => {
    setEditorSearchQuery(query);
    setEditorSearchState({
      activeMatchIndex: query.trim().length > 0 ? 0 : -1,
      matchCount: 0,
    });
  }, []);

  const togglePinnedEditorSearchQuery = useCallback((query: string): void => {
    setPinnedEditorSearchQueries((currentQueries) =>
      togglePinnedSearchQuery(currentQueries, query),
    );
  }, []);

  const deletePinnedEditorSearchQuery = useCallback((query: string): void => {
    setPinnedEditorSearchQueries((currentQueries) =>
      currentQueries.filter(
        (pinnedQuery) =>
          pinnedQuery.trim().toLocaleLowerCase() !==
          query.trim().toLocaleLowerCase(),
      ),
    );
  }, []);

  const searchWorkspaceMarkdown = useCallback(
    async (query: string): Promise<WorkspaceSearchResult> => {
      const workspaceRoot = state.workspace?.rootPath;

      if (!workspaceRoot) {
        throw new Error(text("errors.openWorkspaceBeforeSearch"));
      }

      if (!window.editorApi?.searchWorkspaceMarkdown) {
        throw new Error(text("errors.workspaceSearchUnavailable"));
      }

      return window.editorApi.searchWorkspaceMarkdown(query, workspaceRoot);
    },
    [state.workspace?.rootPath, text],
  );

  const clearAiDocumentResult = useCallback((documentKey: string): void => {
    setAiResult((currentResult) =>
      currentResult?.documentKey === documentKey ? null : currentResult,
    );
  }, []);

  const clearAiDocumentError = useCallback((documentKey: string): void => {
    setAiErrorMessage((currentError) =>
      currentError?.documentKey === documentKey ? null : currentError,
    );
  }, []);

  const setAiDocumentBusyState = useCallback(
    (documentKey: string, busyState: ActiveAiActionBusyState): void => {
      setAiBusyStatesByDocument((currentStates) => ({
        ...currentStates,
        [documentKey]: busyState,
      }));
    },
    [],
  );

  const clearAiDocumentBusyState = useCallback((documentKey: string): void => {
    setAiBusyStatesByDocument((currentStates) =>
      removeAiDocumentEntry(currentStates, documentKey),
    );
  }, []);

  const rememberOpenedFile = useCallback(
    (workspaceRoot: string, filePath: string): void => {
      updateWorkspaceFileHistory((currentHistory) =>
        rememberWorkspaceFile(currentHistory, workspaceRoot, filePath),
      );
    },
    [updateWorkspaceFileHistory],
  );

  const completeWorkspaceOpen = useCallback(
    (workspace: Workspace): void => {
      clearAiResultState();
      closeEditorSearch();
      dispatch({ type: "workspace/opened", workspace });
      rememberOpenedWorkspace(workspace);
    },
    [clearAiResultState, closeEditorSearch, rememberOpenedWorkspace],
  );

  const loadFile = useCallback(
    async (filePath: string, expectedWorkspaceRoot?: string): Promise<void> => {
      const workspaceRoot = expectedWorkspaceRoot ?? state.workspace?.rootPath;

      if (!workspaceRoot) {
        dispatch({
          filePath,
          message: text("errors.openWorkspaceBeforeFiles"),
          type: "file/load-failed",
          workspaceRoot: "",
        });
        return;
      }

      closeAiMenus();
      dispatch({ type: "file/load-started", filePath, workspaceRoot });

      try {
        if (!window.editorApi) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        const file = await window.editorApi.readMarkdownFile(
          filePath,
          workspaceRoot,
        );

        dispatch({ type: "file/loaded", file, workspaceRoot });
        rememberOpenedFile(workspaceRoot, file.path);
      } catch (error) {
        dispatch({
          filePath,
          message: getErrorMessage(error, text("errors.readFileFailed")),
          type: "file/load-failed",
          workspaceRoot,
        });
      }
    },
    [closeAiMenus, rememberOpenedFile, state.workspace?.rootPath, text],
  );

  const openWorkspaceSearchResult = useCallback(
    (filePath: string, query: string): void => {
      openEditorSearch(query);
      void loadFile(filePath);
    },
    [loadFile, openEditorSearch],
  );

  const loadWorkspaceDefaultFile = useCallback(
    async (workspace: Workspace): Promise<void> => {
      if (workspace.type === "file" && workspace.openedFilePath) {
        await loadFile(workspace.openedFilePath, workspace.rootPath);
        return;
      }

      const lastOpenedFilePath = getWorkspaceLastOpenedFile(
        workspaceFileHistory,
        workspace.rootPath,
      );

      if (
        !lastOpenedFilePath ||
        !findFileNodeByPath(workspace.tree, lastOpenedFilePath)
      ) {
        return;
      }

      await loadFile(lastOpenedFilePath, workspace.rootPath);
    },
    [loadFile, workspaceFileHistory],
  );

  const updateExplorerWidthFromPointer = useCallback(
    (clientX: number): void => {
      const shellLeft = appShellRef.current?.getBoundingClientRect().left ?? 0;

      setExplorerWidth(clampExplorerWidth(clientX - shellLeft));
    },
    [],
  );

  useEffect(() => {
    document.title = getWindowTitle(state.workspace, state.loadedFile?.path);
  }, [state.loadedFile?.path, state.workspace]);

  useEffect(() => {
    document.documentElement.lang = appLanguagePack.locale;
  }, [appLanguagePack.locale]);

  useEffect(() => {
    const aiApi = window.aiApi;

    if (!aiApi) {
      return;
    }

    let isCancelled = false;

    void aiApi
      .detectTools()
      .then((result) => {
        if (!isCancelled) {
          setAiTools(result.tools);
        }
      })
      .catch((error: unknown) => {
        console.warn("MDE AI CLI detection failed", error);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const showAvailableUpdate = useCallback(
    (update: AvailableUpdate, status?: UpdateDialogStatus): void => {
      setAvailableUpdate(update);
      setUpdateErrorMessage(null);
      setUpdateProgress(null);
      setIsUpdateDismissed(false);
      setUpdateStatus(
        status ??
          (update.installMode === "restart-to-install"
            ? "downloading"
            : "available"),
      );
    },
    [],
  );

  useEffect(() => {
    let mediaQueryList: MediaQueryList;

    try {
      mediaQueryList = window.matchMedia(SYSTEM_DARK_COLOR_SCHEME_QUERY);
    } catch {
      return;
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
    const updateApi = window.updateApi;

    if (!updateApi) {
      return;
    }

    let isCancelled = false;

    const showUpdate = (
      update: AvailableUpdate,
      status?: UpdateDialogStatus,
    ): void => {
      if (isCancelled) {
        return;
      }

      showAvailableUpdate(update, status);
    };

    const unsubscribeProgress = updateApi.onUpdateDownloadProgress(
      (progress) => {
        if (isCancelled) {
          return;
        }

        setUpdateProgress(progress);
        setUpdateStatus("downloading");
      },
    );
    const unsubscribeAvailable = updateApi.onUpdateAvailable((update) => {
      showUpdate(update);
    });
    const unsubscribeReady = updateApi.onUpdateReady((update) => {
      showUpdate(update, "ready");
    });

    void updateApi
      .checkForUpdates()
      .then((result) => {
        if (result.updateAvailable && result.update) {
          showUpdate(result.update);
        }
      })
      .catch((error: unknown) => {
        console.warn("MDE update check failed", error);
      });

    return () => {
      isCancelled = true;
      unsubscribeProgress();
      unsubscribeAvailable();
      unsubscribeReady();
    };
  }, [showAvailableUpdate]);

  useEffect(() => {
    if (!isResizingExplorer) {
      return;
    }

    const updateWidth = (event: PointerEvent): void => {
      updateExplorerWidthFromPointer(event.clientX);
    };
    const stopResizing = (): void => {
      setIsResizingExplorer(false);
    };

    document.body.classList.add("is-resizing-explorer");
    window.addEventListener("pointermove", updateWidth);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.classList.remove("is-resizing-explorer");
      window.removeEventListener("pointermove", updateWidth);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingExplorer, updateExplorerWidthFromPointer]);

  const openWorkspace = async (): Promise<void> => {
    dispatch({ type: "workspace/open-started" });

    try {
      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      if (state.workspace && window.editorApi.openWorkspaceInNewWindow) {
        const didOpen = await window.editorApi.openWorkspaceInNewWindow();

        dispatch({ type: "workspace/open-cancelled" });

        if (!didOpen) {
          return;
        }

        return;
      }

      const workspace = await window.editorApi.openWorkspace();

      if (!workspace) {
        dispatch({ type: "workspace/open-cancelled" });
        return;
      }

      completeWorkspaceOpen(workspace);
      await loadWorkspaceDefaultFile(workspace);
    } catch (error) {
      dispatch({
        type: "workspace/open-failed",
        message: getErrorMessage(error, text("errors.openWorkspaceFailed")),
      });
    }
  };

  const openFile = async (): Promise<void> => {
    dispatch({ type: "workspace/open-started" });

    try {
      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      if (state.workspace && window.editorApi.openFileInNewWindow) {
        const didOpen = await window.editorApi.openFileInNewWindow();

        dispatch({ type: "workspace/open-cancelled" });

        if (!didOpen) {
          return;
        }

        return;
      }

      const workspace = await window.editorApi.openFile();

      if (!workspace) {
        dispatch({ type: "workspace/open-cancelled" });
        return;
      }

      completeWorkspaceOpen(workspace);
      await loadWorkspaceDefaultFile(workspace);
    } catch (error) {
      dispatch({
        type: "workspace/open-failed",
        message: getErrorMessage(error, text("errors.openFileFailed")),
      });
    }
  };

  const openWorkspaceInNewWindow = useCallback(
    async (workspace: RecentWorkspace): Promise<void> => {
      try {
        if (!window.editorApi?.openPathInNewWindow) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        await window.editorApi.openPathInNewWindow(
          workspace.type === "file" ? workspace.filePath : workspace.rootPath,
        );
      } catch (error) {
        dispatch({
          type: "workspace/operation-failed",
          workspaceRoot: state.workspace?.rootPath ?? "",
          message: getErrorMessage(
            error,
            text("errors.openWorkspaceInNewWindowFailed"),
          ),
        });
      }
    },
    [state.workspace?.rootPath, text],
  );

  const switchWorkspace = useCallback(
    async (workspace: RecentWorkspace): Promise<void> => {
      dispatch({ type: "workspace/open-started" });

      try {
        if (!window.editorApi) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        const openedWorkspace =
          workspace.type === "file"
            ? await window.editorApi.openFileByPath(workspace.filePath)
            : await window.editorApi.openWorkspaceByPath(workspace.rootPath);

        completeWorkspaceOpen(openedWorkspace);
        await loadWorkspaceDefaultFile(openedWorkspace);
      } catch (error) {
        dispatch({
          type: "workspace/open-failed",
          message: getErrorMessage(error, text("errors.switchWorkspaceFailed")),
        });
      }
    },
    [completeWorkspaceOpen, loadWorkspaceDefaultFile, text],
  );

  const openPath = useCallback(
    async (resourcePath: WorkspaceLaunchResource): Promise<void> => {
      dispatch({ type: "workspace/open-started" });

      try {
        if (!window.editorApi) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        const workspace =
          typeof resourcePath === "string"
            ? await window.editorApi.openPath(resourcePath)
            : await window.editorApi.openWorkspaceByPath(
                resourcePath.workspaceRoot,
              );

        completeWorkspaceOpen(workspace);
        if (typeof resourcePath === "string") {
          await loadWorkspaceDefaultFile(workspace);
        } else {
          await loadFile(resourcePath.filePath, workspace.rootPath);
        }
      } catch (error) {
        dispatch({
          message: getErrorMessage(error, text("errors.openLaunchPathFailed")),
          type: "workspace/open-failed",
        });
      }
    },
    [completeWorkspaceOpen, loadFile, loadWorkspaceDefaultFile, text],
  );

  useEffect(() => {
    const editorApi = window.editorApi;

    if (!editorApi || hasConsumedInitialLaunchPathRef.current) {
      return;
    }

    let isCancelled = false;

    hasConsumedInitialLaunchPathRef.current = true;
    void editorApi.consumeLaunchPath().then((resourcePath) => {
      if (isCancelled) {
        return;
      }

      if (resourcePath) {
        void openPath(resourcePath).finally(() => {
          if (!isCancelled) {
            setHasResolvedInitialLaunchPath(true);
          }
        });
        return;
      }

      const activeWorkspace = readActiveWorkspace(globalThis.localStorage);

      if (activeWorkspace) {
        void switchWorkspace(activeWorkspace).finally(() => {
          if (!isCancelled) {
            setHasResolvedInitialLaunchPath(true);
          }
        });
        return;
      }

      setHasResolvedInitialLaunchPath(true);
    });

    const unsubscribe = editorApi.onLaunchPath((resourcePath) => {
      void openPath(resourcePath);
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [openPath, switchWorkspace]);

  const forgetWorkspace = (workspace: RecentWorkspace): void => {
    setRecentWorkspaces((currentWorkspaces) => {
      const nextWorkspaces = forgetRecentWorkspace(
        currentWorkspaces,
        workspace,
      );

      writeRecentWorkspaces(globalThis.localStorage, nextWorkspaces);

      return nextWorkspaces;
    });
  };

  const refreshWorkspaceTree = useCallback(
    async (
      workspaceRoot?: string,
      directoryPaths: readonly string[] = [],
    ): Promise<void> => {
      const scopedWorkspaceRoot = workspaceRoot ?? state.workspace?.rootPath;

      if (!scopedWorkspaceRoot) {
        return;
      }

      try {
        if (!window.editorApi) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        let tree = await window.editorApi.listDirectory("");

        for (const directoryPath of sortDirectoryPaths(directoryPaths)) {
          if (!hasDirectoryNode(tree, directoryPath)) {
            continue;
          }

          tree = replaceDirectoryChildren(
            tree,
            directoryPath,
            await window.editorApi.listDirectory(directoryPath),
          );
        }

        dispatch({
          tree,
          type: "workspace/tree-refreshed",
          workspaceRoot: scopedWorkspaceRoot,
        });
      } catch (error) {
        dispatch({
          message: getErrorMessage(
            error,
            text("errors.refreshWorkspaceFailed"),
          ),
          type: "workspace/operation-failed",
          workspaceRoot: scopedWorkspaceRoot,
        });
      }
    },
    [state.workspace?.rootPath, text],
  );

  const openDroppedPath = useCallback(
    async (resourcePath: string): Promise<void> => {
      const workspaceRoot = state.workspace?.rootPath ?? null;
      const relativeWorkspacePath = workspaceRoot
        ? getRelativeWorkspacePath(resourcePath, workspaceRoot)
        : null;

      if (
        workspaceRoot &&
        relativeWorkspacePath?.toLowerCase().endsWith(".md")
      ) {
        await loadFile(relativeWorkspacePath, workspaceRoot);
        return;
      }

      if (workspaceRoot && relativeWorkspacePath !== null) {
        await refreshWorkspaceTree(workspaceRoot);
        return;
      }

      if (workspaceRoot && window.editorApi?.openPathInNewWindow) {
        await window.editorApi.openPathInNewWindow(resourcePath);
        return;
      }

      await openPath(resourcePath);
    },
    [loadFile, openPath, refreshWorkspaceTree, state.workspace?.rootPath],
  );

  const openEditorLink = useCallback(
    async (href: string): Promise<void> => {
      const workspaceRoot = state.workspace?.rootPath;
      const currentFilePath = state.loadedFile?.path;

      if (!workspaceRoot || !currentFilePath) {
        return;
      }

      const target = resolveEditorLinkTarget({
        currentFilePath,
        currentWorkspaceRoot: workspaceRoot,
        href,
        recentWorkspaces,
      });

      switch (target.kind) {
        case "external":
          if (!window.editorApi?.openExternalLink) {
            throw new Error(text("errors.editorApiUnavailable"));
          }

          await window.editorApi.openExternalLink(target.url);
          return;
        case "workspace-file":
          await loadFile(target.filePath, workspaceRoot);
          return;
        case "workspace-file-new-window":
          if (window.editorApi?.openWorkspaceFileInNewWindow) {
            await window.editorApi.openWorkspaceFileInNewWindow(
              target.workspaceRoot,
              target.filePath,
            );
            return;
          }

          await window.editorApi?.openPathInNewWindow?.(
            `${target.workspaceRoot}/${target.filePath}`,
          );
          return;
        case "new-window-path":
          await window.editorApi?.openPathInNewWindow?.(target.resourcePath);
          return;
        case "none":
          return;
      }
    },
    [
      loadFile,
      recentWorkspaces,
      state.loadedFile?.path,
      state.workspace?.rootPath,
      text,
    ],
  );

  const saveCurrentFile = useCallback(
    async (
      serializedMarkdown?: string,
      options: SaveCurrentFileOptions = {},
    ): Promise<void> => {
      const loadedFile = state.loadedFile;
      const workspaceRoot = state.workspace?.rootPath;

      if (!loadedFile || !workspaceRoot) {
        return;
      }

      try {
        if (!window.editorApi) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        const contents =
          serializedMarkdown ??
          state.draftMarkdown ??
          (await editorRef.current?.getMarkdown()) ??
          loadedFile.contents;

        if (
          options.source === "autosave" &&
          loadedFile.contents.trim().length > 0 &&
          contents.trim().length === 0 &&
          !window.confirm(text("history.emptyAutosaveConfirm"))
        ) {
          dispatch({
            contents: loadedFile.contents,
            filePath: loadedFile.path,
            type: "file/content-restored",
            workspaceRoot,
          });

          return;
        }

        dispatch({
          filePath: loadedFile.path,
          type: "file/save-started",
          workspaceRoot,
        });

        await window.editorApi.writeMarkdownFile(
          loadedFile.path,
          contents,
          workspaceRoot,
        );
        dispatch({
          contents,
          filePath: loadedFile.path,
          type: "file/save-succeeded",
          workspaceRoot,
        });
      } catch (error) {
        dispatch({
          filePath: loadedFile.path,
          message: getErrorMessage(error, text("errors.saveFileFailed")),
          type: "file/save-failed",
          workspaceRoot,
        });
      }
    },
    [state.draftMarkdown, state.loadedFile, state.workspace?.rootPath, text],
  );

  const openDeletedDocumentHistory = useCallback(async (): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath;

    if (!workspaceRoot) {
      return;
    }

    try {
      if (!window.editorApi?.listDeletedDocumentHistory) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      const documents =
        await window.editorApi.listDeletedDocumentHistory(workspaceRoot);

      dispatch({
        documents,
        type: "history/deleted-documents-loaded",
        workspaceRoot,
      });
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, text("errors.openHistoryFailed")),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  }, [state.workspace?.rootPath, text]);

  const setDeletedDocumentHistoryVisible = useCallback(
    async (isVisible: boolean): Promise<void> => {
      const workspaceRoot = state.workspace?.rootPath;

      if (!workspaceRoot) {
        return;
      }

      if (isVisible) {
        await openDeletedDocumentHistory();
        return;
      }

      dispatch({
        isVisible: false,
        type: "history/deleted-documents-visibility-set",
        workspaceRoot,
      });
    },
    [openDeletedDocumentHistory, state.workspace?.rootPath],
  );

  const loadDocumentHistoryVersions = useCallback(
    async (
      filePath: string,
      workspaceRoot: string,
    ): Promise<readonly DocumentHistoryVersion[]> => {
      if (!window.editorApi?.listDocumentHistory) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      const versions = await window.editorApi.listDocumentHistory(
        filePath,
        workspaceRoot,
      );

      dispatch({
        type: "history/versions-loaded",
        versions,
        workspaceRoot,
      });

      return versions;
    },
    [text],
  );

  const previewHistoryVersion = useCallback(
    async (
      versionId: string,
      mode: "current-file" | "deleted-document",
      deletedDocument?: DeletedDocumentHistoryEntry,
    ): Promise<void> => {
      const workspaceRoot = state.workspace?.rootPath;

      if (!workspaceRoot) {
        return;
      }

      try {
        if (!window.editorApi?.readDocumentHistoryVersion) {
          throw new Error(text("errors.editorApiUnavailable"));
        }

        const preview = await window.editorApi.readDocumentHistoryVersion(
          versionId,
          workspaceRoot,
        );

        dispatch({
          contents: preview.contents,
          deletedDocument,
          mode,
          type: "history/preview-loaded",
          version: preview.version,
          workspaceRoot,
        });
      } catch (error) {
        dispatch({
          message: getErrorMessage(error, text("errors.openHistoryFailed")),
          type: "workspace/operation-failed",
          workspaceRoot,
        });
      }
    },
    [state.workspace?.rootPath, text],
  );

  const previewDeletedDocumentHistoryEntry = useCallback(
    (entry: DeletedDocumentHistoryEntry): void => {
      const workspaceRoot = state.workspace?.rootPath;

      if (!workspaceRoot) {
        return;
      }

      void loadDocumentHistoryVersions(entry.path, workspaceRoot)
        .then(() =>
          previewHistoryVersion(
            entry.latestVersionId,
            "deleted-document",
            entry,
          ),
        )
        .catch((error) => {
          dispatch({
            message: getErrorMessage(error, text("errors.openHistoryFailed")),
            type: "workspace/operation-failed",
            workspaceRoot,
          });
        });
    },
    [
      loadDocumentHistoryVersions,
      previewHistoryVersion,
      state.workspace?.rootPath,
      text,
    ],
  );

  const toggleVersionHistory = useCallback(async (): Promise<void> => {
    const loadedFile = state.loadedFile;
    const historyPreview = state.historyPreview ?? null;
    const workspaceRoot = state.workspace?.rootPath;

    if (!workspaceRoot) {
      return;
    }

    if (state.isDocumentHistoryPanelVisible) {
      dispatch({
        isVisible: false,
        type: "history/panel-visibility-set",
        workspaceRoot,
      });
      if (historyPreview?.mode === "deleted-document") {
        await setDeletedDocumentHistoryVisible(false);
      }
      return;
    }

    const historyPath =
      historyPreview?.deletedDocument?.path ??
      historyPreview?.version.path ??
      loadedFile?.path;

    if (!historyPath) {
      return;
    }

    try {
      if (historyPreview?.mode === "deleted-document") {
        await setDeletedDocumentHistoryVisible(true);
      }
      await loadDocumentHistoryVersions(historyPath, workspaceRoot);
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, text("errors.openHistoryFailed")),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  }, [
    loadDocumentHistoryVersions,
    setDeletedDocumentHistoryVisible,
    state.historyPreview,
    state.isDocumentHistoryPanelVisible,
    state.loadedFile,
    state.workspace?.rootPath,
    text,
  ]);

  const closeHistoryPreview = useCallback((): void => {
    const workspaceRoot = state.workspace?.rootPath;

    if (!workspaceRoot) {
      return;
    }

    dispatch({ type: "history/preview-closed", workspaceRoot });
  }, [state.workspace?.rootPath]);

  const restoreHistoryPreview = useCallback(async (): Promise<void> => {
    const historyPreview = state.historyPreview;
    const workspaceRoot = state.workspace?.rootPath;

    if (!historyPreview || !workspaceRoot) {
      return;
    }

    try {
      const restoreVersion =
        historyPreview.mode === "deleted-document"
          ? window.editorApi?.restoreDeletedDocumentHistoryVersion
          : window.editorApi?.restoreDocumentHistoryVersion;

      if (!restoreVersion) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      const file = await restoreVersion(historyPreview.version.id, workspaceRoot);

      dispatch({ type: "history/preview-closed", workspaceRoot });
      await refreshWorkspaceTree(workspaceRoot, [getParentPath(file.path)]);
      await openDeletedDocumentHistory();
      await loadFile(file.path);
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, text("errors.restoreHistoryFailed")),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  }, [
    loadFile,
    openDeletedDocumentHistory,
    refreshWorkspaceTree,
    state.historyPreview,
    state.workspace?.rootPath,
    text,
  ]);

  const uploadImageAsset = useCallback(
    async (file: File): Promise<string> => {
      const loadedFilePath = state.loadedFile?.path;
      const workspaceRoot = state.workspace?.rootPath;

      if (!loadedFilePath || !workspaceRoot) {
        throw new Error(text("errors.openMarkdownBeforeImagePaste"));
      }

      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      const result = await window.editorApi.saveImageAsset(
        loadedFilePath,
        file.name,
        file.type,
        await file.arrayBuffer(),
        workspaceRoot,
      );

      await refreshWorkspaceTree(workspaceRoot);

      return result.fileUrl;
    },
    [
      refreshWorkspaceTree,
      state.loadedFile?.path,
      state.workspace?.rootPath,
      text,
    ],
  );

  const getLatestMarkdownForAi = useCallback(async (): Promise<string> => {
    const loadedFile = state.loadedFile;

    if (!loadedFile) {
      throw new Error(text("errors.openMarkdownBeforeAi"));
    }

    const contents =
      (await editorRef.current?.getMarkdown()) ??
      state.draftMarkdown ??
      loadedFile.contents;

    if (contents !== loadedFile.contents) {
      await saveCurrentFile(contents);
    }

    return contents;
  }, [saveCurrentFile, state.draftMarkdown, state.loadedFile, text]);

  const summarizeMarkdown = useCallback(
    async (instruction?: string): Promise<void> => {
      const aiApi = window.aiApi;
      const loadedFile = state.loadedFile;
      const workspaceRoot = state.workspace?.rootPath;

      if (!aiApi || !loadedFile || !workspaceRoot) {
        return;
      }

      const documentKey = createAiDocumentKey(workspaceRoot, loadedFile.path);
      const trimmedInstruction = instruction?.trim();
      const normalizedInstruction =
        trimmedInstruction && trimmedInstruction.length > 0
          ? trimmedInstruction
          : undefined;

      setAiDocumentBusyState(
        documentKey,
        normalizedInstruction ? "refining-summary" : "summarizing",
      );
      clearAiDocumentError(documentKey);

      if (!normalizedInstruction) {
        clearAiDocumentResult(documentKey);
      }

      try {
        const markdown = await getLatestMarkdownForAi();
        const generationOptions = resolveAiGenerationOptions(
          aiSettings,
          aiTools,
        );
        const result = await aiApi.summarizeMarkdown(
          loadedFile.path,
          markdown,
          workspaceRoot,
          normalizedInstruction,
          generationOptions,
        );

        setAiResult({ documentKey, result });
      } catch (error) {
        setAiErrorMessage({
          documentKey,
          message: getErrorMessage(
            error,
            text("errors.summarizeMarkdownFailed"),
          ),
        });
      } finally {
        clearAiDocumentBusyState(documentKey);
      }
    },
    [
      clearAiDocumentBusyState,
      clearAiDocumentError,
      clearAiDocumentResult,
      getLatestMarkdownForAi,
      aiSettings,
      aiTools,
      setAiDocumentBusyState,
      state.loadedFile,
      state.workspace?.rootPath,
      text,
    ],
  );

  const translateMarkdown = useCallback(
    async (language: string): Promise<void> => {
      const aiApi = window.aiApi;
      const loadedFile = state.loadedFile;
      const workspaceRoot = state.workspace?.rootPath;

      if (!aiApi || !loadedFile || !workspaceRoot) {
        return;
      }

      const documentKey = createAiDocumentKey(workspaceRoot, loadedFile.path);

      setIsTranslateMenuOpen(false);
      setAiDocumentBusyState(documentKey, "translating");
      clearAiDocumentError(documentKey);
      clearAiDocumentResult(documentKey);

      try {
        const markdown = await getLatestMarkdownForAi();
        const generationOptions = resolveAiGenerationOptions(
          aiSettings,
          aiTools,
        );
        const result = await aiApi.translateMarkdown(
          loadedFile.path,
          markdown,
          language,
          workspaceRoot,
          generationOptions,
        );

        setAiResult({ documentKey, result });
      } catch (error) {
        setAiErrorMessage({
          documentKey,
          message: getErrorMessage(
            error,
            text("errors.translateMarkdownFailed"),
          ),
        });
      } finally {
        clearAiDocumentBusyState(documentKey);
      }
    },
    [
      clearAiDocumentBusyState,
      clearAiDocumentError,
      clearAiDocumentResult,
      getLatestMarkdownForAi,
      aiSettings,
      aiTools,
      setAiDocumentBusyState,
      state.loadedFile,
      state.workspace?.rootPath,
      text,
    ],
  );

  const rememberCustomTranslationLanguage = useCallback((): void => {
    setCustomAiTranslationLanguages((currentLanguages) => {
      const nextLanguages = rememberCustomAiTranslationLanguage(
        globalThis.localStorage,
        currentLanguages,
        customAiTranslationLanguageInput,
      );

      return nextLanguages;
    });
    setCustomAiTranslationLanguageInput("");
  }, [customAiTranslationLanguageInput]);

  const forgetCustomTranslationLanguage = useCallback(
    (language: string): void => {
      setCustomAiTranslationLanguages((currentLanguages) =>
        forgetCustomAiTranslationLanguage(
          globalThis.localStorage,
          currentLanguages,
          language,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const loadedFilePath = state.loadedFile?.path;
    const workspaceRoot = state.workspace?.rootPath;

    if (
      !state.isDirty ||
      state.isSavingFile ||
      !loadedFilePath ||
      !workspaceRoot
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentFile(state.draftMarkdown ?? undefined, {
        source: "autosave",
      });
    }, AUTO_SAVE_IDLE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    saveCurrentFile,
    state.draftMarkdown,
    state.isDirty,
    state.isSavingFile,
    state.loadedFile?.path,
    state.workspace?.rootPath,
  ]);

  useEffect(() => {
    const saveOnShortcut = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }

      event.preventDefault();
      void saveCurrentFile();
    };

    window.addEventListener("keydown", saveOnShortcut);

    return () => {
      window.removeEventListener("keydown", saveOnShortcut);
    };
  }, [saveCurrentFile]);

  useEffect(() => {
    const openSearchOnShortcut = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "f"
      ) {
        return;
      }

      event.preventDefault();

      if (event.shiftKey) {
        window.dispatchEvent(new CustomEvent("mde:open-workspace-search"));
        return;
      }

      if (state.loadedFile) {
        openEditorSearch();
      }
    };

    window.addEventListener("keydown", openSearchOnShortcut);

    return () => {
      window.removeEventListener("keydown", openSearchOnShortcut);
    };
  }, [openEditorSearch, state.loadedFile]);

  const createMarkdownFile = useCallback(async (promptedPath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath;
    const filePath = ensureMarkdownExtension(promptedPath);

    if (!workspaceRoot) {
      return;
    }

    try {
      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      await window.editorApi.createMarkdownFile(filePath, workspaceRoot);
      await refreshWorkspaceTree(workspaceRoot);
      await loadFile(filePath, workspaceRoot);
    } catch (error) {
      dispatch({
        message: getErrorMessage(
          error,
          text("errors.createMarkdownFileFailed"),
        ),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  }, [loadFile, refreshWorkspaceTree, state.workspace?.rootPath, text]);

  const createMarkdownFileFromEditorLink = useCallback(
    async (promptedPath: string): Promise<string> => {
      const workspaceRoot = state.workspace?.rootPath;
      const filePath = ensureMarkdownExtension(promptedPath);

      if (!workspaceRoot) {
        throw new Error(text("errors.openWorkspaceBeforeFiles"));
      }

      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      await window.editorApi.createMarkdownFile(filePath, workspaceRoot);
      await refreshWorkspaceTree(workspaceRoot);

      return filePath;
    },
    [refreshWorkspaceTree, state.workspace?.rootPath, text],
  );

  const createFolder = async (folderPath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath;

    if (!workspaceRoot) {
      return;
    }

    try {
      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      await window.editorApi.createFolder(folderPath, workspaceRoot);
      await refreshWorkspaceTree(workspaceRoot);
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, text("errors.createFolderFailed")),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  };

  const renameSelectedEntry = async (promptedName: string): Promise<void> => {
    const selectedEntryPath = state.selectedEntryPath;
    const workspaceRoot = state.workspace?.rootPath;

    if (!selectedEntryPath || !state.workspace || !workspaceRoot) {
      return;
    }

    const selectedNode = findNodeByPath(
      state.workspace.tree,
      selectedEntryPath,
    );
    const parentPath = getParentPath(selectedEntryPath);
    const nextEntryName =
      selectedNode?.type === "file"
        ? ensureMarkdownExtension(promptedName)
        : promptedName;
    const nextEntryPath = joinWorkspacePath(parentPath, nextEntryName);

    if (nextEntryPath === selectedEntryPath) {
      return;
    }

    try {
      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      const result = await window.editorApi.renameEntry(
        selectedEntryPath,
        nextEntryPath,
        workspaceRoot,
      );

      dispatch({
        newPath: result.path,
        oldPath: selectedEntryPath,
        type: "file/entry-renamed",
        workspaceRoot,
      });
      updateWorkspaceFileHistory((currentHistory) =>
        renameWorkspaceFileHistoryEntry(
          currentHistory,
          workspaceRoot,
          selectedEntryPath,
          result.path,
        ),
      );
      await refreshWorkspaceTree(workspaceRoot);
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, text("errors.renameEntryFailed")),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  };

  const deleteSelectedEntry = async (): Promise<void> => {
    const selectedEntryPath = state.selectedEntryPath;
    const workspaceRoot = state.workspace?.rootPath;

    if (!selectedEntryPath || !workspaceRoot) {
      return;
    }

    try {
      if (!window.editorApi) {
        throw new Error(text("errors.editorApiUnavailable"));
      }

      await window.editorApi.deleteEntry(selectedEntryPath, workspaceRoot);
      dispatch({
        entryPath: selectedEntryPath,
        type: "file/entry-deleted",
        workspaceRoot,
      });
      updateWorkspaceFileHistory((currentHistory) =>
        removeWorkspaceFileHistoryEntry(
          currentHistory,
          workspaceRoot,
          selectedEntryPath,
        ),
      );
      await refreshWorkspaceTree(workspaceRoot);
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, text("errors.deleteEntryFailed")),
        type: "workspace/operation-failed",
        workspaceRoot,
      });
    }
  };

  const beginExplorerResize = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    updateExplorerWidthFromPointer(event.clientX);
    setIsResizingExplorer(true);
  };

  const handleAppDragOver = (event: ReactDragEvent<HTMLElement>): void => {
    const hasFileTransfer =
      event.dataTransfer.files.length > 0 ||
      Array.from(event.dataTransfer.types).includes("Files");

    if (!hasFileTransfer) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleAppDrop = (event: ReactDragEvent<HTMLElement>): void => {
    const resourcePath = getDroppedResourcePath(event);

    if (!resourcePath) {
      return;
    }

    event.preventDefault();
    void openDroppedPath(resourcePath).catch((error) => {
      dispatch({
        message: getErrorMessage(error, text("errors.openDroppedPathFailed")),
        type: "workspace/open-failed",
      });
    });
  };

  const resizeExplorerFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setExplorerWidth((currentWidth) => clampExplorerWidth(currentWidth - 16));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setExplorerWidth((currentWidth) => clampExplorerWidth(currentWidth + 16));
    } else if (event.key === "Home") {
      event.preventDefault();
      setExplorerWidth(EXPLORER_WIDTH_MIN);
    } else if (event.key === "End") {
      event.preventDefault();
      setExplorerWidth(EXPLORER_WIDTH_MAX);
    }
  };

  const checkForUpdatesFromSettings =
    useCallback(async (): Promise<UpdateCheckResult> => {
      const updateApi = window.updateApi;

      if (!updateApi) {
        return {
          currentVersion: APP_VERSION,
          message: text("settings.updatesUnavailable"),
          updateAvailable: false,
        };
      }

      const result = await updateApi.checkForUpdates();

      if (result.updateAvailable && result.update) {
        showAvailableUpdate(result.update);
      }

      return result;
    }, [showAvailableUpdate, text]);

  const generateAppLanguagePack = useCallback(
    async (language: string): Promise<void> => {
      const aiApi = window.aiApi;

      if (!aiApi?.generateAppLanguagePack) {
        throw new Error(text("errors.aiCliUnavailable"));
      }

      const languagePack = getAppLanguagePack(
        appLanguageId,
        customAppLanguagePacks,
      );
      const generationOptions = resolveAiGenerationOptions(aiSettings, aiTools);
      const result = await aiApi.generateAppLanguagePack(
        language,
        createAppLanguagePackEntries(languagePack),
        generationOptions,
      );
      const customLanguagePack = createCustomAppLanguagePack(
        language,
        result.entries,
      );

      setCustomAppLanguagePacks((currentPacks) => {
        const nextPacks = [
          ...currentPacks.filter((pack) => pack.id !== customLanguagePack.id),
          customLanguagePack,
        ];

        writeCustomAppLanguagePacks(globalThis.localStorage, nextPacks);

        return nextPacks;
      });
      selectAppLanguage(customLanguagePack.id);
    },
    [
      aiSettings,
      aiTools,
      appLanguageId,
      customAppLanguagePacks,
      selectAppLanguage,
      text,
    ],
  );

  const installUpdate = async (): Promise<void> => {
    const updateApi = window.updateApi;

    if (!updateApi || !availableUpdate) {
      return;
    }

    setUpdateErrorMessage(null);

    try {
      if (availableUpdate.installMode === "open-dmg") {
        setUpdateStatus("downloading");
        await updateApi.downloadAndOpenUpdate();
        setUpdateStatus("ready");
        setUpdateProgress({
          downloadedBytes: availableUpdate.assetSize ?? 0,
          percent: 100,
          totalBytes: availableUpdate.assetSize ?? null,
        });
        return;
      }

      await updateApi.installWindowsUpdate();
    } catch (error) {
      setUpdateStatus("failed");
      setUpdateErrorMessage(
        getErrorMessage(error, text("errors.installUpdateFailed")),
      );
    }
  };

  const dismissUpdate = (): void => {
    setIsUpdateDismissed(true);
    setUpdateStatus(null);
  };

  const appShellStyle: CSSProperties & Record<"--explorer-width", string> = {
    "--explorer-width": `${explorerWidth}px`,
  };
  const isEditorFullWidth = editorViewMode === "full-width";
  const resolvedTheme = resolveThemePreference(
    themePreference,
    systemThemeFamily,
  );
  const editorViewToggleLabel = isEditorFullWidth
    ? text("editor.useCenteredView")
    : text("editor.useFullWidthView");
  const editorLineSpacingLabel = text("editor.lineSpacing");
  const currentAiDocumentKey =
    state.workspace && state.loadedFile
      ? createAiDocumentKey(state.workspace.rootPath, state.loadedFile.path)
      : null;
  const currentAiBusyState: AiActionBusyState = currentAiDocumentKey
    ? (aiBusyStatesByDocument[currentAiDocumentKey] ?? "idle")
    : "idle";
  const currentAiResult =
    currentAiDocumentKey && aiResult?.documentKey === currentAiDocumentKey
      ? aiResult.result
      : null;
  const currentAiErrorMessage =
    currentAiDocumentKey && aiErrorMessage?.documentKey === currentAiDocumentKey
      ? aiErrorMessage.message
      : null;
  const shouldShowAiActions = aiTools.length > 0 && Boolean(state.loadedFile);
  const recentFilePaths = state.workspace
    ? getWorkspaceRecentFiles(workspaceFileHistory, state.workspace.rootPath)
    : [];
  const historyPreview = state.historyPreview ?? null;
  const editorFilePath =
    historyPreview?.deletedDocument?.path ??
    historyPreview?.version.path ??
    state.loadedFile?.path ??
    "";
  const editorMarkdown =
    historyPreview?.contents ??
    state.draftMarkdown ??
    state.loadedFile?.contents ??
    "";
  const repairedImageAssetCount =
    !historyPreview && state.loadedFile?.repairedImageAssetCount
      ? state.loadedFile.repairedImageAssetCount
      : 0;
  const imageAssetRepairNotice =
    repairedImageAssetCount > 1
      ? text("editor.imageAssetRepairMany", { count: repairedImageAssetCount })
      : repairedImageAssetCount === 1
        ? text("editor.imageAssetRepairOne")
        : null;
  const historyPreviewDisplay = historyPreview
    ? {
        createdAtLabel: formatHistoryTimestamp(historyPreview.version.createdAt),
        eventLabel: getHistoryEventLabel(historyPreview.version.event, text),
        sourcePath: historyPreview.deletedDocument?.path ?? historyPreview.version.path,
      }
    : null;
  const canShowEditorDocumentActions = Boolean(state.loadedFile ?? historyPreview);
  const expandEditorActions = (): void => {
    setIsEditorActionsExpanded(true);
  };
  const collapseEditorActions = (): void => {
    setIsEditorActionsExpanded(false);
    setIsEditorLineSpacingMenuOpen(false);
  };
  const editorActionItems = [
    canShowEditorDocumentActions
      ? {
          element: (
            <div
              className="editor-line-spacing-menu-shell"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsEditorLineSpacingMenuOpen(false);
                }
              }}
            >
              <button
                aria-expanded={isEditorLineSpacingMenuOpen}
                aria-haspopup="menu"
                aria-label={editorLineSpacingLabel}
                className="editor-action-button"
                onClick={() => {
                  setIsEditorLineSpacingMenuOpen(
                    (currentValue) => !currentValue,
                  );
                }}
                title={editorLineSpacingLabel}
                type="button"
              >
                <AlignVerticalSpaceAround
                  aria-hidden="true"
                  size={17}
                  strokeWidth={2}
                />
              </button>
              {isEditorLineSpacingMenuOpen ? (
                <div
                  aria-label={text("editor.lineSpacingMenu")}
                  className="editor-line-spacing-menu"
                  role="menu"
                >
                  {EDITOR_LINE_SPACING_OPTIONS.map((option) => (
                    <button
                      aria-checked={editorLineSpacing === option.id}
                      className={
                        editorLineSpacing === option.id
                          ? "is-active"
                          : undefined
                      }
                      key={option.id}
                      onClick={() => {
                        setEditorLineSpacing(option.id);
                        writeEditorLineSpacing(
                          globalThis.localStorage,
                          option.id,
                        );
                        setIsEditorLineSpacingMenuOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {text(option.labelKey)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ),
          id: "line-spacing",
        }
      : null,
    {
      element: (
        <button
          aria-label={editorViewToggleLabel}
          className="editor-action-button"
          onClick={() => {
            setEditorViewMode((currentMode) => {
              const nextMode =
                currentMode === "full-width" ? "centered" : "full-width";

              writeEditorViewMode(globalThis.localStorage, nextMode);

              return nextMode;
            });
          }}
          title={editorViewToggleLabel}
          type="button"
        >
          {isEditorFullWidth ? (
            <AlignHorizontalSpaceAround
              aria-hidden="true"
              size={17}
              strokeWidth={2}
            />
          ) : (
            <StretchHorizontal aria-hidden="true" size={17} strokeWidth={2} />
          )}
        </button>
      ),
      id: "view-toggle",
    },
    canShowEditorDocumentActions
      ? {
          element: (
            <button
              aria-label={text("history.versionHistory")}
              aria-pressed={Boolean(state.isDocumentHistoryPanelVisible)}
              className="editor-action-button"
              onClick={() => {
                void toggleVersionHistory();
              }}
              title={text("history.versionHistory")}
              type="button"
            >
              <History aria-hidden="true" size={17} strokeWidth={2} />
            </button>
          ),
          id: "history",
        }
      : null,
    shouldShowAiActions
      ? {
          element: (
            <AiSummaryActionButton
              busyState={currentAiBusyState}
              onSummarize={() => {
                void summarizeMarkdown();
              }}
              text={text}
            />
          ),
          id: "ai-summary",
        }
      : null,
    shouldShowAiActions
      ? {
          element: (
            <AiTranslateActionMenu
              busyState={currentAiBusyState}
              customLanguageInput={customAiTranslationLanguageInput}
              customLanguages={customAiTranslationLanguages}
              isTranslateMenuOpen={isTranslateMenuOpen}
              onAddCustomLanguage={rememberCustomTranslationLanguage}
              onCustomLanguageInputChange={setCustomAiTranslationLanguageInput}
              onForgetCustomLanguage={forgetCustomTranslationLanguage}
              onToggleTranslateMenu={() => {
                setIsTranslateMenuOpen((currentValue) => !currentValue);
              }}
              onTranslate={(language) => {
                void translateMarkdown(language);
              }}
              text={text}
            />
          ),
          id: "ai-translate",
        }
      : null,
    state.loadedFile
      ? {
          element: (
            <div
              className="editor-search-shell"
              onBlur={(event) => {
                const nextFocusedElement = event.relatedTarget;

                if (
                  nextFocusedElement instanceof Node &&
                  event.currentTarget.contains(nextFocusedElement)
                ) {
                  return;
                }

                setIsEditorSearchHistoryOpen(false);
              }}
              ref={editorSearchShellRef}
            >
              {isEditorSearchOpen ? (
                <form
                  aria-label={text("editor.markdownSearch")}
                  className="editor-search-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    rememberEditorSearchQuery(editorSearchQuery);
                    setIsEditorSearchHistoryOpen(false);
                    cycleEditorSearchMatch();
                  }}
                >
                  <Search aria-hidden="true" size={15} />
                  <input
                    aria-label={text("editor.markdownSearch")}
                    onChange={(event) => {
                      applyEditorSearchQuery(event.target.value);
                      setIsEditorSearchHistoryOpen(true);
                    }}
                    onFocus={() => {
                      setIsEditorSearchHistoryOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        closeEditorSearch();
                      }
                    }}
                    placeholder={text("editor.searchPlaceholder")}
                    ref={editorSearchInputRef}
                    type="search"
                    value={editorSearchQuery}
                  />
                  <span aria-live="polite" className="editor-search-count">
                    {editorSearchQuery.trim().length > 0
                      ? `${Math.max(editorSearchState.activeMatchIndex + 1, 0)}/${editorSearchState.matchCount}`
                      : "0/0"}
                  </span>
                  <button
                    aria-label={text("editor.closeMarkdownSearch")}
                    className="editor-search-close-button"
                    onClick={closeEditorSearch}
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </form>
              ) : null}
              {isEditorSearchOpen &&
              isEditorSearchHistoryOpen &&
              (pinnedEditorSearchQueries.length > 0 ||
                unpinnedVisibleEditorSearchHistory.length > 0) ? (
                <div
                  aria-label={text("editor.searchHistory")}
                  className="search-history-popover editor-search-history"
                  role="listbox"
                >
                  {pinnedEditorSearchQueries.map((pinnedQuery) => (
                    <div
                      className="search-history-row search-history-pinned-row"
                      key={`pinned:${pinnedQuery}`}
                    >
                      <button
                        aria-label={text("editor.usePinnedSearchKeyword", {
                          query: pinnedQuery,
                        })}
                        className="search-history-query-button"
                        onClick={() => {
                          applyEditorSearchQuery(pinnedQuery);
                          setIsEditorSearchHistoryOpen(false);
                          editorSearchInputRef.current?.focus();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        type="button"
                      >
                        {pinnedQuery}
                      </button>
                      <button
                        aria-label={text("editor.deletePinnedSearchKeyword", {
                          query: pinnedQuery,
                        })}
                        className="search-history-pin-button is-active"
                        onClick={() => {
                          deletePinnedEditorSearchQuery(pinnedQuery);
                          editorSearchInputRef.current?.focus();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        title={text("editor.deletePinnedSearchKeyword", {
                          query: pinnedQuery,
                        })}
                        type="button"
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </div>
                  ))}
                  {unpinnedVisibleEditorSearchHistory.map((historyItem) => {
                    const isPinned = isSearchQueryPinned(
                      pinnedEditorSearchQueries,
                      historyItem,
                    );

                    return (
                      <div className="search-history-row" key={historyItem}>
                        <button
                          aria-label={text("editor.useSearchHistoryItem", {
                            query: historyItem,
                          })}
                          className="search-history-query-button"
                          onClick={() => {
                            applyEditorSearchQuery(historyItem);
                            setIsEditorSearchHistoryOpen(false);
                            editorSearchInputRef.current?.focus();
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          type="button"
                        >
                          {historyItem}
                        </button>
                        <button
                          aria-label={text(
                            isPinned
                              ? "editor.unpinSearchHistoryItem"
                              : "editor.pinSearchHistoryItem",
                            { query: historyItem },
                          )}
                          className={`search-history-pin-button${isPinned ? " is-active" : ""}`}
                          onClick={() => {
                            togglePinnedEditorSearchQuery(historyItem);
                            editorSearchInputRef.current?.focus();
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          title={text(
                            isPinned
                              ? "editor.unpinSearchHistoryItem"
                              : "editor.pinSearchHistoryItem",
                            { query: historyItem },
                          )}
                          type="button"
                        >
                          {isPinned ? (
                            <PinOff aria-hidden="true" size={14} />
                          ) : (
                            <Pin aria-hidden="true" size={14} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <button
                aria-label={text("editor.markdownSearch")}
                aria-pressed={isEditorSearchOpen}
                className="editor-action-button"
                onClick={() => {
                  openEditorSearch();
                }}
                title={editorSearchButtonTitle}
                type="button"
              >
                <Search aria-hidden="true" size={17} strokeWidth={2} />
              </button>
            </div>
          ),
          id: "search",
        }
      : null,
  ].filter((item): item is EditorActionItem => item !== null);
  const shouldShowEditorActionOverflowToggle =
    editorActionItems.length > EDITOR_ACTION_VISIBLE_LIMIT;
  const visibleEditorActionItems =
    shouldShowEditorActionOverflowToggle && !isEditorActionsExpanded
      ? editorActionItems.slice(-EDITOR_ACTION_COLLAPSED_ITEM_COUNT)
      : editorActionItems;
  const editorActionOverflowLabel = isEditorActionsExpanded
    ? text("editor.collapseActions")
    : text("editor.expandActions");
  const historyFilterId = state.documentHistoryFilterId ?? "all";
  const historyVersions = state.documentHistoryVersions ?? [];
  const visibleHistoryVersions = filterHistoryVersions(
    historyVersions,
    historyFilterId,
  );

  return (
    <main
      className={[
        "app-shell",
        isExplorerCollapsed ? "is-explorer-collapsed" : "",
        isResizingExplorer ? "is-resizing-explorer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-panel-family={resolvedTheme.panelFamily}
      data-theme={resolvedTheme.id}
      data-theme-family={resolvedTheme.family}
      data-theme-mode={themePreference.mode}
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
      ref={appShellRef}
      style={appShellStyle}
    >
      <ExplorerPane
        aiSettings={aiSettings}
        aiTools={aiTools}
        appVersion={APP_VERSION}
        availableLanguagePacks={selectableAppLanguagePacks}
        isCollapsed={isExplorerCollapsed}
        onAiSettingsChange={updateAiSettings}
        onAppLanguageChange={selectAppLanguage}
        onCheckForUpdates={checkForUpdatesFromSettings}
        onCreateFile={(filePath) => {
          void createMarkdownFile(filePath);
        }}
        onCreateFolder={(folderPath) => {
          void createFolder(folderPath);
        }}
        onDeleteEntry={() => {
          void deleteSelectedEntry();
        }}
        deletedDocumentHistory={state.deletedDocumentHistory ?? []}
        onForgetWorkspace={forgetWorkspace}
        onOpenFile={() => {
          void openFile();
        }}
        onOpenRecentFile={(filePath) => {
          void loadFile(filePath);
        }}
        onOpenWorkspace={() => {
          void openWorkspace();
        }}
        onOpenWorkspaceInNewWindow={(workspace) => {
          void openWorkspaceInNewWindow(workspace);
        }}
        onOpenWorkspaceSearchResult={openWorkspaceSearchResult}
        onRefreshTree={(directoryPaths) =>
          refreshWorkspaceTree(state.workspace?.rootPath, directoryPaths)
        }
        onRenameEntry={(entryName) => {
          void renameSelectedEntry(entryName);
        }}
        onSelectEntry={(entryPath) => {
          dispatch({ type: "explorer/entry-selected", entryPath });
        }}
        onSelectDeletedDocumentHistoryEntry={previewDeletedDocumentHistoryEntry}
        onSelectFile={(filePath) => {
          void loadFile(filePath);
        }}
        onSetDeletedDocumentHistoryVisible={(isVisible) => {
          void setDeletedDocumentHistoryVisible(isVisible);
        }}
        onGenerateAppLanguagePack={generateAppLanguagePack}
        onSwitchWorkspace={(workspace) => {
          void switchWorkspace(workspace);
        }}
        onSearchWorkspace={searchWorkspaceMarkdown}
        onToggleCollapsed={() => {
          setIsExplorerCollapsed((currentValue) => !currentValue);
        }}
        onSelectTheme={(themeId: AppThemeId) => {
          updateThemePreference((currentPreference) =>
            selectAppTheme(currentPreference, themeId),
          );
        }}
        onToggleSystemTheme={(shouldFollowSystem) => {
          updateThemePreference((currentPreference) =>
            shouldFollowSystem
              ? enableSystemThemePreference(currentPreference)
              : disableSystemThemePreference(
                  currentPreference,
                  resolvedTheme.family,
                ),
          );
        }}
        recentFilePaths={recentFilePaths}
        recentWorkspaces={recentWorkspaces}
        resolvedTheme={resolvedTheme}
        selectedLanguageId={appLanguageId}
        shouldAutoOpenWorkspaceDialog={
          hasResolvedInitialLaunchPath &&
          !state.workspace &&
          !state.isOpeningWorkspace
        }
        state={state}
        text={text}
        themePreference={themePreference}
      />
      {!isExplorerCollapsed ? (
        <div
          aria-label={text("editor.resizeExplorerSidebar")}
          aria-orientation="vertical"
          aria-valuemax={EXPLORER_WIDTH_MAX}
          aria-valuemin={EXPLORER_WIDTH_MIN}
          aria-valuenow={explorerWidth}
          className="explorer-resize-handle"
          onKeyDown={resizeExplorerFromKeyboard}
          onPointerDown={beginExplorerResize}
          role="separator"
          tabIndex={0}
        />
      ) : null}
      <section
        className={[
          "editor-pane",
          isEditorFullWidth ? "is-editor-full-width" : "",
          currentAiResult ? "is-ai-result-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={text("editor.label")}
      >
        <div
          aria-label={text("editor.actions")}
          className="editor-action-bar"
          role="toolbar"
        >
          {shouldShowEditorActionOverflowToggle ? (
            <button
              aria-label={editorActionOverflowLabel}
              className="editor-action-button"
              onClick={
                isEditorActionsExpanded
                  ? collapseEditorActions
                  : expandEditorActions
              }
              title={editorActionOverflowLabel}
              type="button"
            >
              {isEditorActionsExpanded ? (
                <ChevronRight aria-hidden="true" size={17} strokeWidth={2} />
              ) : (
                <ChevronLeft aria-hidden="true" size={17} strokeWidth={2} />
              )}
            </button>
          ) : null}
          {visibleEditorActionItems.map((item) => (
            <Fragment key={item.id}>{item.element}</Fragment>
          ))}
        </div>
        {currentAiErrorMessage ? (
          <p className="ai-result-error" role="alert">
            {currentAiErrorMessage}
          </p>
        ) : null}
        {imageAssetRepairNotice ? (
          <p className="editor-notice" role="status">
            {imageAssetRepairNotice}
          </p>
        ) : null}
        {currentAiResult && !historyPreview ? (
          <AiResultPanel
            colorScheme={resolvedTheme.family}
            isRegeneratingSummary={currentAiBusyState === "refining-summary"}
            onClose={() => {
              if (currentAiDocumentKey) {
                clearAiDocumentResult(currentAiDocumentKey);
              }
            }}
            onRegenerateSummary={(instruction) => {
              void summarizeMarkdown(instruction);
            }}
            result={currentAiResult}
            text={text}
            workspaceRoot={state.workspace?.rootPath ?? ""}
          />
        ) : state.loadedFile || historyPreview ? (
          <MarkdownBlockEditor
            key={
              historyPreview
                ? `${state.workspace?.rootPath ?? ""}:history:${historyPreview.version.id}`
                : `${state.workspace?.rootPath ?? ""}:${state.loadedFile?.path ?? ""}`
            }
            draftMarkdown={editorMarkdown}
            colorScheme={resolvedTheme.family}
            errorMessage={state.fileErrorMessage}
            historyPreview={historyPreviewDisplay}
            isDirty={historyPreview ? false : state.isDirty}
            isReadOnly={Boolean(historyPreview)}
            isSaving={historyPreview ? false : state.isSavingFile}
            lineSpacing={editorLineSpacing}
            markdownFilePaths={
              state.workspace
                ? collectMarkdownFilePaths(state.workspace.tree)
                : []
            }
            markdown={editorMarkdown}
            onCreateLinkedMarkdown={createMarkdownFileFromEditorLink}
            onExitHistoryPreview={closeHistoryPreview}
            onImageUpload={uploadImageAsset}
            onOpenLink={(href) => {
              void openEditorLink(href).catch((error) => {
                dispatch({
                  message: getErrorMessage(
                    error,
                    text("errors.openEditorLinkFailed"),
                  ),
                  type: "workspace/operation-failed",
                  workspaceRoot: state.workspace?.rootPath ?? "",
                });
              });
            }}
            onMarkdownChange={(contents) => {
              const workspaceRoot = state.workspace?.rootPath;

              if (!workspaceRoot || !state.loadedFile || historyPreview) {
                return;
              }

              dispatch({
                contents,
                filePath: state.loadedFile.path,
                type: "file/content-changed",
                workspaceRoot,
              });
            }}
            onRestoreHistoryPreview={() => {
              void restoreHistoryPreview();
            }}
            onSaveRequest={saveCurrentFile}
            onSearchStateChange={setEditorSearchState}
            path={editorFilePath}
            pinnedSearchQueries={pinnedEditorSearchQueries}
            ref={editorRef}
            searchQuery={editorSearchQuery}
            text={text}
            activeSearchMatchIndex={editorSearchState.activeMatchIndex}
            workspaceTree={state.workspace?.tree ?? []}
            workspaceRoot={state.workspace?.rootPath ?? ""}
          />
        ) : (
          <div className="editor-empty-state">
            <p className="editor-kicker">MDE</p>
            <h1>{state.selectedFilePath ?? text("editor.emptyTitle")}</h1>
            {state.isLoadingFile ? <p>{text("common.loadingFile")}</p> : null}
            {state.fileErrorMessage ? (
              <p className="editor-error" role="alert">
                {state.fileErrorMessage}
              </p>
            ) : null}
          </div>
        )}
        {state.isDocumentHistoryPanelVisible ? (
          <aside
            aria-label={text("history.versionHistory")}
            className="document-history-panel"
          >
            <h2>{text("history.panelTitle")}</h2>
            <div className="document-history-filters">
              {DOCUMENT_HISTORY_FILTERS.map((filter) => (
                <button
                  aria-pressed={historyFilterId === filter.id}
                  className={
                    historyFilterId === filter.id ? "is-active" : undefined
                  }
                  key={filter.id}
                  onClick={() => {
                    const workspaceRoot = state.workspace?.rootPath;

                    if (!workspaceRoot) {
                      return;
                    }

                    dispatch({
                      filterId: filter.id,
                      type: "history/filter-selected",
                      workspaceRoot,
                    });
                  }}
                  type="button"
                >
                  {text(HISTORY_FILTER_LABEL_KEYS[filter.id])}
                </button>
              ))}
            </div>
            {visibleHistoryVersions.length > 0 ? (
              <div className="document-history-version-list">
                {visibleHistoryVersions.map((version) => {
                  const eventLabel = getHistoryEventLabel(version.event, text);
                  const createdAtLabel = formatHistoryTimestamp(
                    version.createdAt,
                  );

                  return (
                    <button
                      aria-label={text("history.previewVersion", {
                        event: eventLabel,
                        time: createdAtLabel,
                      })}
                      className={
                        historyPreview?.version.id === version.id
                          ? "is-active"
                          : undefined
                      }
                      key={version.id}
                      onClick={() => {
                        void previewHistoryVersion(
                          version.id,
                          historyPreview?.mode ?? "current-file",
                          historyPreview?.deletedDocument,
                        );
                      }}
                      type="button"
                    >
                      <span>{eventLabel}</span>
                      <span>{createdAtLabel}</span>
                      <span>{version.path}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="document-history-empty">
                {text("history.noVersions")}
              </p>
            )}
          </aside>
        ) : null}
      </section>
      {availableUpdate && updateStatus && !isUpdateDismissed ? (
        <UpdateDialog
          errorMessage={updateErrorMessage}
          onDismiss={dismissUpdate}
          onInstall={() => {
            void installUpdate();
          }}
          progress={updateProgress}
          status={updateStatus}
          text={text}
          update={availableUpdate}
        />
      ) : null}
    </main>
  );
};
