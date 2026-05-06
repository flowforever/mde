import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  AtSign,
  Bot,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Languages,
  Monitor,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";

import { ExplorerTree } from "./ExplorerTree";
import {
  readDefaultHiddenExplorerWorkspaces,
  readHiddenExplorerEntries,
  writeDefaultHiddenExplorerWorkspaces,
  writeHiddenExplorerEntries,
} from "./hiddenExplorerEntries";
import {
  collectDefaultHiddenEntryPaths,
  filterHiddenNodes,
  findDirectoryPath,
  getAncestorDirectoryPaths,
} from "./explorerTreeVisibility";
import type { AppState } from "../app/appTypes";
import type { AiTool, AiToolId } from "../../../shared/ai";
import type { UpdateCheckResult } from "../../../shared/update";
import type { WorkspaceSearchResult } from "../../../shared/workspace";
import { getEffectiveAiToolId, type AiCliSettings } from "../ai/aiSettings";
import {
  APP_THEMES,
  getAppThemeRows,
  type AppTheme,
  type AppThemeFamily,
  type AppThemeId,
  type AppThemeRow,
  type AppThemeTone,
  type ThemePreference,
} from "../theme/appThemes";
import type { RecentWorkspace } from "../workspaces/recentWorkspaces";
import type { TreeNode } from "@mde/editor-host/file-tree";
import type { DeletedDocumentHistoryEntry } from "../../../shared/documentHistory";
import {
  isCustomAppLanguagePack,
  type AppLanguagePack,
  type AppText,
  type AppTextKey,
} from "../i18n/appLanguage";
import {
  filterSearchHistory,
  getSearchShortcutLabel,
  GLOBAL_SEARCH_HISTORY_LIMIT,
  GLOBAL_SEARCH_HISTORY_STORAGE_KEY,
  readSearchHistory,
  rememberSearchHistoryItem,
  writeSearchHistory,
} from "../search/searchHistory";
import { searchWorkspacePaths } from "../search/workspacePathSearch";
import type { WorkspacePathSearchResult } from "../search/workspacePathSearch";
import { COMPONENT_IDS } from "../componentIds";

interface ExplorerPaneProps {
  readonly aiSettings?: AiCliSettings;
  readonly aiTools?: readonly AiTool[];
  readonly appVersion?: string;
  readonly availableLanguagePacks?: readonly AppLanguagePack[];
  readonly isCollapsed?: boolean;
  readonly onAiSettingsChange?: (settings: AiCliSettings) => void;
  readonly onAppLanguageChange?: (languageId: string) => void;
  readonly onCheckForUpdates?: () => Promise<UpdateCheckResult>;
  readonly onCreateFile: (filePath: string) => void;
  readonly onCreateFolder: (folderPath: string) => void;
  readonly onCopyEntry?: (entryPath: string) => Promise<void> | void;
  readonly onCopyEntryPath?: (
    entryPath: string,
    pathKind: "absolute" | "relative",
  ) => Promise<void> | void;
  readonly onDeleteEntry: () => void;
  readonly onForgetWorkspace?: (workspace: RecentWorkspace) => void;
  readonly onOpenFile?: () => void;
  readonly onOpenRecentFile?: (filePath: string) => void;
  readonly onOpenWorkspace: () => void;
  readonly onOpenWorkspaceInNewWindow?: (workspace: RecentWorkspace) => void;
  readonly onOpenWorkspaceSearchResult?: (
    filePath: string,
    query: string,
  ) => void;
  readonly onValidateRecentFiles?: () => Promise<void> | void;
  readonly onPasteEntry?: (
    targetDirectoryPath: string,
  ) => Promise<void> | void;
  readonly onRefreshTree?: (
    directoryPaths: readonly string[],
  ) => Promise<void> | void;
  readonly onRenameEntry: (entryName: string) => void;
  readonly onSearchWorkspace?: (
    query: string,
  ) => Promise<WorkspaceSearchResult>;
  readonly onSelectTheme?: (themeId: AppThemeId) => void;
  readonly onSelectEntry: (entryPath: string | null) => void;
  readonly onSelectDeletedDocumentHistoryEntry?: (
    entry: DeletedDocumentHistoryEntry,
  ) => void;
  readonly onSelectFile: (filePath: string) => void;
  readonly onSetDeletedDocumentHistoryVisible?: (
    isVisible: boolean,
  ) => Promise<void> | void;
  readonly onGenerateAppLanguagePack?: (language: string) => Promise<void>;
  readonly onSwitchWorkspace?: (workspace: RecentWorkspace) => void;
  readonly onToggleCollapsed?: () => void;
  readonly onToggleSystemTheme?: (shouldFollowSystem: boolean) => void;
  readonly deletedDocumentHistory?: readonly DeletedDocumentHistoryEntry[];
  readonly recentFilePaths?: readonly string[];
  readonly recentWorkspaces?: readonly RecentWorkspace[];
  readonly resolvedTheme?: AppTheme;
  readonly selectedLanguageId?: string;
  readonly shouldAutoOpenWorkspaceDialog?: boolean;
  readonly state: AppState;
  readonly text: AppText;
  readonly themePreference?: ThemePreference;
}

type PendingExplorerAction = "create-file" | "create-folder" | "rename" | null;
type AppLanguagePackGenerationMode = "create" | "update" | null;
type GlobalSearchMode = "content" | "path";
interface OpenWorkspaceSearchDetail {
  cycleMode?: boolean;
  mode?: GlobalSearchMode;
}
type SettingsPanelId = "ai" | "preferences" | "theme" | "updates";

interface EntryContextMenu {
  readonly entry: TreeNode;
  readonly x: number;
  readonly y: number;
}

interface PendingDeleteConfirmation {
  readonly x: number;
  readonly y: number;
}

const EMPTY_HIDDEN_ENTRY_PATHS: ReadonlySet<string> = new Set();
const DEFAULT_AI_SETTINGS: AiCliSettings = {
  modelNames: {},
  selectedToolId: null,
};
const EXPLORER_RECENT_FILES_PANEL_STORAGE_KEY = "mde.explorerRecentFilesPanel";
const RECENT_FILES_PANEL_HEIGHT_DEFAULT = 164;
const RECENT_FILES_PANEL_HEIGHT_MIN = 96;
const RECENT_FILES_PANEL_HEIGHT_MAX = 320;
const DELETE_CONFIRMATION_WIDTH = 220;
const DELETE_CONFIRMATION_HEIGHT = 108;
const DELETE_CONFIRMATION_MARGIN = 12;

interface RecentFilesPanelState {
  readonly height: number;
  readonly isCollapsed: boolean;
}

interface LocateFileRequest {
  readonly id: number;
  readonly path: string;
  readonly workspaceRoot: string | null;
}

interface ExpandedDirectoryState {
  readonly paths: ReadonlySet<string>;
  readonly workspaceRoot: string | null;
}

const EMPTY_EXPANDED_DIRECTORY_PATHS = new Set<string>();

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1
    ? entryPath
    : entryPath.slice(separatorIndex + 1);
};

const renderHighlightedSearchText = (
  contents: string,
  query: string,
): ReactNode => {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    return contents;
  }

  const lowerContents = contents.toLocaleLowerCase();
  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  let cursor = 0;
  let segmentIndex = 0;
  let matchIndex = lowerContents.indexOf(lowerQuery);
  let segments: readonly ReactNode[] = [];

  while (matchIndex !== -1) {
    const beforeMatch = contents.slice(cursor, matchIndex);
    const matchedText = contents.slice(
      matchIndex,
      matchIndex + normalizedQuery.length,
    );

    segments = [
      ...segments,
      ...(beforeMatch.length > 0 ? [beforeMatch] : []),
      <mark
        className="global-search-result-match"
        key={`${matchIndex}:${segmentIndex}`}
      >
        {matchedText}
      </mark>,
    ];
    cursor = matchIndex + normalizedQuery.length;
    segmentIndex += 1;
    matchIndex = lowerContents.indexOf(lowerQuery, cursor);
  }

  if (segments.length === 0) {
    return contents;
  }

  return [
    ...segments,
    ...(cursor < contents.length ? [contents.slice(cursor)] : []),
  ];
};

const getParentPath = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1 ? "" : entryPath.slice(0, separatorIndex);
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

const getPasteTargetDirectoryPath = (
  nodes: readonly TreeNode[],
  entryPath: string | null,
): string => {
  if (!entryPath) {
    return "";
  }

  return findNodeByPath(nodes, entryPath)?.type === "directory"
    ? entryPath
    : getParentPath(entryPath);
};

const isEditableShortcutTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  );
};

const clampRecentFilesPanelHeight = (height: number): number =>
  Number.isFinite(height)
    ? Math.min(
        RECENT_FILES_PANEL_HEIGHT_MAX,
        Math.max(RECENT_FILES_PANEL_HEIGHT_MIN, Math.round(height)),
      )
    : RECENT_FILES_PANEL_HEIGHT_DEFAULT;

const readRecentFilesPanelState = (): RecentFilesPanelState => {
  try {
    const storedValue = globalThis.localStorage.getItem(
      EXPLORER_RECENT_FILES_PANEL_STORAGE_KEY,
    );

    if (!storedValue) {
      return {
        height: RECENT_FILES_PANEL_HEIGHT_DEFAULT,
        isCollapsed: false,
      };
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>;

    return {
      height:
        typeof parsedValue.height === "number"
          ? clampRecentFilesPanelHeight(parsedValue.height)
          : RECENT_FILES_PANEL_HEIGHT_DEFAULT,
      isCollapsed: parsedValue.isCollapsed === true,
    };
  } catch {
    return {
      height: RECENT_FILES_PANEL_HEIGHT_DEFAULT,
      isCollapsed: false,
    };
  }
};

const writeRecentFilesPanelState = (state: RecentFilesPanelState): void => {
  try {
    globalThis.localStorage.setItem(
      EXPLORER_RECENT_FILES_PANEL_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
};

const joinEntryPath = (
  directoryPath: string | null,
  entryPath: string,
): string => (directoryPath ? `${directoryPath}/${entryPath}` : entryPath);

const getDirectoryDepth = (directoryPath: string): number =>
  directoryPath.split("/").filter((segment) => segment.length > 0).length;

const sortDirectoryPaths = (
  directoryPaths: Iterable<string>,
): readonly string[] =>
  Array.from(new Set(directoryPaths)).sort(
    (leftPath, rightPath) =>
      getDirectoryDepth(leftPath) - getDirectoryDepth(rightPath) ||
      leftPath.localeCompare(rightPath),
  );

const clampDeleteConfirmationPosition = (
  x: number,
  y: number,
): PendingDeleteConfirmation => {
  const maxX = Math.max(
    DELETE_CONFIRMATION_MARGIN,
    globalThis.innerWidth -
      DELETE_CONFIRMATION_WIDTH -
      DELETE_CONFIRMATION_MARGIN,
  );
  const maxY = Math.max(
    DELETE_CONFIRMATION_MARGIN,
    globalThis.innerHeight -
      DELETE_CONFIRMATION_HEIGHT -
      DELETE_CONFIRMATION_MARGIN,
  );

  return {
    x: Math.min(Math.max(DELETE_CONFIRMATION_MARGIN, x), maxX),
    y: Math.min(Math.max(DELETE_CONFIRMATION_MARGIN, y), maxY),
  };
};

const resolveCreatedEntryPath = (
  directoryPath: string | null,
  entryPath: string,
): string => {
  if (
    !directoryPath ||
    entryPath === directoryPath ||
    entryPath.startsWith(`${directoryPath}/`)
  ) {
    return entryPath;
  }

  return joinEntryPath(directoryPath, entryPath);
};

const isEntryAtOrInsideDirectoryPath = (
  directoryPath: string,
  entryPath: string,
): boolean =>
  entryPath === directoryPath || entryPath.startsWith(`${directoryPath}/`);

interface ThemeDialogColumn {
  readonly id: AppThemeTone;
  readonly labelKey: AppTextKey;
}

const THEME_DIALOG_COLUMNS: readonly ThemeDialogColumn[] = [
  { id: "dark", labelKey: "theme.columnDark" },
  { id: "light-panel", labelKey: "theme.columnLightPanel" },
  { id: "dark-panel", labelKey: "theme.columnDarkPanel" },
];

const getThemeDialogColumns = (
  isFollowingSystemTheme: boolean,
  resolvedFamily: AppThemeFamily,
): readonly ThemeDialogColumn[] => {
  if (!isFollowingSystemTheme) {
    return THEME_DIALOG_COLUMNS;
  }

  return resolvedFamily === "dark"
    ? [THEME_DIALOG_COLUMNS[0]]
    : [THEME_DIALOG_COLUMNS[1], THEME_DIALOG_COLUMNS[2]];
};

const getThemeForColumn = (
  row: AppThemeRow,
  columnId: AppThemeTone,
): AppTheme => {
  if (columnId === "dark") {
    return row.darkTheme;
  }

  return columnId === "light-panel" ? row.lightPanelTheme : row.darkPanelTheme;
};

const THEME_LABEL_KEYS = {
  apricot: "theme.label.apricot",
  atelier: "theme.label.atelier",
  basalt: "theme.label.basalt",
  binder: "theme.label.binder",
  "blue-hour": "theme.label.blueHour",
  canopy: "theme.label.canopy",
  carbon: "theme.label.carbon",
  cedar: "theme.label.cedar",
  ember: "theme.label.ember",
  glacier: "theme.label.glacier",
  ink: "theme.label.ink",
  ivory: "theme.label.ivory",
  lagoon: "theme.label.lagoon",
  ledger: "theme.label.ledger",
  lilac: "theme.label.lilac",
  manuscript: "theme.label.manuscript",
  mint: "theme.label.mint",
  moss: "theme.label.moss",
  "paper-blue": "theme.label.paperBlue",
  plum: "theme.label.plum",
  porcelain: "theme.label.porcelain",
  quarry: "theme.label.quarry",
  "sage-paper": "theme.label.sagePaper",
  terracotta: "theme.label.terracotta",
} as const satisfies Record<AppThemeId, AppTextKey>;

const THEME_DESCRIPTION_KEYS = {
  apricot: "theme.description.apricot",
  atelier: "theme.description.atelier",
  basalt: "theme.description.basalt",
  binder: "theme.description.binder",
  "blue-hour": "theme.description.blueHour",
  canopy: "theme.description.canopy",
  carbon: "theme.description.carbon",
  cedar: "theme.description.cedar",
  ember: "theme.description.ember",
  glacier: "theme.description.glacier",
  ink: "theme.description.ink",
  ivory: "theme.description.ivory",
  lagoon: "theme.description.lagoon",
  ledger: "theme.description.ledger",
  lilac: "theme.description.lilac",
  manuscript: "theme.description.manuscript",
  mint: "theme.description.mint",
  moss: "theme.description.moss",
  "paper-blue": "theme.description.paperBlue",
  plum: "theme.description.plum",
  porcelain: "theme.description.porcelain",
  quarry: "theme.description.quarry",
  "sage-paper": "theme.description.sagePaper",
  terracotta: "theme.description.terracotta",
} as const satisfies Record<AppThemeId, AppTextKey>;

const THEME_GROUP_LABEL_KEYS = {
  blue: "theme.groupBlue",
  brass: "theme.groupBrass",
  ember: "theme.groupEmber",
  green: "theme.groupGreen",
  neutral: "theme.groupNeutral",
  teal: "theme.groupTeal",
  violet: "theme.groupViolet",
  warm: "theme.groupWarm",
} as const satisfies Record<AppThemeRow["id"], AppTextKey>;

const getThemeLabel = (theme: AppTheme, text: AppText): string =>
  text(THEME_LABEL_KEYS[theme.id]);

const getThemeDescription = (theme: AppTheme, text: AppText): string =>
  text(THEME_DESCRIPTION_KEYS[theme.id]);

const getThemeFamilyLabel = (
  family: AppThemeFamily,
  text: AppText,
): string => text(family === "dark" ? "theme.familyDark" : "theme.familyLight");

export const ExplorerPane = ({
  aiSettings = DEFAULT_AI_SETTINGS,
  aiTools = [],
  appVersion = "0.0.0",
  availableLanguagePacks = [],
  isCollapsed = false,
  onAiSettingsChange = () => undefined,
  onAppLanguageChange = () => undefined,
  onCheckForUpdates,
  onCreateFile,
  onCreateFolder,
  onCopyEntry = () => undefined,
  onCopyEntryPath = () => undefined,
  onDeleteEntry,
  onForgetWorkspace = () => undefined,
  onOpenFile = () => undefined,
  onOpenRecentFile = () => undefined,
  onOpenWorkspace,
  onOpenWorkspaceInNewWindow = () => undefined,
  onOpenWorkspaceSearchResult = () => undefined,
  onValidateRecentFiles = () => undefined,
  onPasteEntry = () => undefined,
  onRefreshTree = () => undefined,
  onRenameEntry,
  onSearchWorkspace,
  onSelectTheme = () => undefined,
  onSelectEntry,
  onSelectDeletedDocumentHistoryEntry = () => undefined,
  onSelectFile,
  onSetDeletedDocumentHistoryVisible = () => undefined,
  onGenerateAppLanguagePack = () => Promise.resolve(),
  onSwitchWorkspace = () => undefined,
  onToggleCollapsed = () => undefined,
  onToggleSystemTheme = () => undefined,
  deletedDocumentHistory = [],
  recentFilePaths = [],
  recentWorkspaces = [],
  resolvedTheme = APP_THEMES[0],
  selectedLanguageId = "en",
  shouldAutoOpenWorkspaceDialog = false,
  state,
  text,
  themePreference = {
    lastDarkThemeId: "carbon",
    lastLightThemeId: "manuscript",
    mode: "system",
  },
}: ExplorerPaneProps): React.JSX.Element => {
  const workspaceRoot = state.workspace?.rootPath ?? null;
  const [pendingAction, setPendingAction] =
    useState<PendingExplorerAction>(null);
  const [actionTargetDirectoryPath, setActionTargetDirectoryPath] = useState<
    string | null
  >(null);
  const [actionTargetEntryPath, setActionTargetEntryPath] = useState<
    string | null
  >(null);
  const [entryValue, setEntryValue] = useState("");
  const [contextMenu, setContextMenu] = useState<EntryContextMenu | null>(null);
  const [recentFilesPanelState, setRecentFilesPanelState] = useState(
    readRecentFilesPanelState,
  );
  const [isDeletedDocumentsExpanded, setDeletedDocumentsExpanded] =
    useState(false);
  const [expandedDirectoryState, setExpandedDirectoryState] =
    useState<ExpandedDirectoryState>(() => ({
      paths: new Set(),
      workspaceRoot,
    }));
  const [locateFileRequest, setLocateFileRequest] =
    useState<LocateFileRequest | null>(null);
  const [isResizingRecentFiles, setIsResizingRecentFiles] = useState(false);
  const [hiddenEntryPathsByWorkspace, setHiddenEntryPathsByWorkspace] =
    useState<ReadonlyMap<string, ReadonlySet<string>>>(
      readHiddenExplorerEntries,
    );
  const [defaultHiddenWorkspaceRoots, setDefaultHiddenWorkspaceRoots] =
    useState<ReadonlySet<string>>(readDefaultHiddenExplorerWorkspaces);
  const [hasDismissedAutoWorkspaceDialog, setHasDismissedAutoWorkspaceDialog] =
    useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<PendingDeleteConfirmation | null>(null);
  const [
    showingHiddenEntriesWorkspaceRoot,
    setShowingHiddenEntriesWorkspaceRoot,
  ] = useState<string | null>(null);
  const [isWorkspaceDialogManuallyOpen, setIsWorkspaceDialogManuallyOpen] =
    useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsPanel, setActiveSettingsPanel] =
    useState<SettingsPanelId>("theme");
  const [customAppLanguageInput, setCustomAppLanguageInput] = useState("");
  const [
    appLanguagePackGenerationMode,
    setAppLanguagePackGenerationMode,
  ] = useState<AppLanguagePackGenerationMode>(null);
  const [languagePreferenceMessage, setLanguagePreferenceMessage] = useState<
    string | null
  >(null);
  const [languagePreferenceErrorMessage, setLanguagePreferenceErrorMessage] =
    useState<string | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [settingsUpdateMessage, setSettingsUpdateMessage] = useState<
    string | null
  >(null);
  const [settingsUpdateErrorMessage, setSettingsUpdateErrorMessage] = useState<
    string | null
  >(null);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchMode, setGlobalSearchMode] =
    useState<GlobalSearchMode>("content");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchHistory, setGlobalSearchHistory] = useState(() =>
    readSearchHistory(
      GLOBAL_SEARCH_HISTORY_STORAGE_KEY,
      globalThis.localStorage,
      GLOBAL_SEARCH_HISTORY_LIMIT,
    ),
  );
  const [isGlobalSearchHistoryOpen, setIsGlobalSearchHistoryOpen] =
    useState(false);
  const [globalSearchResult, setGlobalSearchResult] =
    useState<WorkspaceSearchResult | null>(null);
  const [isGlobalSearchLoading, setIsGlobalSearchLoading] = useState(false);
  const [globalSearchErrorMessage, setGlobalSearchErrorMessage] = useState<
    string | null
  >(null);
  const workspaceContentRef = useRef<HTMLDivElement | null>(null);
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const locateFileRequestIdRef = useRef(0);
  const validatedRecentFilesWorkspaceRootRef = useRef<string | null>(null);
  const baseExpandedDirectoryPaths =
    expandedDirectoryState.workspaceRoot === workspaceRoot
      ? expandedDirectoryState.paths
      : EMPTY_EXPANDED_DIRECTORY_PATHS;
  const expandedDirectoryPaths = useMemo(() => {
    const selectedEntryAncestorPaths = state.selectedEntryPath
      ? getAncestorDirectoryPaths(state.selectedEntryPath)
      : [];

    if (selectedEntryAncestorPaths.length === 0) {
      return baseExpandedDirectoryPaths;
    }

    return new Set([
      ...baseExpandedDirectoryPaths,
      ...selectedEntryAncestorPaths,
    ]);
  }, [baseExpandedDirectoryPaths, state.selectedEntryPath]);
  const selectedNode =
    state.workspace && state.selectedEntryPath
      ? findNodeByPath(state.workspace.tree, state.selectedEntryPath)
      : null;
  const selectedFileLocateRequest =
    selectedNode?.type === "file" && workspaceRoot && state.selectedEntryPath
      ? {
          id: 0,
          path: state.selectedEntryPath,
          workspaceRoot,
        }
      : null;
  const activeLocateFileRequest =
    locateFileRequest?.workspaceRoot === workspaceRoot
      ? locateFileRequest
      : selectedFileLocateRequest;
  const hiddenEntryPaths = workspaceRoot
    ? (hiddenEntryPathsByWorkspace.get(workspaceRoot) ??
      EMPTY_HIDDEN_ENTRY_PATHS)
    : EMPTY_HIDDEN_ENTRY_PATHS;
  const globalSearchShortcutLabel = useMemo(
    () => getSearchShortcutLabel("workspace"),
    [],
  );
  const globalPathSearchShortcutLabel = useMemo(
    () => getSearchShortcutLabel("workspacePath"),
    [],
  );
  const globalSearchButtonTitle = text("globalSearch.searchWithShortcut", {
    shortcut: globalSearchShortcutLabel,
  });
  const globalSearchContentModeTitle = text(
    "globalSearch.contentModeWithShortcut",
    {
      shortcut: globalSearchShortcutLabel,
    },
  );
  const globalSearchPathModeTitle = text("globalSearch.pathModeWithShortcut", {
    shortcut: globalPathSearchShortcutLabel,
  });
  const visibleGlobalSearchHistory = useMemo(
    () => filterSearchHistory(globalSearchHistory, globalSearchQuery),
    [globalSearchHistory, globalSearchQuery],
  );
  const globalSearchHistoryHeading =
    globalSearchQuery.trim().length > 0
      ? text("globalSearch.matchingHistory")
      : text("globalSearch.history");

  const setActiveGlobalSearchMode = useCallback(
    (mode: GlobalSearchMode): void => {
      setGlobalSearchMode(mode);
      setGlobalSearchResult(null);
      setGlobalSearchErrorMessage(null);
      setIsGlobalSearchHistoryOpen(mode === "content");
      setIsGlobalSearchLoading(
        mode === "content" && globalSearchQuery.trim().length > 0,
      );
    },
    [globalSearchQuery],
  );

  const openGlobalSearch = useCallback(
    (
      mode: GlobalSearchMode = "content",
      options: { cycleMode?: boolean } = {},
    ): void => {
      const nextMode =
        options.cycleMode && isGlobalSearchOpen
          ? globalSearchMode === "path"
            ? "content"
            : "path"
          : mode;

      setActiveGlobalSearchMode(nextMode);
      setIsGlobalSearchOpen(true);
    },
    [globalSearchMode, isGlobalSearchOpen, setActiveGlobalSearchMode],
  );

  const closeGlobalSearch = useCallback((): void => {
    setIsGlobalSearchOpen(false);
    setIsGlobalSearchHistoryOpen(false);
    setGlobalSearchMode("content");
    setGlobalSearchQuery("");
    setGlobalSearchResult(null);
    setGlobalSearchErrorMessage(null);
    setIsGlobalSearchLoading(false);
  }, []);

  const rememberGlobalSearchQuery = useCallback((query: string): void => {
    setGlobalSearchHistory((currentHistory) => {
      const nextHistory = rememberSearchHistoryItem(
        currentHistory,
        query,
        GLOBAL_SEARCH_HISTORY_LIMIT,
      );

      writeSearchHistory(
        GLOBAL_SEARCH_HISTORY_STORAGE_KEY,
        nextHistory,
        globalThis.localStorage,
        GLOBAL_SEARCH_HISTORY_LIMIT,
      );

      return nextHistory;
    });
  }, []);

  useEffect(() => {
    writeHiddenExplorerEntries(hiddenEntryPathsByWorkspace);
  }, [hiddenEntryPathsByWorkspace]);

  useEffect(() => {
    const openWorkspaceSearch = (event: Event): void => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as OpenWorkspaceSearchDetail | null)
          : null;
      const requestedMode = detail?.mode === "path" ? "path" : "content";

      openGlobalSearch(requestedMode, {
        cycleMode: detail?.cycleMode === true,
      });
    };

    window.addEventListener("mde:open-workspace-search", openWorkspaceSearch);

    return () => {
      window.removeEventListener(
        "mde:open-workspace-search",
        openWorkspaceSearch,
      );
    };
  }, [openGlobalSearch]);

  useLayoutEffect(() => {
    if (!isGlobalSearchOpen) {
      return;
    }

    globalSearchInputRef.current?.focus();
    globalSearchInputRef.current?.select();
  }, [isGlobalSearchOpen]);

  useEffect(() => {
    if (
      !isGlobalSearchOpen ||
      globalSearchMode !== "content" ||
      !onSearchWorkspace
    ) {
      return;
    }

    const query = globalSearchQuery.trim();

    if (query.length === 0) {
      return;
    }

    let isCancelled = false;

    const timeoutId = window.setTimeout(() => {
      void onSearchWorkspace(query)
        .then((result) => {
          if (!isCancelled) {
            setGlobalSearchResult(result);
          }
        })
        .catch((error: unknown) => {
          if (!isCancelled) {
            setGlobalSearchResult(null);
            setGlobalSearchErrorMessage(
              error instanceof Error
                ? error.message
                : text("errors.searchWorkspaceFailed"),
            );
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsGlobalSearchLoading(false);
          }
        });
    }, 180);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    globalSearchMode,
    globalSearchQuery,
    isGlobalSearchOpen,
    onSearchWorkspace,
    text,
  ]);

  useEffect(() => {
    writeDefaultHiddenExplorerWorkspaces(defaultHiddenWorkspaceRoots);
  }, [defaultHiddenWorkspaceRoots]);

  useEffect(() => {
    writeRecentFilesPanelState(recentFilesPanelState);
  }, [recentFilesPanelState]);

  useEffect(() => {
    if (
      recentFilesPanelState.isCollapsed ||
      !workspaceRoot ||
      validatedRecentFilesWorkspaceRootRef.current === workspaceRoot
    ) {
      return;
    }

    validatedRecentFilesWorkspaceRootRef.current = workspaceRoot;
    void Promise.resolve(onValidateRecentFiles()).catch(() => undefined);
  }, [
    onValidateRecentFiles,
    recentFilesPanelState.isCollapsed,
    workspaceRoot,
  ]);

  const updateRecentFilesHeightFromPointer = useCallback(
    (clientY: number): void => {
      const bounds = workspaceContentRef.current?.getBoundingClientRect();

      if (!bounds) {
        return;
      }

      setRecentFilesPanelState(() => ({
        height: clampRecentFilesPanelHeight(bounds.bottom - clientY),
        isCollapsed: false,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!isResizingRecentFiles) {
      return;
    }

    const updateHeight = (event: PointerEvent): void => {
      updateRecentFilesHeightFromPointer(event.clientY);
    };
    const stopResizing = (): void => {
      setIsResizingRecentFiles(false);
    };

    document.body.classList.add("is-resizing-explorer-panel");
    window.addEventListener("pointermove", updateHeight);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.classList.remove("is-resizing-explorer-panel");
      window.removeEventListener("pointermove", updateHeight);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingRecentFiles, updateRecentFilesHeightFromPointer]);

  const commitHiddenEntryPaths = (nextPaths: ReadonlySet<string>): void => {
    if (!workspaceRoot) {
      return;
    }

    setDefaultHiddenWorkspaceRoots((currentRoots) =>
      currentRoots.has(workspaceRoot)
        ? currentRoots
        : new Set([...currentRoots, workspaceRoot]),
    );
    setHiddenEntryPathsByWorkspace((currentPathsByWorkspace) => {
      const nextPathsByWorkspace = new Map(currentPathsByWorkspace);

      if (nextPaths.size === 0) {
        nextPathsByWorkspace.delete(workspaceRoot);
      } else {
        nextPathsByWorkspace.set(workspaceRoot, nextPaths);
      }

      return nextPathsByWorkspace;
    });
  };

  const beginAction = (
    action: Exclude<PendingExplorerAction, null>,
    defaultValue: string,
    targetDirectoryPath: string | null = null,
    targetEntryPath: string | null = null,
  ): void => {
    setPendingAction(action);
    setActionTargetDirectoryPath(targetDirectoryPath);
    setActionTargetEntryPath(targetEntryPath);
    setEntryValue(defaultValue);
    setDeleteConfirmation(null);
  };

  const clearPendingAction = (): void => {
    setPendingAction(null);
    setActionTargetDirectoryPath(null);
    setActionTargetEntryPath(null);
    setEntryValue("");
  };

  const closeContextMenu = (): void => {
    setContextMenu(null);
  };

  const closeWorkspaceDialog = (): void => {
    setHasDismissedAutoWorkspaceDialog(true);
    setIsWorkspaceDialogManuallyOpen(false);
    setWorkspaceSearchQuery("");
  };

  const closeSettingsDialog = (): void => {
    setIsSettingsDialogOpen(false);
    setSettingsUpdateErrorMessage(null);
  };

  const requestLocateFile = useCallback((filePath: string): void => {
    locateFileRequestIdRef.current += 1;
    setLocateFileRequest({
      id: locateFileRequestIdRef.current,
      path: filePath,
      workspaceRoot,
    });
  }, [workspaceRoot]);

  const refreshDirectoryPaths = (
    directoryPaths: Iterable<string>,
    shouldLocateOpenFile = false,
  ): void => {
    const currentOpenFilePath =
      state.loadedFile?.path ?? state.selectedFilePath;
    const nextExpandedDirectoryPaths = new Set(expandedDirectoryPaths);

    if (shouldLocateOpenFile && currentOpenFilePath) {
      for (const directoryPath of getAncestorDirectoryPaths(
        currentOpenFilePath,
      )) {
        nextExpandedDirectoryPaths.add(directoryPath);
      }

      setExpandedDirectoryState({
        paths: nextExpandedDirectoryPaths,
        workspaceRoot,
      });
    }

    void Promise.resolve(
      onRefreshTree(
        sortDirectoryPaths(
          shouldLocateOpenFile ? nextExpandedDirectoryPaths : directoryPaths,
        ),
      ),
    )
      .then(() => {
        if (shouldLocateOpenFile && currentOpenFilePath) {
          requestLocateFile(currentOpenFilePath);
        }
      })
      .catch(() => undefined);
  };

  const changeDirectoryExpansion = (
    directoryPath: string,
    isExpanded: boolean,
  ): void => {
    setExpandedDirectoryState((currentState) => {
      const currentPaths =
        currentState.workspaceRoot === workspaceRoot
          ? currentState.paths
          : EMPTY_EXPANDED_DIRECTORY_PATHS;
      const nextPaths = new Set(currentPaths);

      if (isExpanded) {
        nextPaths.add(directoryPath);
      } else {
        nextPaths.delete(directoryPath);
      }

      return {
        paths: nextPaths,
        workspaceRoot,
      };
    });

    if (
      !isExpanded &&
      state.selectedEntryPath &&
      isEntryAtOrInsideDirectoryPath(directoryPath, state.selectedEntryPath)
    ) {
      onSelectEntry(null);
    }

    if (isExpanded) {
      refreshDirectoryPaths([directoryPath]);
    }
  };

  const toggleWorkspaceDialog = (): void => {
    if (isWorkspaceDialogOpen) {
      closeWorkspaceDialog();
      return;
    }

    setIsWorkspaceDialogManuallyOpen(true);
  };

  const openSettingsDialog = (panel: SettingsPanelId = "theme"): void => {
    setActiveSettingsPanel(panel);
    setIsSettingsDialogOpen(true);
  };

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = (): void => {
      setContextMenu(null);
    };
    const closeMenuOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleExplorerClipboardShortcut = (event: KeyboardEvent): void => {
      if (
        isEditableShortcutTarget(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey
      ) {
        return;
      }

      const shortcutKey = event.key.toLowerCase();

      if (shortcutKey === "c" && state.selectedEntryPath) {
        if (!event.metaKey) {
          event.preventDefault();
        }
        void Promise.resolve(onCopyEntry(state.selectedEntryPath)).catch(
          () => undefined,
        );
        return;
      }

      if (shortcutKey === "v" && state.workspace) {
        if (!event.metaKey) {
          event.preventDefault();
        }
        void Promise.resolve(
          onPasteEntry(
            getPasteTargetDirectoryPath(
              state.workspace.tree,
              state.selectedEntryPath,
            ),
          ),
        ).catch(() => undefined);
      }
    };

    window.addEventListener("keydown", handleExplorerClipboardShortcut);

    return () => {
      window.removeEventListener("keydown", handleExplorerClipboardShortcut);
    };
  }, [
    onCopyEntry,
    onPasteEntry,
    state.selectedEntryPath,
    state.workspace,
  ]);

  useEffect(() => {
    const handleExplorerCopy = (event: ClipboardEvent): void => {
      const selectedEntryPath = state.selectedEntryPath;

      if (isEditableShortcutTarget(event.target) || !selectedEntryPath) {
        return;
      }

      event.preventDefault();
      if (workspaceRoot) {
        event.clipboardData?.setData(
          "text/plain",
          workspaceRoot.endsWith("/")
            ? `${workspaceRoot}${selectedEntryPath}`
            : `${workspaceRoot}/${selectedEntryPath}`,
        );
      }
      void Promise.resolve(onCopyEntry(selectedEntryPath)).catch(
        () => undefined,
      );
    };
    const handleExplorerPaste = (event: ClipboardEvent): void => {
      if (isEditableShortcutTarget(event.target) || !state.workspace) {
        return;
      }

      event.preventDefault();
      void Promise.resolve(
        onPasteEntry(
          getPasteTargetDirectoryPath(
            state.workspace.tree,
            state.selectedEntryPath,
          ),
        ),
      ).catch(() => undefined);
    };

    window.addEventListener("copy", handleExplorerCopy);
    window.addEventListener("paste", handleExplorerPaste);

    return () => {
      window.removeEventListener("copy", handleExplorerCopy);
      window.removeEventListener("paste", handleExplorerPaste);
    };
  }, [
    onCopyEntry,
    onPasteEntry,
    state.selectedEntryPath,
    state.workspace,
    workspaceRoot,
  ]);

  useEffect(() => {
    if (!deleteConfirmation) {
      return;
    }

    const closeDeleteConfirmation = (): void => {
      setDeleteConfirmation(null);
    };
    const closeDeleteConfirmationOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeDeleteConfirmation();
      }
    };

    window.addEventListener("scroll", closeDeleteConfirmation, true);
    window.addEventListener("resize", closeDeleteConfirmation);
    window.addEventListener("keydown", closeDeleteConfirmationOnEscape);

    return () => {
      window.removeEventListener("scroll", closeDeleteConfirmation, true);
      window.removeEventListener("resize", closeDeleteConfirmation);
      window.removeEventListener("keydown", closeDeleteConfirmationOnEscape);
    };
  }, [deleteConfirmation]);

  const beginContextRename = (): void => {
    if (!contextMenu) {
      return;
    }

    onSelectEntry(contextMenu.entry.path);
    beginAction(
      "rename",
      getEntryName(contextMenu.entry.path),
      null,
      contextMenu.entry.path,
    );
    closeContextMenu();
  };

  const beginContextCreateFile = (): void => {
    if (contextMenu?.entry.type !== "directory") {
      return;
    }

    onSelectEntry(contextMenu.entry.path);
    beginAction(
      "create-file",
      text("explorer.newMarkdownFileDefaultName"),
      contextMenu.entry.path,
    );
    closeContextMenu();
  };

  const beginContextCreateFolder = (): void => {
    if (contextMenu?.entry.type !== "directory") {
      return;
    }

    onSelectEntry(contextMenu.entry.path);
    beginAction(
      "create-folder",
      text("explorer.newFolderDefaultName"),
      contextMenu.entry.path,
    );
    closeContextMenu();
  };

  const beginContextDelete = (): void => {
    if (!contextMenu) {
      return;
    }

    onSelectEntry(contextMenu.entry.path);
    setDeleteConfirmation(
      clampDeleteConfirmationPosition(contextMenu.x, contextMenu.y),
    );
    clearPendingAction();
    closeContextMenu();
  };

  const copyContextEntry = (): void => {
    if (!contextMenu) {
      return;
    }

    void Promise.resolve(onCopyEntry(contextMenu.entry.path)).catch(
      () => undefined,
    );
    closeContextMenu();
  };

  const pasteIntoContextEntry = (): void => {
    if (!contextMenu) {
      return;
    }

    void Promise.resolve(
      onPasteEntry(
        contextMenu.entry.type === "directory"
          ? contextMenu.entry.path
          : getParentPath(contextMenu.entry.path),
      ),
    ).catch(() => undefined);
    closeContextMenu();
  };

  const copyContextEntryPath = (pathKind: "absolute" | "relative"): void => {
    if (!contextMenu) {
      return;
    }

    void Promise.resolve(
      onCopyEntryPath(contextMenu.entry.path, pathKind),
    ).catch(() => undefined);
    closeContextMenu();
  };

  const hideContextEntry = (): void => {
    if (!contextMenu) {
      return;
    }

    const entryPath = contextMenu.entry.path;

    commitHiddenEntryPaths(new Set([...effectiveHiddenEntryPaths, entryPath]));
    setShowingHiddenEntriesWorkspaceRoot(null);
    closeContextMenu();
  };

  const showContextEntry = (): void => {
    if (!contextMenu) {
      return;
    }

    const entryPath = contextMenu.entry.path;
    const isLastHiddenEntry =
      effectiveHiddenEntryPaths.size === 1 &&
      effectiveHiddenEntryPaths.has(entryPath);
    const nextPaths = new Set(effectiveHiddenEntryPaths);

    nextPaths.delete(entryPath);
    commitHiddenEntryPaths(nextPaths);
    if (isLastHiddenEntry) {
      setShowingHiddenEntriesWorkspaceRoot(null);
    }
    closeContextMenu();
  };

  const submitPendingAction = (): void => {
    const trimmedValue = entryValue.trim();

    if (!pendingAction || trimmedValue.length === 0) {
      return;
    }

    if (pendingAction === "create-file") {
      onCreateFile(
        resolveCreatedEntryPath(actionTargetDirectoryPath, trimmedValue),
      );
    } else if (pendingAction === "create-folder") {
      onCreateFolder(
        resolveCreatedEntryPath(actionTargetDirectoryPath, trimmedValue),
      );
    } else {
      onRenameEntry(trimmedValue);
    }

    clearPendingAction();
  };

  const defaultHiddenEntryPaths =
    state.workspace &&
    workspaceRoot &&
    !defaultHiddenWorkspaceRoots.has(workspaceRoot)
      ? collectDefaultHiddenEntryPaths(state.workspace.tree)
      : [];
  const effectiveHiddenEntryPaths =
    defaultHiddenEntryPaths.length > 0
      ? new Set([...hiddenEntryPaths, ...defaultHiddenEntryPaths])
      : hiddenEntryPaths;
  const hasHiddenEntries = effectiveHiddenEntryPaths.size > 0;
  const selectedDirectoryPath = state.workspace
    ? findDirectoryPath(state.workspace.tree, state.selectedEntryPath)
    : null;
  const isContextEntryHidden = contextMenu
    ? effectiveHiddenEntryPaths.has(contextMenu.entry.path)
    : false;
  const isShowingHiddenEntries =
    Boolean(workspaceRoot) &&
    showingHiddenEntriesWorkspaceRoot === workspaceRoot;
  const shouldShowHiddenEntries = hasHiddenEntries && isShowingHiddenEntries;
  const shouldShowAutoWorkspaceDialog =
    shouldAutoOpenWorkspaceDialog && !hasDismissedAutoWorkspaceDialog;
  const isWorkspaceDialogOpen =
    isWorkspaceDialogManuallyOpen || shouldShowAutoWorkspaceDialog;
  const isFollowingSystemTheme = themePreference.mode === "system";
  const themeDialogColumns = getThemeDialogColumns(
    isFollowingSystemTheme,
    resolvedTheme.family,
  );
  const themeDialogRows = getAppThemeRows();
  const effectiveAiToolId = getEffectiveAiToolId(aiSettings, aiTools);
  const selectedAiTool = effectiveAiToolId
    ? (aiTools.find((tool) => tool.id === effectiveAiToolId) ?? null)
    : null;
  const selectedAiModelName = effectiveAiToolId
    ? (aiSettings.modelNames[effectiveAiToolId] ?? "")
    : "";
  const selectedLanguagePack =
    availableLanguagePacks.find(
      (languagePack) => languagePack.id === selectedLanguageId,
    ) ?? null;
  const selectedCustomLanguagePack =
    selectedLanguagePack && isCustomAppLanguagePack(selectedLanguagePack)
      ? selectedLanguagePack
      : null;
  const isGeneratingAppLanguage = appLanguagePackGenerationMode !== null;
  const canGenerateAppLanguagePack =
    aiTools.length > 0 && Boolean(onGenerateAppLanguagePack);
  const getLanguagePackOptionLabel = (
    languagePack: AppLanguagePack,
  ): string =>
    isCustomAppLanguagePack(languagePack)
      ? text("settings.customLanguageOptionLabel", {
          language: languagePack.label,
        })
      : languagePack.label;
  const workspaceTriggerLabel = state.isOpeningWorkspace
    ? text("workspace.opening")
    : (state.workspace?.name ?? text("workspace.openWorkspace"));
  const workspaceTriggerAriaLabel = state.workspace
    ? text("workspace.manage")
    : text("workspace.openWorkspace");
  const normalizedWorkspaceSearchQuery = workspaceSearchQuery
    .trim()
    .toLowerCase();
  const getWorkspaceResourceTypeText = (
    resourceType: "file" | "workspace",
  ): string =>
    resourceType === "file"
      ? text("workspace.resourceTypeFile")
      : text("workspace.resourceTypeWorkspace");
  const filteredRecentWorkspaces = recentWorkspaces.filter((workspace) => {
    if (normalizedWorkspaceSearchQuery.length === 0) {
      return true;
    }

    const searchableText =
      workspace.type === "file"
        ? `${workspace.name} ${workspace.filePath} ${workspace.rootPath}`
        : `${workspace.name} ${workspace.rootPath}`;

    return searchableText
      .toLowerCase()
      .includes(normalizedWorkspaceSearchQuery);
  });
  const visibleTree = state.workspace
    ? isShowingHiddenEntries
      ? state.workspace.tree
      : filterHiddenNodes(state.workspace.tree, effectiveHiddenEntryPaths)
    : [];
  const globalPathSearchResults =
    globalSearchMode === "path"
      ? searchWorkspacePaths(visibleTree, globalSearchQuery)
      : [];
  const inlineEditor = pendingAction
    ? {
        targetDirectoryPath: actionTargetDirectoryPath,
        targetEntryPath: actionTargetEntryPath,
        type: pendingAction,
        value: entryValue,
      }
    : null;
  const isRecentFilesCollapsed = recentFilesPanelState.isCollapsed;
  const isDeletedDocumentsVisible =
    state.isDeletedDocumentHistoryVisible === true;
  const recentFilesSectionStyle = {
    "--recent-files-height": `${recentFilesPanelState.height}px`,
  } as CSSProperties;
  const beginRecentFilesResize = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    updateRecentFilesHeightFromPointer(event.clientY);
    setIsResizingRecentFiles(true);
  };
  const resizeRecentFilesFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setRecentFilesPanelState((currentState) => ({
        height: clampRecentFilesPanelHeight(currentState.height + 16),
        isCollapsed: false,
      }));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setRecentFilesPanelState((currentState) => ({
        height: clampRecentFilesPanelHeight(currentState.height - 16),
        isCollapsed: false,
      }));
    } else if (event.key === "Home") {
      event.preventDefault();
      setRecentFilesPanelState({
        height: RECENT_FILES_PANEL_HEIGHT_MIN,
        isCollapsed: false,
      });
    } else if (event.key === "End") {
      event.preventDefault();
      setRecentFilesPanelState({
        height: RECENT_FILES_PANEL_HEIGHT_MAX,
        isCollapsed: false,
      });
    }
  };
  const toggleRecentFilesPanel = (): void => {
    const shouldValidateRecentFiles = recentFilesPanelState.isCollapsed;

    setRecentFilesPanelState((currentState) => ({
      ...currentState,
      isCollapsed: !currentState.isCollapsed,
    }));

    if (shouldValidateRecentFiles) {
      void Promise.resolve(onValidateRecentFiles()).catch(() => undefined);
    }
  };
  const toggleDeletedDocumentsPanel = (): void => {
    const nextValue = !isDeletedDocumentsVisible;

    if (nextValue) {
      setDeletedDocumentsExpanded(true);
    }

    void Promise.resolve(
      onSetDeletedDocumentHistoryVisible(nextValue),
    ).catch(() => undefined);
  };
  const selectAiTool = (toolId: AiToolId): void => {
    onAiSettingsChange({
      ...aiSettings,
      selectedToolId: toolId,
    });
  };
  const updateSelectedAiModelName = (modelName: string): void => {
    if (!effectiveAiToolId) {
      return;
    }

    onAiSettingsChange({
      modelNames: {
        ...aiSettings.modelNames,
        [effectiveAiToolId]: modelName,
      },
      selectedToolId: aiSettings.selectedToolId ?? effectiveAiToolId,
    });
  };
  const runAppLanguagePackGeneration = async (
    language: string,
    mode: Exclude<AppLanguagePackGenerationMode, null>,
  ): Promise<void> => {
    const trimmedLanguage = language.trim();

    if (
      trimmedLanguage.length === 0 ||
      isGeneratingAppLanguage ||
      !onGenerateAppLanguagePack
    ) {
      return;
    }

    setAppLanguagePackGenerationMode(mode);
    setLanguagePreferenceMessage(null);
    setLanguagePreferenceErrorMessage(null);

    try {
      await onGenerateAppLanguagePack(trimmedLanguage);
      if (mode === "create") {
        setCustomAppLanguageInput("");
      }
      setLanguagePreferenceMessage(
        text("settings.languagePackReady", { language: trimmedLanguage }),
      );
    } catch (error) {
      setLanguagePreferenceErrorMessage(
        error instanceof Error
          ? error.message
          : text("errors.languagePackGenerationFailed"),
      );
    } finally {
      setAppLanguagePackGenerationMode(null);
    }
  };
  const generateAppLanguagePack = async (): Promise<void> => {
    await runAppLanguagePackGeneration(customAppLanguageInput, "create");
  };
  const updateSelectedAppLanguagePack = async (): Promise<void> => {
    await runAppLanguagePackGeneration(
      selectedCustomLanguagePack?.label ?? "",
      "update",
    );
  };
  const checkForUpdates = async (): Promise<void> => {
    if (!onCheckForUpdates) {
      setSettingsUpdateMessage(text("settings.updatesUnavailable"));
      setSettingsUpdateErrorMessage(null);
      return;
    }

    setIsCheckingForUpdates(true);
    setSettingsUpdateMessage(null);
    setSettingsUpdateErrorMessage(null);

    try {
      const result = await onCheckForUpdates();

      setSettingsUpdateMessage(
        result.updateAvailable && result.update
          ? text("settings.updateAvailable", {
              version: result.update.latestVersion,
            })
          : (result.message ?? text("settings.upToDate")),
      );
    } catch (error) {
      setSettingsUpdateErrorMessage(
        error instanceof Error
          ? error.message
          : text("settings.checkUpdatesFailed"),
      );
    } finally {
      setIsCheckingForUpdates(false);
    }
  };
  const renderThemePanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>{text("settings.themeTitle")}</h3>
        <p>
          {isFollowingSystemTheme
            ? text("settings.systemThemeDescription", {
                family: getThemeFamilyLabel(resolvedTheme.family, text),
              })
            : text("settings.themeDescription")}
        </p>
      </div>
      <div className="settings-control-row">
        <div>
          <span>{text("settings.followSystemAppearance")}</span>
          <span>{text("settings.followSystemDescription")}</span>
        </div>
        <button
          aria-checked={isFollowingSystemTheme}
          aria-label={text("settings.followSystemAppearance")}
          className="theme-system-switch"
          data-component-id={COMPONENT_IDS.settings.themeModeToggle}
          onClick={() => {
            onToggleSystemTheme(!isFollowingSystemTheme);
          }}
          role="switch"
          title={text("settings.followSystemAppearance")}
          type="button"
        >
          <Monitor aria-hidden="true" focusable="false" size={14} />
          <span aria-hidden="true" />
        </button>
      </div>
      <div
        aria-label={text("settings.themeColorways")}
        className="theme-colorway-grid"
        data-component-id={COMPONENT_IDS.settings.themeColorwayGroup}
        data-column-count={themeDialogColumns.length}
        role="radiogroup"
      >
        {themeDialogRows.map((row) => (
          <div
            className="theme-colorway-row"
            data-theme-row={row.id}
            key={row.id}
          >
            <span className="theme-colorway-label">
              {text(THEME_GROUP_LABEL_KEYS[row.id])}
            </span>
            {themeDialogColumns.map((column) => {
              const theme = getThemeForColumn(row, column.id);
              const themeLabel = getThemeLabel(theme, text);
              const themeDescription = getThemeDescription(theme, text);
              const isSelected = resolvedTheme.id === theme.id;

              return (
                <button
                  aria-checked={isSelected}
                  aria-label={`${themeLabel}: ${themeDescription}`}
                  className={[
                    "theme-option-button",
                    isSelected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-component-id={COMPONENT_IDS.settings.themeColorwayOption}
                  data-theme-column={column.id}
                  data-theme-id={theme.id}
                  data-theme-row={row.id}
                  key={theme.id}
                  onClick={() => {
                    onSelectTheme(theme.id);
                  }}
                  role="radio"
                  type="button"
                >
                  <span className="theme-option-check" aria-hidden="true">
                    {isSelected ? (
                      <Check aria-hidden="true" focusable="false" size={13} />
                    ) : null}
                  </span>
                  <span className="theme-option-copy">
                    <span>{themeLabel}</span>
                    <span>{themeDescription}</span>
                  </span>
                  <span className="theme-option-swatches" aria-hidden="true">
                    {theme.swatches.map((swatch) => (
                      <span key={swatch} style={{ backgroundColor: swatch }} />
                    ))}
                  </span>
                  <span className="theme-option-preview" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
  const renderAiPanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>{text("settings.aiTitle")}</h3>
        <p>{text("settings.aiDescription")}</p>
      </div>
      {aiTools.length > 0 && effectiveAiToolId ? (
        <>
          <label className="settings-field">
            <span>{text("settings.aiCli")}</span>
            <select
              aria-label={text("settings.aiCli")}
              data-component-id={COMPONENT_IDS.settings.aiCliSelector}
              onChange={(event) => {
                selectAiTool(event.target.value as AiToolId);
              }}
              value={effectiveAiToolId}
            >
              {aiTools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>{text("settings.defaultModelName")}</span>
            <input
              aria-label={text("settings.defaultModelName")}
              data-component-id={COMPONENT_IDS.settings.defaultModelField}
              onChange={(event) => {
                updateSelectedAiModelName(event.target.value);
              }}
              placeholder={
                selectedAiTool?.id === "claude"
                  ? "claude-sonnet-4-6"
                  : "gpt-5.4"
              }
              type="text"
              value={selectedAiModelName}
            />
          </label>
          <p className="settings-muted-copy">{text("settings.modelHint")}</p>
        </>
      ) : (
        <p className="settings-empty-state">
          {text("errors.aiToolsUnavailable")}
        </p>
      )}
    </div>
  );
  const renderPreferencePanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>{text("settings.preferenceTitle")}</h3>
        <p>{text("settings.preferenceDescription")}</p>
      </div>
      <label className="settings-field">
        <span>{text("settings.language")}</span>
        <select
          aria-label={text("settings.language")}
          data-component-id={COMPONENT_IDS.settings.languageSelector}
          onChange={(event) => {
            setLanguagePreferenceMessage(null);
            setLanguagePreferenceErrorMessage(null);
            onAppLanguageChange(event.target.value);
          }}
          value={selectedLanguageId}
        >
          {availableLanguagePacks.map((languagePack) => (
            <option key={languagePack.id} value={languagePack.id}>
              {getLanguagePackOptionLabel(languagePack)}
            </option>
          ))}
        </select>
      </label>
      <p className="settings-muted-copy">
        {text("settings.languageDescription")}
      </p>
      <div className="settings-section-header settings-section-header-secondary">
        <h3>{text("settings.customLanguageName")}</h3>
        <p>{text("settings.customLanguageDescription")}</p>
      </div>
      {canGenerateAppLanguagePack ? (
        <form
          className="settings-custom-language-form"
          onSubmit={(event) => {
            event.preventDefault();
            void generateAppLanguagePack();
          }}
        >
          <label className="settings-field">
            <span>{text("settings.customLanguageName")}</span>
            <input
              aria-label={text("settings.customLanguageName")}
              data-component-id={COMPONENT_IDS.settings.customLanguagePackField}
              onChange={(event) => {
                setCustomAppLanguageInput(event.target.value);
              }}
              placeholder={text("settings.customLanguagePlaceholder")}
              type="text"
              value={customAppLanguageInput}
            />
          </label>
          <button
            className="settings-primary-button"
            data-component-id={COMPONENT_IDS.settings.generateLanguagePackButton}
            disabled={
              isGeneratingAppLanguage ||
              customAppLanguageInput.trim().length === 0
            }
            type="submit"
          >
            <Languages aria-hidden="true" focusable="false" size={15} />
            <span>
              {appLanguagePackGenerationMode === "create"
                ? text("settings.generatingLanguagePack")
                : text("settings.customLanguageAction")}
            </span>
          </button>
        </form>
      ) : (
        <p className="settings-empty-state">
          {text("settings.noAiToolsForLanguage")}
        </p>
      )}
      {selectedCustomLanguagePack && canGenerateAppLanguagePack ? (
        <div className="settings-custom-language-update">
          <p className="settings-muted-copy">
            {text("settings.updateCustomLanguageDescription")}
          </p>
          <button
            className="settings-primary-button"
            disabled={isGeneratingAppLanguage}
            onClick={() => {
              void updateSelectedAppLanguagePack();
            }}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={
                appLanguagePackGenerationMode === "update"
                  ? "is-spinning"
                  : undefined
              }
              focusable="false"
              size={15}
            />
            <span>
              {appLanguagePackGenerationMode === "update"
                ? text("settings.updatingLanguagePack")
                : text("settings.updateCustomLanguageAction")}
            </span>
          </button>
        </div>
      ) : null}
      {languagePreferenceMessage ? (
        <p className="settings-status-message" role="status">
          {languagePreferenceMessage}
        </p>
      ) : null}
      {languagePreferenceErrorMessage ? (
        <p className="settings-error-message" role="alert">
          {languagePreferenceErrorMessage}
        </p>
      ) : null}
    </div>
  );
  const renderUpdatePanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>{text("settings.updateTitle")}</h3>
        <p>{text("settings.updateDescription")}</p>
      </div>
      <dl className="settings-version-list">
        <div>
          <dt>{text("settings.currentVersion")}</dt>
          <dd>{appVersion}</dd>
        </div>
      </dl>
      <button
        aria-label={text("settings.checkForUpdates")}
        className="settings-primary-button"
        data-component-id={COMPONENT_IDS.settings.checkUpdatesButton}
        disabled={isCheckingForUpdates}
        onClick={() => {
          void checkForUpdates();
        }}
        type="button"
      >
        <RefreshCw
          aria-hidden="true"
          className={isCheckingForUpdates ? "is-spinning" : undefined}
          focusable="false"
          size={15}
        />
        <span>
          {isCheckingForUpdates
            ? text("settings.checkingForUpdates")
            : text("settings.checkForUpdates")}
        </span>
      </button>
      {settingsUpdateMessage ? (
        <p className="settings-status-message" role="status">
          {settingsUpdateMessage}
        </p>
      ) : null}
      {settingsUpdateErrorMessage ? (
        <p className="settings-error-message" role="alert">
          {settingsUpdateErrorMessage}
        </p>
      ) : null}
    </div>
  );
  const renderSettingsPanel = (): React.JSX.Element => {
    if (activeSettingsPanel === "ai") {
      return renderAiPanel();
    }

    if (activeSettingsPanel === "updates") {
      return renderUpdatePanel();
    }

    if (activeSettingsPanel === "preferences") {
      return renderPreferencePanel();
    }

    return renderThemePanel();
  };
  const renderSettingsDialog = (): React.JSX.Element | null =>
    isSettingsDialogOpen ? (
      <div className="workspace-dialog-backdrop" onClick={closeSettingsDialog}>
        <div
          aria-label={text("settings.title")}
          aria-modal="true"
          className="workspace-dialog settings-dialog"
          data-component-id={COMPONENT_IDS.settings.dialog}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeSettingsDialog();
            }
          }}
          role="dialog"
        >
          <div className="workspace-dialog-header">
            <div className="workspace-dialog-heading">
              <div className="workspace-dialog-mark" aria-hidden="true">
                MDE
              </div>
              <div className="workspace-dialog-title-group">
                <h2 className="workspace-dialog-title">
                  {text("settings.title")}
                </h2>
                <p className="workspace-dialog-subtitle">
                  {text("settings.subtitle")}
                </p>
              </div>
            </div>
            <button
              aria-label={text("settings.close")}
              className="explorer-icon-button workspace-dialog-close"
              onClick={closeSettingsDialog}
              title={text("settings.close")}
              type="button"
            >
              <X aria-hidden="true" focusable="false" size={16} />
            </button>
          </div>
          <div className="settings-dialog-layout">
            <nav
              className="settings-nav"
              aria-label={text("settings.nav")}
              data-component-id={COMPONENT_IDS.settings.nav}
            >
              <button
                aria-current={activeSettingsPanel === "ai" ? "page" : undefined}
                data-component-id={COMPONENT_IDS.settings.navItem}
                onClick={() => {
                  setActiveSettingsPanel("ai");
                }}
                type="button"
              >
                <Bot aria-hidden="true" focusable="false" size={16} />
                <span>{text("settings.aiTitle")}</span>
              </button>
              <button
                aria-current={
                  activeSettingsPanel === "preferences" ? "page" : undefined
                }
                data-component-id={COMPONENT_IDS.settings.navItem}
                onClick={() => {
                  setActiveSettingsPanel("preferences");
                }}
                type="button"
              >
                <Languages aria-hidden="true" focusable="false" size={16} />
                <span>{text("settings.preferenceTitle")}</span>
              </button>
              <button
                aria-current={
                  activeSettingsPanel === "theme" ? "page" : undefined
                }
                data-component-id={COMPONENT_IDS.settings.navItem}
                onClick={() => {
                  setActiveSettingsPanel("theme");
                }}
                type="button"
              >
                <Paintbrush aria-hidden="true" focusable="false" size={16} />
                <span>{text("settings.themeTitle")}</span>
              </button>
              <button
                aria-current={
                  activeSettingsPanel === "updates" ? "page" : undefined
                }
                data-component-id={COMPONENT_IDS.settings.navItem}
                onClick={() => {
                  setActiveSettingsPanel("updates");
                }}
                type="button"
              >
                <RefreshCw aria-hidden="true" focusable="false" size={16} />
                <span>{text("settings.updateTitle")}</span>
              </button>
            </nav>
            <section
              aria-label={text("settings.panelLabel", {
                panel: text(
                  activeSettingsPanel === "ai"
                    ? "settings.aiTitle"
                    : activeSettingsPanel === "preferences"
                      ? "settings.preferenceTitle"
                      : activeSettingsPanel === "updates"
                        ? "settings.updateTitle"
                        : "settings.themeTitle",
                ),
              })}
              className="settings-panel"
              data-component-id={COMPONENT_IDS.settings.panel}
            >
              {renderSettingsPanel()}
            </section>
          </div>
        </div>
      </div>
    ) : null;
  const settingsControls = (
    <div
      className="explorer-theme-footer"
      aria-label={text("settings.controls")}
    >
      <button
        aria-label={text("settings.open")}
        className="explorer-icon-button explorer-footer-settings-button"
        data-component-id={COMPONENT_IDS.settings.button}
        onClick={() => {
          openSettingsDialog("ai");
        }}
        title={text("settings.open")}
        type="button"
      >
        <Settings aria-hidden="true" focusable="false" size={16} />
      </button>
      <button
        aria-label={text("settings.changeTheme")}
        className="theme-selector-button"
        data-component-id={COMPONENT_IDS.settings.themeSelectorButton}
        onClick={() => {
          openSettingsDialog("theme");
        }}
        title={text("settings.changeTheme")}
        type="button"
      >
        <span className="theme-selector-icon" aria-hidden="true">
          <Paintbrush aria-hidden="true" focusable="false" size={15} />
        </span>
        <span className="theme-selector-copy">
          <span>{text("settings.themeFooterLabel")}</span>
          <span>{getThemeLabel(resolvedTheme, text)}</span>
        </span>
        <span className="theme-selector-swatches" aria-hidden="true">
          {resolvedTheme.swatches.map((swatch) => (
            <span key={swatch} style={{ backgroundColor: swatch }} />
          ))}
        </span>
        <ChevronDown aria-hidden="true" focusable="false" size={14} />
      </button>
    </div>
  );

  if (isCollapsed) {
    return (
      <aside
        className="explorer-pane is-collapsed"
        aria-label={text("explorer.header")}
        data-component-id={COMPONENT_IDS.explorer.pane}
      >
        <button
          aria-label={text("explorer.expandSidebar")}
          className="explorer-icon-button explorer-sidebar-toggle"
          onClick={onToggleCollapsed}
          title={text("explorer.expandSidebar")}
          type="button"
        >
          <PanelLeftOpen aria-hidden="true" focusable="false" size={17} />
        </button>
        <button
          aria-label={text("settings.open")}
          className="explorer-icon-button explorer-collapsed-theme-button"
          data-component-id={COMPONENT_IDS.settings.button}
          onClick={() => {
            openSettingsDialog("theme");
          }}
          title={text("settings.open")}
          type="button"
        >
          <Settings aria-hidden="true" focusable="false" size={16} />
        </button>
        {renderSettingsDialog()}
      </aside>
    );
  }

  return (
    <aside
      className="explorer-pane"
      aria-label={text("explorer.header")}
      data-component-id={COMPONENT_IDS.explorer.pane}
    >
      <div className="explorer-header-row">
        <div
          className="explorer-header"
          data-component-id={COMPONENT_IDS.explorer.header}
        >
          {text("explorer.header")}
        </div>
        <button
          aria-label={text("explorer.collapseSidebar")}
          className="explorer-icon-button explorer-sidebar-toggle"
          onClick={onToggleCollapsed}
          title={text("explorer.collapseSidebar")}
          type="button"
        >
          <PanelLeftClose aria-hidden="true" focusable="false" size={17} />
        </button>
      </div>
      <button
        aria-expanded={isWorkspaceDialogOpen}
        aria-haspopup="dialog"
        aria-label={workspaceTriggerAriaLabel}
        className="workspace-manager-button workspace-item-button"
        data-component-id={COMPONENT_IDS.workspace.managerTrigger}
        disabled={state.isOpeningWorkspace}
        onClick={toggleWorkspaceDialog}
        type="button"
      >
        <span>{workspaceTriggerLabel}</span>
        {state.workspace ? <span>{state.workspace.rootPath}</span> : null}
      </button>
      {isWorkspaceDialogOpen ? (
        <div
          className="workspace-dialog-backdrop"
          onClick={closeWorkspaceDialog}
        >
          <div
            aria-label={text("workspace.manager")}
            aria-modal="true"
            className="workspace-dialog"
            data-component-id={COMPONENT_IDS.workspace.managerDialog}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeWorkspaceDialog();
              }
            }}
            role="dialog"
          >
            <div className="workspace-dialog-header">
              <div className="workspace-dialog-heading">
                <div className="workspace-dialog-mark" aria-hidden="true">
                  MDE
                </div>
                <div className="workspace-dialog-title-group">
                  <h2 className="workspace-dialog-title">
                    {state.workspace
                      ? text("workspace.workspaces")
                      : text("workspace.openWorkspace")}
                  </h2>
                  <p className="workspace-dialog-subtitle">
                    {text("workspace.subtitle")}
                  </p>
                </div>
              </div>
              <button
                aria-label={text("workspace.closePopup")}
                className="explorer-icon-button workspace-dialog-close"
                onClick={closeWorkspaceDialog}
                title={text("workspace.closePopup")}
                type="button"
              >
                <X aria-hidden="true" focusable="false" size={16} />
              </button>
            </div>
            <div className="workspace-dialog-content">
              <div className="workspace-primary-actions">
                  <button
                    className="workspace-item-button workspace-action-button"
                    data-component-id={COMPONENT_IDS.workspace.openWorkspaceAction}
                    onClick={() => {
                    closeWorkspaceDialog();
                    onOpenWorkspace();
                  }}
                  type="button"
                >
                  <span className="workspace-action-icon" aria-hidden="true">
                    <FolderOpen
                      aria-hidden="true"
                      focusable="false"
                      size={18}
                    />
                  </span>
                  <span className="workspace-action-copy">
                    <span>{text("workspace.actionOpenWorkspaceTitle")}</span>
                    <span>{text("workspace.actionOpenWorkspaceSubtitle")}</span>
                  </span>
                </button>
                  <button
                    className="workspace-item-button workspace-action-button"
                    data-component-id={COMPONENT_IDS.workspace.openMarkdownFileAction}
                    onClick={() => {
                    closeWorkspaceDialog();
                    onOpenFile();
                  }}
                  type="button"
                >
                  <span className="workspace-action-icon" aria-hidden="true">
                    <FileText aria-hidden="true" focusable="false" size={18} />
                  </span>
                  <span className="workspace-action-copy">
                    <span>{text("workspace.actionOpenFileTitle")}</span>
                    <span>{text("workspace.actionOpenFileSubtitle")}</span>
                  </span>
                </button>
              </div>
              <div className="workspace-recent-header">
                <div className="workspace-section-title">
                  {text("workspace.recent")}
                </div>
                <label className="workspace-search-field">
                  <span className="visually-hidden">
                    {text("workspace.searchResources")}
                  </span>
                  <input
                    data-component-id={
                      COMPONENT_IDS.workspace.recentResourceSearchField
                    }
                    onChange={(event) => {
                      setWorkspaceSearchQuery(event.target.value);
                    }}
                    placeholder={text("common.search")}
                    role="searchbox"
                    type="text"
                    value={workspaceSearchQuery}
                  />
                </label>
              </div>
              {recentWorkspaces.length > 0 ? (
                <div
                  aria-label={text("workspace.recentResources")}
                  className="workspace-resource-list"
                  data-component-id={COMPONENT_IDS.workspace.recentResourceList}
                >
                  {filteredRecentWorkspaces.length > 0 ? (
                    filteredRecentWorkspaces.map((workspace) => {
                      const resourceType =
                        workspace.type === "file" ? "file" : "workspace";
                      const resourcePath =
                        workspace.type === "file"
                          ? workspace.filePath
                          : workspace.rootPath;

                      return (
                        <div
                          className="workspace-resource-row"
                          data-component-id={COMPONENT_IDS.workspace.recentResourceRow}
                          key={`${resourceType}:${resourcePath}`}
                        >
                          <button
                            aria-label={text("workspace.switchToResource", {
                              name: workspace.name,
                              resourceType:
                                getWorkspaceResourceTypeText(resourceType),
                            })}
                            className="workspace-item-button workspace-resource-button"
                            onClick={() => {
                              closeWorkspaceDialog();
                              onSwitchWorkspace(workspace);
                            }}
                            type="button"
                          >
                            <span className="workspace-resource-main">
                              {workspace.name}
                            </span>
                            <span className="workspace-resource-meta">
                              {resourcePath}
                            </span>
                          </button>
                          <div
                            aria-label={text("workspace.resourceActions", {
                              name: workspace.name,
                            })}
                            className="workspace-resource-actions"
                          >
                            <button
                              aria-label={text(
                                "workspace.openFileInNewWindow",
                                {
                                  name: workspace.name,
                                  resourceType:
                                    getWorkspaceResourceTypeText(resourceType),
                                },
                              )}
                              className="explorer-icon-button workspace-resource-action workspace-resource-open-window"
                              data-component-id={
                                COMPONENT_IDS.workspace.openResourceInNewWindowButton
                              }
                              onClick={() => {
                                onOpenWorkspaceInNewWindow(workspace);
                              }}
                              title={text("workspace.openResourceInNewWindow", {
                                resourceType:
                                  getWorkspaceResourceTypeText(resourceType),
                              })}
                              type="button"
                            >
                              <ExternalLink
                                aria-hidden="true"
                                focusable="false"
                                size={14}
                              />
                            </button>
                            <button
                              aria-label={text(
                                "workspace.removeRecentResource",
                                {
                                  name: workspace.name,
                                  resourceType:
                                    getWorkspaceResourceTypeText(resourceType),
                                },
                              )}
                              className="explorer-icon-button workspace-resource-action workspace-resource-delete"
                              data-component-id={
                                COMPONENT_IDS.workspace.forgetRecentResourceButton
                              }
                              onClick={() => {
                                onForgetWorkspace(workspace);
                              }}
                              title={text(
                                "workspace.removeRecentResourceTitle",
                                {
                                  resourceType:
                                    getWorkspaceResourceTypeText(resourceType),
                                },
                              )}
                              type="button"
                            >
                              <Trash2
                                aria-hidden="true"
                                focusable="false"
                                size={14}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="workspace-dialog-empty">
                      {text("workspace.noMatchingResources")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="workspace-dialog-empty">
                  {text("workspace.noRecentResources")}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {state.errorMessage ? (
        <p className="explorer-error" role="alert">
          {state.errorMessage}
        </p>
      ) : null}
      {state.workspace ? (
        <div className="explorer-workspace">
          <div
            className="explorer-toolbar"
            aria-label={text("explorer.toolbar")}
            data-component-id={COMPONENT_IDS.explorer.toolbar}
          >
            <button
              aria-label={text("explorer.searchWorkspaceContents")}
              className="explorer-icon-button"
              data-component-id={COMPONENT_IDS.explorer.workspaceSearchButton}
              disabled={!state.workspace}
              onClick={() => {
                openGlobalSearch("content");
              }}
              title={globalSearchButtonTitle}
              type="button"
            >
              <Search aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label={text("explorer.newMarkdownFile")}
              className="explorer-icon-button"
              data-component-id={COMPONENT_IDS.explorer.newMarkdownFileButton}
              onClick={() => {
                beginAction(
                  "create-file",
                  text("explorer.newMarkdownFileDefaultName"),
                  selectedDirectoryPath,
                );
              }}
              title={text("explorer.newMarkdownFile")}
              type="button"
            >
              <FilePlus aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label={text("explorer.newFolder")}
              className="explorer-icon-button"
              data-component-id={COMPONENT_IDS.explorer.newFolderButton}
              onClick={() => {
                beginAction(
                  "create-folder",
                  text("explorer.newFolderDefaultName"),
                  selectedDirectoryPath,
                );
              }}
              title={text("explorer.newFolder")}
              type="button"
            >
              <FolderPlus aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label={text("history.recoverDeletedDocuments")}
              className="explorer-icon-button"
              data-component-id={
                COMPONENT_IDS.explorer.recoverDeletedDocumentsButton
              }
              onClick={toggleDeletedDocumentsPanel}
              title={text("history.recoverDeletedDocuments")}
              type="button"
            >
              <ArchiveRestore aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label={
                shouldShowHiddenEntries
                  ? text("explorer.hideHiddenEntries")
                  : text("explorer.showHiddenEntries")
              }
              aria-pressed={shouldShowHiddenEntries}
              className="explorer-icon-button"
              data-component-id={COMPONENT_IDS.explorer.showHiddenEntriesButton}
              disabled={!hasHiddenEntries}
              onClick={() => {
                setShowingHiddenEntriesWorkspaceRoot((currentWorkspaceRoot) =>
                  currentWorkspaceRoot === workspaceRoot ? null : workspaceRoot,
                );
              }}
              title={
                shouldShowHiddenEntries
                  ? text("explorer.hideHiddenEntries")
                  : text("explorer.showHiddenEntries")
              }
              type="button"
            >
              {shouldShowHiddenEntries ? (
                <EyeOff aria-hidden="true" focusable="false" size={16} />
              ) : (
                <Eye aria-hidden="true" focusable="false" size={16} />
              )}
            </button>
            <button
              aria-label={text("explorer.refresh")}
              className="explorer-icon-button"
              data-component-id={COMPONENT_IDS.explorer.refreshButton}
              onClick={() => {
                refreshDirectoryPaths(expandedDirectoryPaths, true);
              }}
              title={text("explorer.refresh")}
              type="button"
            >
              <RefreshCw aria-hidden="true" focusable="false" size={16} />
            </button>
          </div>
          {deleteConfirmation && state.selectedEntryPath ? (
            <div
              className="explorer-delete-confirmation"
              data-component-id={COMPONENT_IDS.explorer.deleteConfirmationPopover}
              style={
                {
                  "--delete-confirmation-x": `${deleteConfirmation.x}px`,
                  "--delete-confirmation-y": `${deleteConfirmation.y}px`,
                } as CSSProperties
              }
            >
              <p>
                {text("explorer.deleteEntryPrompt", {
                  path: state.selectedEntryPath,
                })}
              </p>
              <button
                onClick={() => {
                  onDeleteEntry();
                  setDeleteConfirmation(null);
                }}
                type="button"
              >
                {text("explorer.confirmDelete")}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmation(null);
                }}
                type="button"
              >
                {text("common.cancel")}
              </button>
            </div>
          ) : null}
          <div className="explorer-content" ref={workspaceContentRef}>
            <section
              className="explorer-files-section"
              aria-label={text("explorer.files")}
            >
              <ExplorerTree
                expandedDirectoryPaths={expandedDirectoryPaths}
                inlineEditor={inlineEditor}
                key={state.workspace.rootPath}
                locateFilePath={activeLocateFileRequest?.path ?? null}
                locateFileRequestId={activeLocateFileRequest?.id ?? 0}
                nodes={visibleTree}
                onDirectoryExpandedChange={changeDirectoryExpansion}
                onInlineEditorCancel={clearPendingAction}
                onInlineEditorChange={setEntryValue}
                onInlineEditorSubmit={submitPendingAction}
                onOpenEntryMenu={({ clientX, clientY, entry }) => {
                  onSelectEntry(entry.path);
                  setContextMenu({ entry, x: clientX, y: clientY });
                  closeWorkspaceDialog();
                }}
                onSelectEntry={onSelectEntry}
                onSelectFile={onSelectFile}
                selectedEntryPath={state.selectedEntryPath}
                selectedFilePath={state.selectedFilePath}
                text={text}
              />
              {contextMenu ? (
                <div
                  aria-label={`${contextMenu.entry.name} actions`}
                  className="explorer-context-menu"
                  data-component-id={COMPONENT_IDS.explorer.contextMenu}
                  role="menu"
                  style={
                    {
                      "--context-menu-x": `${contextMenu.x}px`,
                      "--context-menu-y": `${contextMenu.y}px`,
                    } as CSSProperties
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {contextMenu.entry.type === "directory" ? (
                    <>
                      <button
                        data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                        onClick={beginContextCreateFile}
                        role="menuitem"
                        type="button"
                      >
                        <FilePlus
                          aria-hidden="true"
                          focusable="false"
                          size={14}
                        />
                        <span>{text("explorer.newMarkdownFile")}</span>
                      </button>
                      <button
                        data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                        onClick={beginContextCreateFolder}
                        role="menuitem"
                        type="button"
                      >
                        <FolderPlus
                          aria-hidden="true"
                          focusable="false"
                          size={14}
                        />
                        <span>{text("explorer.newFolder")}</span>
                      </button>
                    </>
                  ) : null}
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={copyContextEntry}
                    role="menuitem"
                    type="button"
                  >
                    <Copy aria-hidden="true" focusable="false" size={14} />
                    <span>{text("explorer.copyEntry")}</span>
                  </button>
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={pasteIntoContextEntry}
                    role="menuitem"
                    type="button"
                  >
                    <ClipboardPaste
                      aria-hidden="true"
                      focusable="false"
                      size={14}
                    />
                    <span>{text("explorer.pasteEntry")}</span>
                  </button>
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={() => {
                      copyContextEntryPath("relative");
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Copy aria-hidden="true" focusable="false" size={14} />
                    <span>{text("explorer.copyRelativePath")}</span>
                  </button>
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={() => {
                      copyContextEntryPath("absolute");
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Copy aria-hidden="true" focusable="false" size={14} />
                    <span>{text("explorer.copyAbsolutePath")}</span>
                  </button>
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={beginContextRename}
                    role="menuitem"
                    type="button"
                  >
                    <Pencil aria-hidden="true" focusable="false" size={14} />
                    <span>{text("common.rename")}</span>
                  </button>
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={
                      isContextEntryHidden ? showContextEntry : hideContextEntry
                    }
                    role="menuitem"
                    type="button"
                  >
                    {isContextEntryHidden ? (
                      <Eye aria-hidden="true" focusable="false" size={14} />
                    ) : (
                      <EyeOff aria-hidden="true" focusable="false" size={14} />
                    )}
                    <span>
                      {isContextEntryHidden
                        ? text("common.show")
                        : text("common.hide")}
                    </span>
                  </button>
                  <button
                    data-component-id={COMPONENT_IDS.explorer.contextMenuItem}
                    onClick={beginContextDelete}
                    role="menuitem"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" focusable="false" size={14} />
                    <span>{text("common.delete")}</span>
                  </button>
                </div>
              ) : null}
            </section>
            {!isRecentFilesCollapsed ? (
              <div
                aria-label={text("explorer.resizeRecentFilesPanel")}
                aria-orientation="horizontal"
                aria-valuemax={RECENT_FILES_PANEL_HEIGHT_MAX}
                aria-valuemin={RECENT_FILES_PANEL_HEIGHT_MIN}
                aria-valuenow={recentFilesPanelState.height}
                className="explorer-panel-resize-handle"
                data-component-id={COMPONENT_IDS.explorer.recentFilesResizeHandle}
                onKeyDown={resizeRecentFilesFromKeyboard}
                onPointerDown={beginRecentFilesResize}
                role="separator"
                tabIndex={0}
              />
            ) : null}
            <section
              aria-label={text("explorer.recentFiles")}
              className={[
                "explorer-recent-files-section",
                isRecentFilesCollapsed ? "is-collapsed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-component-id={COMPONENT_IDS.explorer.recentFilesPanel}
              style={recentFilesSectionStyle}
            >
              <button
                aria-expanded={!isRecentFilesCollapsed}
                className="explorer-section-header-button"
                onClick={toggleRecentFilesPanel}
                type="button"
              >
                {isRecentFilesCollapsed ? (
                  <ChevronRight
                    aria-hidden="true"
                    focusable="false"
                    size={14}
                  />
                ) : (
                  <ChevronDown aria-hidden="true" focusable="false" size={14} />
                )}
                <span>{text("explorer.recentFiles")}</span>
                <span>{recentFilePaths.length}</span>
              </button>
              {!isRecentFilesCollapsed ? (
                recentFilePaths.length > 0 ? (
                  <div
                    aria-label={text("explorer.recentFileList")}
                    className="explorer-recent-file-list"
                  >
                    {recentFilePaths.map((filePath) => (
                      <button
                        aria-label={text("explorer.openRecentFile", {
                          path: filePath,
                        })}
                        className="explorer-recent-file-button"
                        data-component-id={COMPONENT_IDS.explorer.recentFileRow}
                        key={filePath}
                        onClick={() => {
                          onOpenRecentFile(filePath);
                        }}
                        type="button"
                      >
                        <FileText
                          aria-hidden="true"
                          focusable="false"
                          size={14}
                        />
                        <span>{getEntryName(filePath)}</span>
                        <span>{filePath}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="explorer-recent-empty">
                    {text("explorer.noRecentFiles")}
                  </p>
                )
              ) : null}
            </section>
            {isDeletedDocumentsVisible ? (
              <section
                aria-label={text("history.deletedDocuments")}
                className="explorer-deleted-documents-section"
                data-component-id={COMPONENT_IDS.explorer.deletedDocumentsPanel}
              >
                <button
                  aria-expanded={isDeletedDocumentsExpanded}
                  className="explorer-section-header-button"
                  onClick={() => {
                    setDeletedDocumentsExpanded((currentValue) => !currentValue);
                  }}
                  type="button"
                >
                  {isDeletedDocumentsExpanded ? (
                    <ChevronDown
                      aria-hidden="true"
                      focusable="false"
                      size={14}
                    />
                  ) : (
                    <ChevronRight
                      aria-hidden="true"
                      focusable="false"
                      size={14}
                    />
                  )}
                  <span>{text("history.deletedDocuments")}</span>
                  <span>{deletedDocumentHistory.length}</span>
                </button>
                {isDeletedDocumentsExpanded ? (
                  deletedDocumentHistory.length > 0 ? (
                    <div className="explorer-deleted-document-list">
                      {deletedDocumentHistory.map((entry) => (
                        <button
                          aria-label={text("history.openDeletedDocument", {
                            path: entry.path,
                          })}
                          className="explorer-deleted-document-button"
                          data-component-id={
                            COMPONENT_IDS.explorer.deletedDocumentRow
                          }
                          key={entry.documentId}
                          onClick={() => {
                            onSelectDeletedDocumentHistoryEntry(entry);
                          }}
                          type="button"
                        >
                          <ArchiveRestore
                            aria-hidden="true"
                            focusable="false"
                            size={14}
                          />
                          <span>{getEntryName(entry.path)}</span>
                          <span>{entry.path}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="explorer-recent-empty">
                      {text("history.noDeletedDocuments")}
                    </p>
                  )
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="explorer-empty">{text("explorer.empty")}</p>
      )}
      {isGlobalSearchOpen ? (
        <div
          className="workspace-dialog-backdrop global-search-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeGlobalSearch();
            }
          }}
        >
          <section
            aria-label={text("globalSearch.title")}
            className="global-search-dialog"
            data-component-id={COMPONENT_IDS.search.workspaceSearchDialog}
            role="dialog"
          >
            <div
              className="global-search-input-shell"
              onBlur={(event) => {
                const nextFocusedElement = event.relatedTarget;

                if (
                  nextFocusedElement instanceof Node &&
                  event.currentTarget.contains(nextFocusedElement)
                ) {
                  return;
                }

                setIsGlobalSearchHistoryOpen(false);
              }}
            >
              <form
                aria-label={text("explorer.searchWorkspaceContents")}
                className="global-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (globalSearchMode === "path") {
                    const firstPathResult = globalPathSearchResults[0];

                    if (firstPathResult) {
                      onSelectFile(firstPathResult.path);
                      closeGlobalSearch();
                    }

                    return;
                  }

                  rememberGlobalSearchQuery(globalSearchQuery);
                  setIsGlobalSearchHistoryOpen(false);
                }}
              >
                <Search aria-hidden="true" focusable="false" size={18} />
                <input
                  aria-label={
                    globalSearchMode === "path"
                      ? text("globalSearch.pathInput")
                      : text("explorer.searchWorkspaceContents")
                  }
                  data-component-id={COMPONENT_IDS.search.workspaceSearchField}
                  onChange={(event) => {
                    const nextQuery = event.target.value;

                    setGlobalSearchQuery(nextQuery);
                    setIsGlobalSearchHistoryOpen(globalSearchMode === "content");
                    if (
                      nextQuery.trim().length === 0 ||
                      globalSearchMode === "path"
                    ) {
                      setGlobalSearchResult(null);
                      setGlobalSearchErrorMessage(null);
                      setIsGlobalSearchLoading(false);
                    } else {
                      setGlobalSearchErrorMessage(null);
                      setIsGlobalSearchLoading(true);
                    }
                  }}
                  onFocus={() => {
                    setIsGlobalSearchHistoryOpen(globalSearchMode === "content");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeGlobalSearch();
                    }
                  }}
                  placeholder={
                    globalSearchMode === "path"
                      ? text("globalSearch.pathPlaceholder")
                      : text("globalSearch.placeholder")
                  }
                  ref={globalSearchInputRef}
                  role="searchbox"
                  type="text"
                  value={globalSearchQuery}
                />
                <div
                  aria-label={text("globalSearch.modeGroup")}
                  className="global-search-mode-switch"
                  role="radiogroup"
                >
                  <button
                    aria-checked={globalSearchMode === "content"}
                    aria-label={text("globalSearch.contentMode")}
                    className="global-search-mode-button"
                    onClick={() => {
                      setActiveGlobalSearchMode("content");
                      globalSearchInputRef.current?.focus();
                    }}
                    role="radio"
                    title={globalSearchContentModeTitle}
                    type="button"
                  >
                    <Search aria-hidden="true" focusable="false" size={14} />
                  </button>
                  <button
                    aria-checked={globalSearchMode === "path"}
                    aria-label={text("globalSearch.pathMode")}
                    className="global-search-mode-button"
                    onClick={() => {
                      setActiveGlobalSearchMode("path");
                      globalSearchInputRef.current?.focus();
                    }}
                    role="radio"
                    title={globalSearchPathModeTitle}
                    type="button"
                  >
                    <AtSign aria-hidden="true" focusable="false" size={15} />
                  </button>
                </div>
                <button
                  aria-label={text("globalSearch.close")}
                  onClick={closeGlobalSearch}
                  type="button"
                >
                  <X aria-hidden="true" focusable="false" size={16} />
                </button>
              </form>
              {globalSearchMode === "content" &&
              isGlobalSearchHistoryOpen &&
              visibleGlobalSearchHistory.length > 0 ? (
                <div
                  aria-label={text("globalSearch.history")}
                  className="global-search-history global-search-history-tags"
                  data-component-id={
                    COMPONENT_IDS.search.workspaceSearchHistoryTags
                  }
                  role="listbox"
                >
                  <div className="global-search-history-kicker">
                    <strong>{globalSearchHistoryHeading}</strong>
                    <span>
                      {text("globalSearch.historyLimit", {
                        count: String(GLOBAL_SEARCH_HISTORY_LIMIT),
                      })}
                    </span>
                  </div>
                  <div className="global-search-history-tag-row">
                    {visibleGlobalSearchHistory.map((historyItem) => (
                      <button
                        aria-label={text("globalSearch.useHistoryItem", {
                          query: historyItem,
                        })}
                      className="global-search-history-tag"
                      data-component-id={COMPONENT_IDS.search.historyTag}
                      key={historyItem}
                        onClick={() => {
                          setGlobalSearchQuery(historyItem);
                          setGlobalSearchResult(null);
                          setGlobalSearchErrorMessage(null);
                          setIsGlobalSearchLoading(true);
                          setIsGlobalSearchHistoryOpen(true);
                          globalSearchInputRef.current?.focus();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        type="button"
                      >
                        <Search
                          aria-hidden="true"
                          focusable="false"
                          size={13}
                        />
                        <span>{historyItem}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="global-search-results" role="list">
              {globalSearchMode === "path" &&
              globalPathSearchResults.length > 0 ? (
                globalPathSearchResults.map((result: WorkspacePathSearchResult) => (
                  <button
                    aria-label={text("globalSearch.openPathResult", {
                      path: result.path,
                    })}
                    className="global-search-result global-search-path-result"
                    key={result.path}
                    onClick={() => {
                      onSelectFile(result.path);
                      closeGlobalSearch();
                    }}
                    type="button"
                  >
                    <span>{result.name}</span>
                    <span>{result.path}</span>
                    <span>{text("globalSearch.pathResultType")}</span>
                    <span>
                      {renderHighlightedSearchText(result.path, globalSearchQuery)}
                    </span>
                  </button>
                ))
              ) : globalSearchErrorMessage ? (
                <p className="global-search-message" role="alert">
                  {globalSearchErrorMessage}
                </p>
              ) : isGlobalSearchLoading ? (
                <p className="global-search-message" role="status">
                  {text("globalSearch.searching")}
                </p>
              ) : globalSearchResult &&
                globalSearchResult.results.length > 0 ? (
                globalSearchResult.results.map((result) =>
                  result.matches.map((match) => (
                    <button
                      aria-label={text("globalSearch.openResult", {
                        lineNumber: match.lineNumber,
                        path: result.path,
                      })}
                      className="global-search-result"
                      data-component-id={
                        COMPONENT_IDS.search.workspaceSearchResultRow
                      }
                      key={`${result.path}:${match.lineNumber}:${match.columnNumber}`}
                      onClick={() => {
                        rememberGlobalSearchQuery(globalSearchResult.query);
                        onOpenWorkspaceSearchResult(
                          result.path,
                          globalSearchResult.query,
                        );
                        closeGlobalSearch();
                      }}
                      type="button"
                    >
                      <span>{getEntryName(result.path)}</span>
                      <span>{result.path}</span>
                      <span>
                        {text("globalSearch.lineColumn", {
                          columnNumber: match.columnNumber,
                          lineNumber: match.lineNumber,
                        })}
                        {match.kind === "metadata"
                          ? ` · ${text("globalSearch.metadataMatch")}`
                          : ""}
                      </span>
                      <span data-component-id={COMPONENT_IDS.search.resultSnippet}>
                        {renderHighlightedSearchText(
                          match.preview,
                          globalSearchResult.query,
                        )}
                      </span>
                    </button>
                  )),
                )
              ) : globalSearchQuery.trim().length > 0 ? (
                <p className="global-search-message">
                  {text("globalSearch.noResults")}
                </p>
              ) : (
                <p className="global-search-message">
                  {globalSearchMode === "path"
                    ? text("globalSearch.pathDescription")
                    : text("globalSearch.description")}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {settingsControls}
      {renderSettingsDialog()}
    </aside>
  );
};
