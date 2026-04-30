import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  FileText,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Monitor,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  Settings,
  Trash2,
  X
} from 'lucide-react'

import { ExplorerTree } from './ExplorerTree'
import {
  readDefaultHiddenExplorerWorkspaces,
  readHiddenExplorerEntries,
  writeDefaultHiddenExplorerWorkspaces,
  writeHiddenExplorerEntries
} from './hiddenExplorerEntries'
import type { AppState } from '../app/appTypes'
import type { AiTool, AiToolId } from '../../../shared/ai'
import type { UpdateCheckResult } from '../../../shared/update'
import {
  getEffectiveAiToolId,
  type AiCliSettings
} from '../ai/aiSettings'
import {
  APP_THEMES,
  getAppThemeRows,
  type AppTheme,
  type AppThemeFamily,
  type AppThemeId,
  type AppThemeRow,
  type AppThemeTone,
  type ThemePreference
} from '../theme/appThemes'
import type { RecentWorkspace } from '../workspaces/recentWorkspaces'
import type { TreeNode } from '../../../shared/fileTree'

interface ExplorerPaneProps {
  readonly aiSettings?: AiCliSettings
  readonly aiTools?: readonly AiTool[]
  readonly appVersion?: string
  readonly isCollapsed?: boolean
  readonly onAiSettingsChange?: (settings: AiCliSettings) => void
  readonly onCheckForUpdates?: () => Promise<UpdateCheckResult>
  readonly onCreateFile: (filePath: string) => void
  readonly onCreateFolder: (folderPath: string) => void
  readonly onDeleteEntry: () => void
  readonly onForgetWorkspace?: (workspace: RecentWorkspace) => void
  readonly onOpenFile?: () => void
  readonly onOpenRecentFile?: (filePath: string) => void
  readonly onOpenWorkspace: () => void
  readonly onRefreshTree?: (directoryPaths: readonly string[]) => Promise<void> | void
  readonly onRenameEntry: (entryName: string) => void
  readonly onSelectTheme?: (themeId: AppThemeId) => void
  readonly onSelectEntry: (entryPath: string | null) => void
  readonly onSelectFile: (filePath: string) => void
  readonly onSwitchWorkspace?: (workspace: RecentWorkspace) => void
  readonly onToggleCollapsed?: () => void
  readonly onToggleSystemTheme?: (shouldFollowSystem: boolean) => void
  readonly recentFilePaths?: readonly string[]
  readonly recentWorkspaces?: readonly RecentWorkspace[]
  readonly resolvedTheme?: AppTheme
  readonly shouldAutoOpenWorkspaceDialog?: boolean
  readonly state: AppState
  readonly themePreference?: ThemePreference
}

type PendingExplorerAction = 'create-file' | 'create-folder' | 'rename' | null
type SettingsPanelId = 'ai' | 'theme' | 'updates'

interface EntryContextMenu {
  readonly entry: TreeNode
  readonly x: number
  readonly y: number
}

const EMPTY_HIDDEN_ENTRY_PATHS: ReadonlySet<string> = new Set()
const DEFAULT_AI_SETTINGS: AiCliSettings = {
  modelNames: {},
  selectedToolId: null
}
const EXPLORER_RECENT_FILES_PANEL_STORAGE_KEY =
  'mde.explorerRecentFilesPanel'
const RECENT_FILES_PANEL_HEIGHT_DEFAULT = 164
const RECENT_FILES_PANEL_HEIGHT_MIN = 96
const RECENT_FILES_PANEL_HEIGHT_MAX = 320

interface RecentFilesPanelState {
  readonly height: number
  readonly isCollapsed: boolean
}

interface LocateFileRequest {
  readonly id: number
  readonly path: string
  readonly workspaceRoot: string | null
}

interface ExpandedDirectoryState {
  readonly paths: ReadonlySet<string>
  readonly workspaceRoot: string | null
}

const EMPTY_EXPANDED_DIRECTORY_PATHS = new Set<string>()

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? entryPath : entryPath.slice(separatorIndex + 1)
}

const clampRecentFilesPanelHeight = (height: number): number =>
  Number.isFinite(height)
    ? Math.min(
        RECENT_FILES_PANEL_HEIGHT_MAX,
        Math.max(RECENT_FILES_PANEL_HEIGHT_MIN, Math.round(height))
      )
    : RECENT_FILES_PANEL_HEIGHT_DEFAULT

const readRecentFilesPanelState = (): RecentFilesPanelState => {
  try {
    const storedValue = globalThis.localStorage.getItem(
      EXPLORER_RECENT_FILES_PANEL_STORAGE_KEY
    )

    if (!storedValue) {
      return {
        height: RECENT_FILES_PANEL_HEIGHT_DEFAULT,
        isCollapsed: false
      }
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>

    return {
      height:
        typeof parsedValue.height === 'number'
          ? clampRecentFilesPanelHeight(parsedValue.height)
          : RECENT_FILES_PANEL_HEIGHT_DEFAULT,
      isCollapsed: parsedValue.isCollapsed === true
    }
  } catch {
    return {
      height: RECENT_FILES_PANEL_HEIGHT_DEFAULT,
      isCollapsed: false
    }
  }
}

const writeRecentFilesPanelState = (state: RecentFilesPanelState): void => {
  try {
    globalThis.localStorage.setItem(
      EXPLORER_RECENT_FILES_PANEL_STORAGE_KEY,
      JSON.stringify(state)
    )
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}

const joinEntryPath = (
  directoryPath: string | null,
  entryPath: string
): string => (directoryPath ? `${directoryPath}/${entryPath}` : entryPath)

const getAncestorDirectoryPaths = (entryPath: string): readonly string[] => {
  const segments = entryPath.split('/').filter((segment) => segment.length > 0)

  return segments.slice(0, -1).map((_segment, index) =>
    segments.slice(0, index + 1).join('/')
  )
}

const getDirectoryDepth = (directoryPath: string): number =>
  directoryPath.split('/').filter((segment) => segment.length > 0).length

const sortDirectoryPaths = (
  directoryPaths: Iterable<string>
): readonly string[] =>
  Array.from(new Set(directoryPaths)).sort(
    (leftPath, rightPath) =>
      getDirectoryDepth(leftPath) - getDirectoryDepth(rightPath) ||
      leftPath.localeCompare(rightPath)
  )

const findDirectoryPath = (
  nodes: readonly TreeNode[],
  targetPath: string | null
): string | null => {
  if (!targetPath) {
    return null
  }

  for (const node of nodes) {
    if (node.type !== 'directory') {
      continue
    }

    if (node.path === targetPath) {
      return node.path
    }

    const childDirectoryPath = findDirectoryPath(node.children, targetPath)

    if (childDirectoryPath) {
      return childDirectoryPath
    }
  }

  return null
}

const collectDefaultHiddenEntryPaths = (
  nodes: readonly TreeNode[]
): readonly string[] =>
  nodes.reduce<readonly string[]>((entryPaths, node) => {
    const childEntryPaths =
      node.type === 'directory'
        ? collectDefaultHiddenEntryPaths(node.children)
        : []
    const nodeEntryPaths = node.name.startsWith('.') ? [node.path] : []

    return [...entryPaths, ...nodeEntryPaths, ...childEntryPaths]
  }, [])

const resolveCreatedEntryPath = (
  directoryPath: string | null,
  entryPath: string
): string => {
  if (
    !directoryPath ||
    entryPath === directoryPath ||
    entryPath.startsWith(`${directoryPath}/`)
  ) {
    return entryPath
  }

  return joinEntryPath(directoryPath, entryPath)
}

const filterHiddenNodes = (
  nodes: readonly TreeNode[],
  hiddenEntryPaths: ReadonlySet<string>
): readonly TreeNode[] =>
  nodes.reduce<readonly TreeNode[]>((visibleNodes, node) => {
    if (hiddenEntryPaths.has(node.path)) {
      return visibleNodes
    }

    if (node.type === 'file') {
      return [...visibleNodes, node]
    }

    return [
      ...visibleNodes,
      {
        ...node,
        children: filterHiddenNodes(node.children, hiddenEntryPaths)
      }
    ]
  }, [])

interface ThemeDialogColumn {
  readonly id: AppThemeTone
  readonly label: string
}

const THEME_DIALOG_COLUMNS: readonly ThemeDialogColumn[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light-panel', label: 'Light panel' },
  { id: 'dark-panel', label: 'Dark panel' }
]

const getThemeDialogColumns = (
  isFollowingSystemTheme: boolean,
  resolvedFamily: AppThemeFamily
): readonly ThemeDialogColumn[] => {
  if (!isFollowingSystemTheme) {
    return THEME_DIALOG_COLUMNS
  }

  return resolvedFamily === 'dark'
    ? [THEME_DIALOG_COLUMNS[0]]
    : [THEME_DIALOG_COLUMNS[1], THEME_DIALOG_COLUMNS[2]]
}

const getThemeForColumn = (
  row: AppThemeRow,
  columnId: AppThemeTone
): AppTheme => {
  if (columnId === 'dark') {
    return row.darkTheme
  }

  return columnId === 'light-panel' ? row.lightPanelTheme : row.darkPanelTheme
}

export const ExplorerPane = ({
  aiSettings = DEFAULT_AI_SETTINGS,
  aiTools = [],
  appVersion = '0.0.0',
  isCollapsed = false,
  onAiSettingsChange = () => undefined,
  onCheckForUpdates,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onForgetWorkspace = () => undefined,
  onOpenFile = () => undefined,
  onOpenRecentFile = () => undefined,
  onOpenWorkspace,
  onRefreshTree = () => undefined,
  onRenameEntry,
  onSelectTheme = () => undefined,
  onSelectEntry,
  onSelectFile,
  onSwitchWorkspace = () => undefined,
  onToggleCollapsed = () => undefined,
  onToggleSystemTheme = () => undefined,
  recentFilePaths = [],
  recentWorkspaces = [],
  resolvedTheme = APP_THEMES[0],
  shouldAutoOpenWorkspaceDialog = false,
  state,
  themePreference = {
    lastDarkThemeId: 'carbon',
    lastLightThemeId: 'manuscript',
    mode: 'system'
  }
}: ExplorerPaneProps): React.JSX.Element => {
  const workspaceRoot = state.workspace?.rootPath ?? null
  const [pendingAction, setPendingAction] = useState<PendingExplorerAction>(null)
  const [actionTargetDirectoryPath, setActionTargetDirectoryPath] = useState<
    string | null
  >(null)
  const [actionTargetEntryPath, setActionTargetEntryPath] = useState<
    string | null
  >(null)
  const [entryValue, setEntryValue] = useState('')
  const [contextMenu, setContextMenu] = useState<EntryContextMenu | null>(null)
  const [recentFilesPanelState, setRecentFilesPanelState] = useState(
    readRecentFilesPanelState
  )
  const [expandedDirectoryState, setExpandedDirectoryState] =
    useState<ExpandedDirectoryState>(() => ({
      paths: new Set(),
      workspaceRoot
    }))
  const [locateFileRequest, setLocateFileRequest] =
    useState<LocateFileRequest | null>(null)
  const [isResizingRecentFiles, setIsResizingRecentFiles] = useState(false)
  const [hiddenEntryPathsByWorkspace, setHiddenEntryPathsByWorkspace] = useState<
    ReadonlyMap<string, ReadonlySet<string>>
  >(readHiddenExplorerEntries)
  const [defaultHiddenWorkspaceRoots, setDefaultHiddenWorkspaceRoots] = useState<
    ReadonlySet<string>
  >(readDefaultHiddenExplorerWorkspaces)
  const [hasDismissedAutoWorkspaceDialog, setHasDismissedAutoWorkspaceDialog] =
    useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [
    showingHiddenEntriesWorkspaceRoot,
    setShowingHiddenEntriesWorkspaceRoot
  ] = useState<string | null>(null)
  const [isWorkspaceDialogManuallyOpen, setIsWorkspaceDialogManuallyOpen] =
    useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [activeSettingsPanel, setActiveSettingsPanel] =
    useState<SettingsPanelId>('theme')
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)
  const [settingsUpdateMessage, setSettingsUpdateMessage] = useState<string | null>(
    null
  )
  const [settingsUpdateErrorMessage, setSettingsUpdateErrorMessage] = useState<
    string | null
  >(null)
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('')
  const workspaceContentRef = useRef<HTMLDivElement | null>(null)
  const locateFileRequestIdRef = useRef(0)
  const expandedDirectoryPaths =
    expandedDirectoryState.workspaceRoot === workspaceRoot
      ? expandedDirectoryState.paths
      : EMPTY_EXPANDED_DIRECTORY_PATHS
  const activeLocateFileRequest =
    locateFileRequest?.workspaceRoot === workspaceRoot ? locateFileRequest : null
  const hiddenEntryPaths = workspaceRoot
    ? hiddenEntryPathsByWorkspace.get(workspaceRoot) ?? EMPTY_HIDDEN_ENTRY_PATHS
    : EMPTY_HIDDEN_ENTRY_PATHS

  useEffect(() => {
    writeHiddenExplorerEntries(hiddenEntryPathsByWorkspace)
  }, [hiddenEntryPathsByWorkspace])

  useEffect(() => {
    writeDefaultHiddenExplorerWorkspaces(defaultHiddenWorkspaceRoots)
  }, [defaultHiddenWorkspaceRoots])

  useEffect(() => {
    writeRecentFilesPanelState(recentFilesPanelState)
  }, [recentFilesPanelState])

  const updateRecentFilesHeightFromPointer = useCallback((clientY: number): void => {
    const bounds = workspaceContentRef.current?.getBoundingClientRect()

    if (!bounds) {
      return
    }

    setRecentFilesPanelState(() => ({
      height: clampRecentFilesPanelHeight(bounds.bottom - clientY),
      isCollapsed: false
    }))
  }, [])

  useEffect(() => {
    if (!isResizingRecentFiles) {
      return
    }

    const updateHeight = (event: PointerEvent): void => {
      updateRecentFilesHeightFromPointer(event.clientY)
    }
    const stopResizing = (): void => {
      setIsResizingRecentFiles(false)
    }

    document.body.classList.add('is-resizing-explorer-panel')
    window.addEventListener('pointermove', updateHeight)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      document.body.classList.remove('is-resizing-explorer-panel')
      window.removeEventListener('pointermove', updateHeight)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [isResizingRecentFiles, updateRecentFilesHeightFromPointer])

  const commitHiddenEntryPaths = (nextPaths: ReadonlySet<string>): void => {
    if (!workspaceRoot) {
      return
    }

    setDefaultHiddenWorkspaceRoots((currentRoots) =>
      currentRoots.has(workspaceRoot)
        ? currentRoots
        : new Set([...currentRoots, workspaceRoot])
    )
    setHiddenEntryPathsByWorkspace((currentPathsByWorkspace) => {
      const nextPathsByWorkspace = new Map(currentPathsByWorkspace)

      if (nextPaths.size === 0) {
        nextPathsByWorkspace.delete(workspaceRoot)
      } else {
        nextPathsByWorkspace.set(workspaceRoot, nextPaths)
      }

      return nextPathsByWorkspace
    })
  }

  const beginAction = (
    action: Exclude<PendingExplorerAction, null>,
    defaultValue: string,
    targetDirectoryPath: string | null = null,
    targetEntryPath: string | null = null
  ): void => {
    setPendingAction(action)
    setActionTargetDirectoryPath(targetDirectoryPath)
    setActionTargetEntryPath(targetEntryPath)
    setEntryValue(defaultValue)
    setIsConfirmingDelete(false)
  }

  const clearPendingAction = (): void => {
    setPendingAction(null)
    setActionTargetDirectoryPath(null)
    setActionTargetEntryPath(null)
    setEntryValue('')
  }

  const closeContextMenu = (): void => {
    setContextMenu(null)
  }

  const closeWorkspaceDialog = (): void => {
    setHasDismissedAutoWorkspaceDialog(true)
    setIsWorkspaceDialogManuallyOpen(false)
    setWorkspaceSearchQuery('')
  }

  const closeSettingsDialog = (): void => {
    setIsSettingsDialogOpen(false)
    setSettingsUpdateErrorMessage(null)
  }

  const requestLocateFile = (filePath: string): void => {
    locateFileRequestIdRef.current += 1
    setLocateFileRequest({
      id: locateFileRequestIdRef.current,
      path: filePath,
      workspaceRoot
    })
  }

  const refreshDirectoryPaths = (
    directoryPaths: Iterable<string>,
    shouldLocateOpenFile = false
  ): void => {
    const currentOpenFilePath = state.loadedFile?.path ?? state.selectedFilePath
    const nextExpandedDirectoryPaths = new Set(expandedDirectoryPaths)

    if (shouldLocateOpenFile && currentOpenFilePath) {
      for (const directoryPath of getAncestorDirectoryPaths(currentOpenFilePath)) {
        nextExpandedDirectoryPaths.add(directoryPath)
      }

      setExpandedDirectoryState({
        paths: nextExpandedDirectoryPaths,
        workspaceRoot
      })
    }

    void Promise.resolve(
      onRefreshTree(sortDirectoryPaths(
        shouldLocateOpenFile ? nextExpandedDirectoryPaths : directoryPaths
      ))
    )
      .then(() => {
        if (shouldLocateOpenFile && currentOpenFilePath) {
          requestLocateFile(currentOpenFilePath)
        }
      })
      .catch(() => undefined)
  }

  const changeDirectoryExpansion = (
    directoryPath: string,
    isExpanded: boolean
  ): void => {
    setExpandedDirectoryState((currentState) => {
      const currentPaths =
        currentState.workspaceRoot === workspaceRoot
          ? currentState.paths
          : EMPTY_EXPANDED_DIRECTORY_PATHS
      const nextPaths = new Set(currentPaths)

      if (isExpanded) {
        nextPaths.add(directoryPath)
      } else {
        nextPaths.delete(directoryPath)
      }

      return {
        paths: nextPaths,
        workspaceRoot
      }
    })

    if (isExpanded) {
      refreshDirectoryPaths([directoryPath])
    }
  }

  const toggleWorkspaceDialog = (): void => {
    if (isWorkspaceDialogOpen) {
      closeWorkspaceDialog()
      return
    }

    setIsWorkspaceDialogManuallyOpen(true)
  }

  const openSettingsDialog = (panel: SettingsPanelId = 'theme'): void => {
    setActiveSettingsPanel(panel)
    setIsSettingsDialogOpen(true)
  }

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const closeMenu = (): void => {
      setContextMenu(null)
    }
    const closeMenuOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeMenuOnEscape)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeMenuOnEscape)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [contextMenu])

  const beginContextRename = (): void => {
    if (!contextMenu) {
      return
    }

    onSelectEntry(contextMenu.entry.path)
    beginAction('rename', getEntryName(contextMenu.entry.path), null, contextMenu.entry.path)
    closeContextMenu()
  }

  const beginContextDelete = (): void => {
    if (!contextMenu) {
      return
    }

    onSelectEntry(contextMenu.entry.path)
    setIsConfirmingDelete(true)
    clearPendingAction()
    closeContextMenu()
  }

  const hideContextEntry = (): void => {
    if (!contextMenu) {
      return
    }

    const entryPath = contextMenu.entry.path

    commitHiddenEntryPaths(new Set([...effectiveHiddenEntryPaths, entryPath]))
    setShowingHiddenEntriesWorkspaceRoot(null)
    closeContextMenu()
  }

  const showContextEntry = (): void => {
    if (!contextMenu) {
      return
    }

    const entryPath = contextMenu.entry.path
    const isLastHiddenEntry =
      effectiveHiddenEntryPaths.size === 1 &&
      effectiveHiddenEntryPaths.has(entryPath)
    const nextPaths = new Set(effectiveHiddenEntryPaths)

    nextPaths.delete(entryPath)
    commitHiddenEntryPaths(nextPaths)
    if (isLastHiddenEntry) {
      setShowingHiddenEntriesWorkspaceRoot(null)
    }
    closeContextMenu()
  }

  const submitPendingAction = (): void => {
    const trimmedValue = entryValue.trim()

    if (!pendingAction || trimmedValue.length === 0) {
      return
    }

    if (pendingAction === 'create-file') {
      onCreateFile(resolveCreatedEntryPath(actionTargetDirectoryPath, trimmedValue))
    } else if (pendingAction === 'create-folder') {
      onCreateFolder(
        resolveCreatedEntryPath(actionTargetDirectoryPath, trimmedValue)
      )
    } else {
      onRenameEntry(trimmedValue)
    }

    clearPendingAction()
  }

  const selectedEntryName = state.selectedEntryPath
    ? getEntryName(state.selectedEntryPath)
    : ''
  const defaultHiddenEntryPaths =
    state.workspace && workspaceRoot && !defaultHiddenWorkspaceRoots.has(workspaceRoot)
      ? collectDefaultHiddenEntryPaths(state.workspace.tree)
      : []
  const effectiveHiddenEntryPaths =
    defaultHiddenEntryPaths.length > 0
      ? new Set([...hiddenEntryPaths, ...defaultHiddenEntryPaths])
      : hiddenEntryPaths
  const hasHiddenEntries = effectiveHiddenEntryPaths.size > 0
  const hasSelectedEntry = Boolean(state.selectedEntryPath)
  const selectedDirectoryPath = state.workspace
    ? findDirectoryPath(state.workspace.tree, state.selectedEntryPath)
    : null
  const isContextEntryHidden = contextMenu
    ? effectiveHiddenEntryPaths.has(contextMenu.entry.path)
    : false
  const isShowingHiddenEntries =
    Boolean(workspaceRoot) && showingHiddenEntriesWorkspaceRoot === workspaceRoot
  const shouldShowAutoWorkspaceDialog =
    shouldAutoOpenWorkspaceDialog && !hasDismissedAutoWorkspaceDialog
  const isWorkspaceDialogOpen =
    isWorkspaceDialogManuallyOpen || shouldShowAutoWorkspaceDialog
  const isFollowingSystemTheme = themePreference.mode === 'system'
  const themeDialogColumns = getThemeDialogColumns(
    isFollowingSystemTheme,
    resolvedTheme.family
  )
  const themeDialogRows = getAppThemeRows()
  const effectiveAiToolId = getEffectiveAiToolId(aiSettings, aiTools)
  const selectedAiTool = effectiveAiToolId
    ? aiTools.find((tool) => tool.id === effectiveAiToolId) ?? null
    : null
  const selectedAiModelName =
    effectiveAiToolId ? aiSettings.modelNames[effectiveAiToolId] ?? '' : ''
  const workspaceTriggerLabel = state.isOpeningWorkspace
    ? 'Opening...'
    : state.workspace?.name ?? 'Open workspace'
  const workspaceTriggerAriaLabel = state.workspace
    ? 'Manage workspaces'
    : 'Open workspace'
  const normalizedWorkspaceSearchQuery = workspaceSearchQuery.trim().toLowerCase()
  const filteredRecentWorkspaces = recentWorkspaces.filter((workspace) => {
    if (normalizedWorkspaceSearchQuery.length === 0) {
      return true
    }

    const searchableText =
      workspace.type === 'file'
        ? `${workspace.name} ${workspace.filePath} ${workspace.rootPath}`
        : `${workspace.name} ${workspace.rootPath}`

    return searchableText.toLowerCase().includes(normalizedWorkspaceSearchQuery)
  })
  const visibleTree = state.workspace
    ? isShowingHiddenEntries
      ? state.workspace.tree
      : filterHiddenNodes(state.workspace.tree, effectiveHiddenEntryPaths)
    : []
  const inlineEditor = pendingAction
    ? {
        targetDirectoryPath: actionTargetDirectoryPath,
        targetEntryPath: actionTargetEntryPath,
        type: pendingAction,
        value: entryValue
      }
    : null
  const isRecentFilesCollapsed = recentFilesPanelState.isCollapsed
  const recentFilesSectionStyle = {
    '--recent-files-height': `${recentFilesPanelState.height}px`
  } as CSSProperties
  const beginRecentFilesResize = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    event.preventDefault()
    updateRecentFilesHeightFromPointer(event.clientY)
    setIsResizingRecentFiles(true)
  }
  const resizeRecentFilesFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>
  ): void => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setRecentFilesPanelState((currentState) => ({
        height: clampRecentFilesPanelHeight(currentState.height + 16),
        isCollapsed: false
      }))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setRecentFilesPanelState((currentState) => ({
        height: clampRecentFilesPanelHeight(currentState.height - 16),
        isCollapsed: false
      }))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setRecentFilesPanelState({
        height: RECENT_FILES_PANEL_HEIGHT_MIN,
        isCollapsed: false
      })
    } else if (event.key === 'End') {
      event.preventDefault()
      setRecentFilesPanelState({
        height: RECENT_FILES_PANEL_HEIGHT_MAX,
        isCollapsed: false
      })
    }
  }
  const toggleRecentFilesPanel = (): void => {
    setRecentFilesPanelState((currentState) => ({
      ...currentState,
      isCollapsed: !currentState.isCollapsed
    }))
  }
  const selectAiTool = (toolId: AiToolId): void => {
    onAiSettingsChange({
      ...aiSettings,
      selectedToolId: toolId
    })
  }
  const updateSelectedAiModelName = (modelName: string): void => {
    if (!effectiveAiToolId) {
      return
    }

    onAiSettingsChange({
      modelNames: {
        ...aiSettings.modelNames,
        [effectiveAiToolId]: modelName
      },
      selectedToolId: aiSettings.selectedToolId ?? effectiveAiToolId
    })
  }
  const checkForUpdates = async (): Promise<void> => {
    if (!onCheckForUpdates) {
      setSettingsUpdateMessage('Update checks are unavailable in this runtime.')
      setSettingsUpdateErrorMessage(null)
      return
    }

    setIsCheckingForUpdates(true)
    setSettingsUpdateMessage(null)
    setSettingsUpdateErrorMessage(null)

    try {
      const result = await onCheckForUpdates()

      setSettingsUpdateMessage(
        result.updateAvailable && result.update
          ? `MDE ${result.update.latestVersion} is available.`
          : result.message ?? 'MDE is up to date.'
      )
    } catch (error) {
      setSettingsUpdateErrorMessage(
        error instanceof Error ? error.message : 'Unable to check for updates'
      )
    } finally {
      setIsCheckingForUpdates(false)
    }
  }
  const renderThemePanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>Theme</h3>
        <p>
          {isFollowingSystemTheme
            ? `Choose the ${resolvedTheme.family} theme used by system appearance.`
            : 'Choose editor appearance.'}
        </p>
      </div>
      <div className="settings-control-row">
        <div>
          <span>Follow system appearance</span>
          <span>Use the current OS light or dark mode.</span>
        </div>
        <button
          aria-checked={isFollowingSystemTheme}
          aria-label="Follow system appearance"
          className="theme-system-switch"
          onClick={() => {
            onToggleSystemTheme(!isFollowingSystemTheme)
          }}
          role="switch"
          title="Follow system appearance"
          type="button"
        >
          <Monitor aria-hidden="true" focusable="false" size={14} />
          <span aria-hidden="true" />
        </button>
      </div>
      <div
        aria-label="Theme colorways"
        className="theme-colorway-grid"
        data-column-count={themeDialogColumns.length}
        role="radiogroup"
      >
        {themeDialogRows.map((row) => (
          <div
            className="theme-colorway-row"
            data-theme-row={row.id}
            key={row.id}
          >
            <span className="theme-colorway-label">{row.label}</span>
            {themeDialogColumns.map((column) => {
              const theme = getThemeForColumn(row, column.id)
              const isSelected = resolvedTheme.id === theme.id

              return (
                <button
                  aria-checked={isSelected}
                  aria-label={`${theme.label}: ${theme.description}`}
                  className={[
                    'theme-option-button',
                    isSelected ? 'is-selected' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-theme-column={column.id}
                  data-theme-id={theme.id}
                  data-theme-row={row.id}
                  key={theme.id}
                  onClick={() => {
                    onSelectTheme(theme.id)
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
                    <span>{theme.label}</span>
                    <span>{theme.description}</span>
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
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
  const renderAiPanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>AI</h3>
        <p>Choose the local AI CLI used for summary and translation actions.</p>
      </div>
      {aiTools.length > 0 && effectiveAiToolId ? (
        <>
          <label className="settings-field">
            <span>AI CLI</span>
            <select
              aria-label="AI CLI"
              onChange={(event) => {
                selectAiTool(event.target.value as AiToolId)
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
            <span>Default model name</span>
            <input
              aria-label="Default model name"
              onChange={(event) => {
                updateSelectedAiModelName(event.target.value)
              }}
              placeholder={
                selectedAiTool?.id === 'claude'
                  ? 'claude-sonnet-4-6'
                  : 'gpt-5.4'
              }
              type="text"
              value={selectedAiModelName}
            />
          </label>
          <p className="settings-muted-copy">
            Only installed CLIs are shown. Leave model blank to use the CLI
            default.
          </p>
        </>
      ) : (
        <p className="settings-empty-state">
          No supported AI CLI detected. Install Codex or Claude Code to enable AI
          actions.
        </p>
      )}
    </div>
  )
  const renderUpdatePanel = (): React.JSX.Element => (
    <div className="settings-panel-stack">
      <div className="settings-section-header">
        <h3>Check Update</h3>
        <p>Review the installed MDE version and check GitHub releases.</p>
      </div>
      <dl className="settings-version-list">
        <div>
          <dt>Current version</dt>
          <dd>{appVersion}</dd>
        </div>
      </dl>
      <button
        aria-label="Check for updates"
        className="settings-primary-button"
        disabled={isCheckingForUpdates}
        onClick={() => {
          void checkForUpdates()
        }}
        type="button"
      >
        <RefreshCw
          aria-hidden="true"
          className={isCheckingForUpdates ? 'is-spinning' : undefined}
          focusable="false"
          size={15}
        />
        <span>{isCheckingForUpdates ? 'Checking...' : 'Check for updates'}</span>
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
  )
  const renderSettingsPanel = (): React.JSX.Element => {
    if (activeSettingsPanel === 'ai') {
      return renderAiPanel()
    }

    if (activeSettingsPanel === 'updates') {
      return renderUpdatePanel()
    }

    return renderThemePanel()
  }
  const renderSettingsDialog = (): React.JSX.Element | null =>
    isSettingsDialogOpen ? (
      <div className="workspace-dialog-backdrop" onClick={closeSettingsDialog}>
        <div
          aria-label="Settings"
          aria-modal="true"
          className="workspace-dialog settings-dialog"
          onClick={(event) => {
            event.stopPropagation()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              closeSettingsDialog()
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
                <h2 className="workspace-dialog-title">Settings</h2>
                <p className="workspace-dialog-subtitle">
                  Configure editor behavior, AI tools, and app updates.
                </p>
              </div>
            </div>
            <button
              aria-label="Close settings"
              className="explorer-icon-button workspace-dialog-close"
              onClick={closeSettingsDialog}
              title="Close settings"
              type="button"
            >
              <X aria-hidden="true" focusable="false" size={16} />
            </button>
          </div>
          <div className="settings-dialog-layout">
            <nav className="settings-nav" aria-label="Settings sections">
              <button
                aria-current={activeSettingsPanel === 'ai' ? 'page' : undefined}
                onClick={() => {
                  setActiveSettingsPanel('ai')
                }}
                type="button"
              >
                <Bot aria-hidden="true" focusable="false" size={16} />
                <span>AI</span>
              </button>
              <button
                aria-current={
                  activeSettingsPanel === 'theme' ? 'page' : undefined
                }
                onClick={() => {
                  setActiveSettingsPanel('theme')
                }}
                type="button"
              >
                <Paintbrush aria-hidden="true" focusable="false" size={16} />
                <span>Theme</span>
              </button>
              <button
                aria-current={
                  activeSettingsPanel === 'updates' ? 'page' : undefined
                }
                onClick={() => {
                  setActiveSettingsPanel('updates')
                }}
                type="button"
              >
                <RefreshCw aria-hidden="true" focusable="false" size={16} />
                <span>Check Update</span>
              </button>
            </nav>
            <section
              aria-label={`${activeSettingsPanel} settings`}
              className="settings-panel"
            >
              {renderSettingsPanel()}
            </section>
          </div>
        </div>
      </div>
    ) : null
  const settingsControls = (
    <div className="explorer-theme-footer" aria-label="Settings controls">
      <button
        aria-label="Open settings"
        className="theme-selector-button"
        onClick={() => {
          openSettingsDialog('theme')
        }}
        title="Open settings"
        type="button"
      >
        <span className="theme-selector-icon" aria-hidden="true">
          <Settings aria-hidden="true" focusable="false" size={15} />
        </span>
        <span className="theme-selector-copy">
          <span>Settings</span>
          <span>
            {isFollowingSystemTheme
              ? `Theme: System ${resolvedTheme.label}`
              : `Theme: ${resolvedTheme.label}`}
          </span>
        </span>
        <span className="theme-selector-swatches" aria-hidden="true">
          {resolvedTheme.swatches.map((swatch) => (
            <span key={swatch} style={{ backgroundColor: swatch }} />
          ))}
        </span>
        <ChevronDown aria-hidden="true" focusable="false" size={14} />
      </button>
    </div>
  )

  if (isCollapsed) {
    return (
      <aside className="explorer-pane is-collapsed" aria-label="Explorer">
        <button
          aria-label="Expand explorer sidebar"
          className="explorer-icon-button explorer-sidebar-toggle"
          onClick={onToggleCollapsed}
          title="Expand explorer sidebar"
          type="button"
        >
          <PanelLeftOpen aria-hidden="true" focusable="false" size={17} />
        </button>
        <button
          aria-label="Open settings"
          className="explorer-icon-button explorer-collapsed-theme-button"
          onClick={() => {
            openSettingsDialog('theme')
          }}
          title="Open settings"
          type="button"
        >
          <Settings aria-hidden="true" focusable="false" size={16} />
        </button>
        {renderSettingsDialog()}
      </aside>
    )
  }

  return (
    <aside className="explorer-pane" aria-label="Explorer">
      <div className="explorer-header-row">
        <div className="explorer-header">Explorer</div>
        <button
          aria-label="Collapse explorer sidebar"
          className="explorer-icon-button explorer-sidebar-toggle"
          onClick={onToggleCollapsed}
          title="Collapse explorer sidebar"
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
            aria-label="Workspace manager"
            aria-modal="true"
            className="workspace-dialog"
            onClick={(event) => {
              event.stopPropagation()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeWorkspaceDialog()
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
                    {state.workspace ? 'Workspaces' : 'Open workspace'}
                  </h2>
                  <p className="workspace-dialog-subtitle">
                    Choose a folder workspace or a single Markdown file.
                  </p>
                </div>
              </div>
              <button
                aria-label="Close workspace popup"
                className="explorer-icon-button workspace-dialog-close"
                onClick={closeWorkspaceDialog}
                title="Close workspace popup"
                type="button"
              >
                <X aria-hidden="true" focusable="false" size={16} />
              </button>
            </div>
            <div className="workspace-dialog-content">
              <div className="workspace-primary-actions">
                <button
                  className="workspace-item-button workspace-action-button"
                  onClick={() => {
                    closeWorkspaceDialog()
                    onOpenWorkspace()
                  }}
                  type="button"
                >
                  <span className="workspace-action-icon" aria-hidden="true">
                    <FolderOpen aria-hidden="true" focusable="false" size={18} />
                  </span>
                  <span className="workspace-action-copy">
                    <span>Open new workspace</span>
                    <span>Folder workspace</span>
                  </span>
                </button>
                <button
                  className="workspace-item-button workspace-action-button"
                  onClick={() => {
                    closeWorkspaceDialog()
                    onOpenFile()
                  }}
                  type="button"
                >
                  <span className="workspace-action-icon" aria-hidden="true">
                    <FileText aria-hidden="true" focusable="false" size={18} />
                  </span>
                  <span className="workspace-action-copy">
                    <span>Open Markdown file</span>
                    <span>Single file</span>
                  </span>
                </button>
              </div>
              <div className="workspace-recent-header">
                <div className="workspace-section-title">Recent</div>
                <label className="workspace-search-field">
                  <span className="visually-hidden">
                    Search workspaces and files
                  </span>
                  <input
                    onChange={(event) => {
                      setWorkspaceSearchQuery(event.target.value)
                    }}
                    placeholder="Search"
                    type="search"
                    value={workspaceSearchQuery}
                  />
                </label>
              </div>
              {recentWorkspaces.length > 0 ? (
                <div
                  aria-label="Recent workspaces and files"
                  className="workspace-resource-list"
                >
                  {filteredRecentWorkspaces.length > 0 ? (
                    filteredRecentWorkspaces.map((workspace) => {
                      const resourceType =
                        workspace.type === 'file' ? 'file' : 'workspace'
                      const resourcePath =
                        workspace.type === 'file'
                          ? workspace.filePath
                          : workspace.rootPath

                      return (
                        <div
                          className="workspace-resource-row"
                          key={`${resourceType}:${resourcePath}`}
                        >
                          <button
                            aria-label={`Switch to ${resourceType} ${workspace.name}`}
                            className="workspace-item-button workspace-resource-button"
                            onClick={() => {
                              closeWorkspaceDialog()
                              onSwitchWorkspace(workspace)
                            }}
                            type="button"
                          >
                            <span>{workspace.name}</span>
                            <span>{resourcePath}</span>
                          </button>
                          <button
                            aria-label={`Remove recent ${resourceType} ${workspace.name}`}
                            className="explorer-icon-button workspace-resource-delete"
                            onClick={() => {
                              onForgetWorkspace(workspace)
                            }}
                            title={`Remove recent ${resourceType}`}
                            type="button"
                          >
                            <Trash2
                              aria-hidden="true"
                              focusable="false"
                              size={14}
                            />
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <p className="workspace-dialog-empty">
                      No matching workspaces or files
                    </p>
                  )}
                </div>
              ) : (
                <p className="workspace-dialog-empty">
                  No recent workspaces or files
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
          <div className="explorer-toolbar" aria-label="Workspace actions">
            <button
              aria-label="New Markdown file"
              className="explorer-icon-button"
              onClick={() => {
                beginAction(
                  'create-file',
                  'Untitled.md',
                  selectedDirectoryPath
                )
              }}
              title="New Markdown file"
              type="button"
            >
              <FilePlus aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label="New folder"
              className="explorer-icon-button"
              onClick={() => {
                beginAction(
                  'create-folder',
                  'notes',
                  selectedDirectoryPath
                )
              }}
              title="New folder"
              type="button"
            >
              <FolderPlus aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label={
                hasSelectedEntry
                  ? `Rename selected ${selectedEntryName}`
                  : 'Rename selected entry'
              }
              className="explorer-icon-button"
              disabled={!hasSelectedEntry}
              onClick={() => {
                if (!hasSelectedEntry) {
                  return
                }

                beginAction(
                  'rename',
                  selectedEntryName,
                  null,
                  state.selectedEntryPath
                )
              }}
              title="Rename"
              type="button"
            >
              <Pencil aria-hidden="true" focusable="false" size={15} />
            </button>
            <button
              aria-label={
                hasSelectedEntry
                  ? `Delete selected ${selectedEntryName}`
                  : 'Delete selected entry'
              }
              className="explorer-icon-button"
              disabled={!hasSelectedEntry}
              onClick={() => {
                if (!hasSelectedEntry) {
                  return
                }

                setIsConfirmingDelete(true)
                clearPendingAction()
              }}
              title="Delete"
              type="button"
            >
              <Trash2 aria-hidden="true" focusable="false" size={15} />
            </button>
            <button
              aria-label={
                isShowingHiddenEntries ? 'Hide hidden entries' : 'Show hidden entries'
              }
              aria-pressed={isShowingHiddenEntries}
              className="explorer-icon-button"
              disabled={!hasHiddenEntries}
              onClick={() => {
                setShowingHiddenEntriesWorkspaceRoot((currentWorkspaceRoot) =>
                  currentWorkspaceRoot === workspaceRoot ? null : workspaceRoot
                )
              }}
              title={
                isShowingHiddenEntries ? 'Hide hidden entries' : 'Show hidden entries'
              }
              type="button"
            >
              {isShowingHiddenEntries ? (
                <EyeOff aria-hidden="true" focusable="false" size={16} />
              ) : (
                <Eye aria-hidden="true" focusable="false" size={16} />
              )}
            </button>
            <button
              aria-label="Refresh explorer"
              className="explorer-icon-button"
              onClick={() => {
                refreshDirectoryPaths(expandedDirectoryPaths, true)
              }}
              title="Refresh explorer"
              type="button"
            >
              <RefreshCw aria-hidden="true" focusable="false" size={16} />
            </button>
          </div>
          {isConfirmingDelete && state.selectedEntryPath ? (
            <div className="explorer-delete-confirmation">
              <p>Delete {state.selectedEntryPath}?</p>
              <button
                onClick={() => {
                  onDeleteEntry()
                  setIsConfirmingDelete(false)
                }}
                type="button"
              >
                Confirm delete
              </button>
              <button
                onClick={() => {
                  setIsConfirmingDelete(false)
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <div className="explorer-content" ref={workspaceContentRef}>
            <section className="explorer-files-section" aria-label="Files">
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
                  onSelectEntry(entry.path)
                  setContextMenu({ entry, x: clientX, y: clientY })
                  closeWorkspaceDialog()
                }}
                onSelectEntry={onSelectEntry}
                onSelectFile={onSelectFile}
                selectedEntryPath={state.selectedEntryPath}
                selectedFilePath={state.selectedFilePath}
              />
              {contextMenu ? (
                <div
                  aria-label={`${contextMenu.entry.name} actions`}
                  className="explorer-context-menu"
                  role="menu"
                  style={
                    {
                      '--context-menu-x': `${contextMenu.x}px`,
                      '--context-menu-y': `${contextMenu.y}px`
                    } as CSSProperties
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <button
                    onClick={beginContextRename}
                    role="menuitem"
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    onClick={
                      isContextEntryHidden ? showContextEntry : hideContextEntry
                    }
                    role="menuitem"
                    type="button"
                  >
                    {isContextEntryHidden ? 'Show' : 'Hide'}
                  </button>
                  <button
                    onClick={beginContextDelete}
                    role="menuitem"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </section>
            {!isRecentFilesCollapsed ? (
              <div
                aria-label="Resize recent files panel"
                aria-orientation="horizontal"
                aria-valuemax={RECENT_FILES_PANEL_HEIGHT_MAX}
                aria-valuemin={RECENT_FILES_PANEL_HEIGHT_MIN}
                aria-valuenow={recentFilesPanelState.height}
                className="explorer-panel-resize-handle"
                onKeyDown={resizeRecentFilesFromKeyboard}
                onPointerDown={beginRecentFilesResize}
                role="separator"
                tabIndex={0}
              />
            ) : null}
            <section
              aria-label="Recent files"
              className={[
                'explorer-recent-files-section',
                isRecentFilesCollapsed ? 'is-collapsed' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              style={recentFilesSectionStyle}
            >
              <button
                aria-expanded={!isRecentFilesCollapsed}
                className="explorer-section-header-button"
                onClick={toggleRecentFilesPanel}
                type="button"
              >
                {isRecentFilesCollapsed ? (
                  <ChevronRight aria-hidden="true" focusable="false" size={14} />
                ) : (
                  <ChevronDown aria-hidden="true" focusable="false" size={14} />
                )}
                <span>Recent Files</span>
                <span>{recentFilePaths.length}</span>
              </button>
              {!isRecentFilesCollapsed ? (
                recentFilePaths.length > 0 ? (
                  <div
                    aria-label="Recent file list"
                    className="explorer-recent-file-list"
                  >
                    {recentFilePaths.map((filePath) => (
                      <button
                        aria-label={`Open recent file ${filePath}`}
                        className="explorer-recent-file-button"
                        key={filePath}
                        onClick={() => {
                          onOpenRecentFile(filePath)
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
                  <p className="explorer-recent-empty">No recent files</p>
                )
              ) : null}
            </section>
          </div>
        </div>
      ) : (
        <p className="explorer-empty">Open a folder to browse Markdown files.</p>
      )}
      {settingsControls}
      {renderSettingsDialog()}
    </aside>
  )
}
