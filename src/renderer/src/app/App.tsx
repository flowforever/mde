import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState
} from 'react'
import { AlignHorizontalSpaceAround, StretchHorizontal } from 'lucide-react'

import type { AiApi, AiGenerationResult, AiTool } from '../../../shared/ai'
import type { EditorApi, Workspace } from '../../../shared/workspace'
import type {
  AvailableUpdate,
  UpdateApi,
  UpdateCheckResult,
  UpdateDownloadProgress
} from '../../../shared/update'
import packageJson from '../../../../package.json'
import { appReducer, createInitialAppState } from './appReducer'
import {
  MarkdownBlockEditor,
  type MarkdownBlockEditorHandle
} from '../editor/MarkdownBlockEditor'
import {
  readEditorViewMode,
  writeEditorViewMode
} from '../editor/editorViewMode'
import { ExplorerPane } from '../explorer/ExplorerPane'
import { UpdateDialog, type UpdateDialogStatus } from './UpdateDialog'
import {
  disableSystemThemePreference,
  enableSystemThemePreference,
  readThemePreference,
  resolveThemePreference,
  selectAppTheme,
  writeThemePreference,
  type AppThemeFamily,
  type AppThemeId,
  type ThemePreference
} from '../theme/appThemes'
import {
  forgetRecentWorkspace,
  readActiveWorkspace,
  readRecentWorkspaces,
  rememberWorkspace,
  type RecentWorkspace,
  writeActiveWorkspace,
  writeRecentWorkspaces
} from '../workspaces/recentWorkspaces'
import {
  getWorkspaceLastOpenedFile,
  getWorkspaceRecentFiles,
  readWorkspaceFileHistory,
  rememberWorkspaceFile,
  removeWorkspaceFileHistoryEntry,
  renameWorkspaceFileHistoryEntry,
  type WorkspaceFileHistory,
  writeWorkspaceFileHistory
} from '../workspaces/workspaceFileHistory'
import type { TreeNode } from '../../../shared/fileTree'
import { AiActionMenu, type AiActionBusyState } from '../ai/AiActionMenu'
import { AiResultPanel } from '../ai/AiResultPanel'
import {
  forgetCustomAiTranslationLanguage,
  readCustomAiTranslationLanguages,
  rememberCustomAiTranslationLanguage
} from '../ai/aiLanguages'
import {
  readAiCliSettings,
  resolveAiGenerationOptions,
  writeAiCliSettings,
  type AiCliSettings
} from '../ai/aiSettings'

declare global {
  interface Window {
    readonly aiApi?: AiApi
    readonly editorApi?: EditorApi
    readonly updateApi?: UpdateApi
  }
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const findNodeByPath = (
  nodes: readonly TreeNode[],
  targetPath: string
): TreeNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node
    }

    if (node.type === 'directory') {
      const childNode = findNodeByPath(node.children, targetPath)

      if (childNode) {
        return childNode
      }
    }
  }

  return null
}

const findFileNodeByPath = (
  nodes: readonly TreeNode[],
  targetPath: string
): TreeNode | null => {
  const node = findNodeByPath(nodes, targetPath)

  return node?.type === 'file' ? node : null
}

const getParentPath = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? '' : entryPath.slice(0, separatorIndex)
}

const joinWorkspacePath = (parentPath: string, entryName: string): string =>
  parentPath ? `${parentPath}/${entryName}` : entryName

const ensureMarkdownExtension = (filePath: string): string =>
  filePath.toLowerCase().endsWith('.md') ? filePath : `${filePath}.md`

const EXPLORER_WIDTH_DEFAULT = 288
const EXPLORER_WIDTH_MIN = 220
const EXPLORER_WIDTH_MAX = 440
const AUTO_SAVE_IDLE_DELAY_MS = 5000
const SYSTEM_DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'
const APP_VERSION = packageJson.version
type ActiveAiActionBusyState = Exclude<AiActionBusyState, 'idle'>

interface ScopedAiGenerationResult {
  readonly documentKey: string
  readonly result: AiGenerationResult
}

interface ScopedAiErrorMessage {
  readonly documentKey: string
  readonly message: string
}

const clampExplorerWidth = (width: number): number =>
  Math.min(EXPLORER_WIDTH_MAX, Math.max(EXPLORER_WIDTH_MIN, Math.round(width)))

const createAiDocumentKey = (workspaceRoot: string, filePath: string): string =>
  `${workspaceRoot}\u0000${filePath}`

const removeAiDocumentEntry = <Value,>(
  entries: Readonly<Record<string, Value>>,
  documentKey: string
): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(entries).filter(([candidateKey]) => candidateKey !== documentKey)
  ) as Record<string, Value>

const getWindowTitle = (workspace: Workspace | null): string => {
  if (!workspace) {
    return 'MDE'
  }

  if (workspace.type === 'file') {
    return `${workspace.name} - ${workspace.rootPath}`
  }

  return workspace.rootPath
}

const createRecentWorkspace = (workspace: Workspace): RecentWorkspace =>
  workspace.type === 'file' && workspace.filePath && workspace.openedFilePath
    ? {
        filePath: workspace.filePath,
        name: workspace.name,
        openedFilePath: workspace.openedFilePath,
        rootPath: workspace.rootPath,
        type: 'file'
      }
    : {
        name: workspace.name,
        rootPath: workspace.rootPath,
        type: 'workspace'
      }

const readSystemThemeFamily = (): AppThemeFamily => {
  try {
    return window.matchMedia?.(SYSTEM_DARK_COLOR_SCHEME_QUERY).matches
      ? 'dark'
      : 'light'
  } catch {
    return 'light'
  }
}

export const App = (): React.JSX.Element => {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialAppState)
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_WIDTH_DEFAULT)
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false)
  const [editorViewMode, setEditorViewMode] = useState(readEditorViewMode)
  const [themePreference, setThemePreference] = useState(readThemePreference)
  const [systemThemeFamily, setSystemThemeFamily] =
    useState<AppThemeFamily>(readSystemThemeFamily)
  const [isResizingExplorer, setIsResizingExplorer] = useState(false)
  const [hasResolvedInitialLaunchPath, setHasResolvedInitialLaunchPath] =
    useState(() => !window.editorApi)
  const [recentWorkspaces, setRecentWorkspaces] = useState(
    readRecentWorkspaces
  )
  const [workspaceFileHistory, setWorkspaceFileHistory] = useState(
    readWorkspaceFileHistory
  )
  const [aiTools, setAiTools] = useState<readonly AiTool[]>([])
  const [aiSettings, setAiSettings] = useState(() =>
    readAiCliSettings(globalThis.localStorage)
  )
  const [aiResult, setAiResult] = useState<ScopedAiGenerationResult | null>(null)
  const [aiErrorMessage, setAiErrorMessage] =
    useState<ScopedAiErrorMessage | null>(null)
  const [aiBusyStatesByDocument, setAiBusyStatesByDocument] = useState<
    Record<string, ActiveAiActionBusyState>
  >({})
  const [isTranslateMenuOpen, setIsTranslateMenuOpen] = useState(false)
  const [customAiTranslationLanguages, setCustomAiTranslationLanguages] =
    useState(readCustomAiTranslationLanguages)
  const [customAiTranslationLanguageInput, setCustomAiTranslationLanguageInput] =
    useState('')
  const [availableUpdate, setAvailableUpdate] =
    useState<AvailableUpdate | null>(null)
  const [updateStatus, setUpdateStatus] =
    useState<UpdateDialogStatus | null>(null)
  const [updateProgress, setUpdateProgress] =
    useState<UpdateDownloadProgress | null>(null)
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(
    null
  )
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false)
  const appShellRef = useRef<HTMLElement | null>(null)
  const editorRef = useRef<MarkdownBlockEditorHandle | null>(null)
  const hasConsumedInitialLaunchPathRef = useRef(false)

  const rememberOpenedWorkspace = useCallback((workspace: Workspace): void => {
    writeActiveWorkspace(globalThis.localStorage, createRecentWorkspace(workspace))
    setRecentWorkspaces((currentWorkspaces) => {
      const nextWorkspaces = rememberWorkspace(currentWorkspaces, workspace)

      writeRecentWorkspaces(globalThis.localStorage, nextWorkspaces)

      return nextWorkspaces
    })
  }, [])

  const updateWorkspaceFileHistory = useCallback((
    createNextHistory: (history: WorkspaceFileHistory) => WorkspaceFileHistory
  ): void => {
    setWorkspaceFileHistory((currentHistory) => {
      const nextHistory = createNextHistory(currentHistory)

      writeWorkspaceFileHistory(nextHistory)

      return nextHistory
    })
  }, [])

  const updateThemePreference = useCallback((
    createNextPreference: (preference: ThemePreference) => ThemePreference
  ): void => {
    setThemePreference((currentPreference) => {
      const nextPreference = createNextPreference(currentPreference)

      writeThemePreference(globalThis.localStorage, nextPreference)

      return nextPreference
    })
  }, [])

  const updateAiSettings = useCallback((settings: AiCliSettings): void => {
    writeAiCliSettings(globalThis.localStorage, settings)
    setAiSettings(settings)
  }, [])

  const clearAiResultState = useCallback((): void => {
    setAiResult(null)
    setAiErrorMessage(null)
    setAiBusyStatesByDocument({})
    setIsTranslateMenuOpen(false)
  }, [])

  const closeAiMenus = useCallback((): void => {
    setIsTranslateMenuOpen(false)
  }, [])

  const clearAiDocumentResult = useCallback((documentKey: string): void => {
    setAiResult((currentResult) =>
      currentResult?.documentKey === documentKey ? null : currentResult
    )
  }, [])

  const clearAiDocumentError = useCallback((documentKey: string): void => {
    setAiErrorMessage((currentError) =>
      currentError?.documentKey === documentKey ? null : currentError
    )
  }, [])

  const setAiDocumentBusyState = useCallback((
    documentKey: string,
    busyState: ActiveAiActionBusyState
  ): void => {
    setAiBusyStatesByDocument((currentStates) => ({
      ...currentStates,
      [documentKey]: busyState
    }))
  }, [])

  const clearAiDocumentBusyState = useCallback((documentKey: string): void => {
    setAiBusyStatesByDocument((currentStates) =>
      removeAiDocumentEntry(currentStates, documentKey)
    )
  }, [])

  const rememberOpenedFile = useCallback((
    workspaceRoot: string,
    filePath: string
  ): void => {
    updateWorkspaceFileHistory((currentHistory) =>
      rememberWorkspaceFile(currentHistory, workspaceRoot, filePath)
    )
  }, [updateWorkspaceFileHistory])

  const completeWorkspaceOpen = useCallback((workspace: Workspace): void => {
    clearAiResultState()
    dispatch({ type: 'workspace/opened', workspace })
    rememberOpenedWorkspace(workspace)
  }, [clearAiResultState, rememberOpenedWorkspace])

  const loadFile = useCallback(async (
    filePath: string,
    expectedWorkspaceRoot?: string
  ): Promise<void> => {
    const workspaceRoot = expectedWorkspaceRoot ?? state.workspace?.rootPath

    if (!workspaceRoot) {
      dispatch({
        filePath,
        message: 'Open a workspace before reading files',
        type: 'file/load-failed',
        workspaceRoot: ''
      })
      return
    }

    closeAiMenus()
    dispatch({ type: 'file/load-started', filePath, workspaceRoot })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const file = await window.editorApi.readMarkdownFile(filePath, workspaceRoot)

      dispatch({ type: 'file/loaded', file, workspaceRoot })
      rememberOpenedFile(workspaceRoot, file.path)
    } catch (error) {
      dispatch({
        filePath,
        message: getErrorMessage(error, 'Unable to read file'),
        type: 'file/load-failed',
        workspaceRoot
      })
    }
  }, [closeAiMenus, rememberOpenedFile, state.workspace?.rootPath])

  const loadWorkspaceDefaultFile = useCallback(async (
    workspace: Workspace
  ): Promise<void> => {
    if (workspace.type === 'file' && workspace.openedFilePath) {
      await loadFile(workspace.openedFilePath, workspace.rootPath)
      return
    }

    const lastOpenedFilePath = getWorkspaceLastOpenedFile(
      workspaceFileHistory,
      workspace.rootPath
    )

    if (
      !lastOpenedFilePath ||
      !findFileNodeByPath(workspace.tree, lastOpenedFilePath)
    ) {
      return
    }

    await loadFile(lastOpenedFilePath, workspace.rootPath)
  }, [loadFile, workspaceFileHistory])

  const updateExplorerWidthFromPointer = useCallback((clientX: number): void => {
    const shellLeft = appShellRef.current?.getBoundingClientRect().left ?? 0

    setExplorerWidth(clampExplorerWidth(clientX - shellLeft))
  }, [])

  useEffect(() => {
    document.title = getWindowTitle(state.workspace)
  }, [state.workspace])

  useEffect(() => {
    const aiApi = window.aiApi

    if (!aiApi) {
      return
    }

    let isCancelled = false

    void aiApi.detectTools().then((result) => {
      if (!isCancelled) {
        setAiTools(result.tools)
      }
    }).catch((error: unknown) => {
      console.warn('MDE AI CLI detection failed', error)
    })

    return () => {
      isCancelled = true
    }
  }, [])

  const showAvailableUpdate = useCallback((
    update: AvailableUpdate,
    status?: UpdateDialogStatus
  ): void => {
    setAvailableUpdate(update)
    setUpdateErrorMessage(null)
    setUpdateProgress(null)
    setIsUpdateDismissed(false)
    setUpdateStatus(
      status ??
        (update.installMode === 'restart-to-install'
          ? 'downloading'
          : 'available')
    )
  }, [])

  useEffect(() => {
    let mediaQueryList: MediaQueryList

    try {
      mediaQueryList = window.matchMedia(SYSTEM_DARK_COLOR_SCHEME_QUERY)
    } catch {
      return
    }

    const updateSystemThemeFamily = (
      eventOrQueryList: MediaQueryList | MediaQueryListEvent
    ): void => {
      setSystemThemeFamily(eventOrQueryList.matches ? 'dark' : 'light')
    }

    updateSystemThemeFamily(mediaQueryList)
    mediaQueryList.addEventListener?.('change', updateSystemThemeFamily)
    mediaQueryList.addListener?.(updateSystemThemeFamily)

    return () => {
      mediaQueryList.removeEventListener?.('change', updateSystemThemeFamily)
      mediaQueryList.removeListener?.(updateSystemThemeFamily)
    }
  }, [])

  useEffect(() => {
    const updateApi = window.updateApi

    if (!updateApi) {
      return
    }

    let isCancelled = false

    const showUpdate = (
      update: AvailableUpdate,
      status?: UpdateDialogStatus
    ): void => {
      if (isCancelled) {
        return
      }

      showAvailableUpdate(update, status)
    }

    const unsubscribeProgress = updateApi.onUpdateDownloadProgress(
      (progress) => {
        if (isCancelled) {
          return
        }

        setUpdateProgress(progress)
        setUpdateStatus('downloading')
      }
    )
    const unsubscribeAvailable = updateApi.onUpdateAvailable((update) => {
      showUpdate(update)
    })
    const unsubscribeReady = updateApi.onUpdateReady((update) => {
      showUpdate(update, 'ready')
    })

    void updateApi.checkForUpdates().then((result) => {
      if (result.updateAvailable && result.update) {
        showUpdate(result.update)
      }
    }).catch((error: unknown) => {
      console.warn('MDE update check failed', error)
    })

    return () => {
      isCancelled = true
      unsubscribeProgress()
      unsubscribeAvailable()
      unsubscribeReady()
    }
  }, [showAvailableUpdate])

  useEffect(() => {
    if (!isResizingExplorer) {
      return
    }

    const updateWidth = (event: PointerEvent): void => {
      updateExplorerWidthFromPointer(event.clientX)
    }
    const stopResizing = (): void => {
      setIsResizingExplorer(false)
    }

    document.body.classList.add('is-resizing-explorer')
    window.addEventListener('pointermove', updateWidth)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      document.body.classList.remove('is-resizing-explorer')
      window.removeEventListener('pointermove', updateWidth)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [isResizingExplorer, updateExplorerWidthFromPointer])

  const openWorkspace = async (): Promise<void> => {
    dispatch({ type: 'workspace/open-started' })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const workspace = await window.editorApi.openWorkspace()

      if (!workspace) {
        dispatch({ type: 'workspace/open-cancelled' })
        return
      }

      completeWorkspaceOpen(workspace)
      await loadWorkspaceDefaultFile(workspace)
    } catch (error) {
      dispatch({
        type: 'workspace/open-failed',
        message: getErrorMessage(error, 'Unable to open workspace')
      })
    }
  }

  const openFile = async (): Promise<void> => {
    dispatch({ type: 'workspace/open-started' })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const workspace = await window.editorApi.openFile()

      if (!workspace) {
        dispatch({ type: 'workspace/open-cancelled' })
        return
      }

      completeWorkspaceOpen(workspace)
      await loadWorkspaceDefaultFile(workspace)
    } catch (error) {
      dispatch({
        type: 'workspace/open-failed',
        message: getErrorMessage(error, 'Unable to open file')
      })
    }
  }

  const switchWorkspace = useCallback(async (
    workspace: RecentWorkspace
  ): Promise<void> => {
    dispatch({ type: 'workspace/open-started' })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const openedWorkspace =
        workspace.type === 'file'
          ? await window.editorApi.openFileByPath(workspace.filePath)
          : await window.editorApi.openWorkspaceByPath(workspace.rootPath)

      completeWorkspaceOpen(openedWorkspace)
      await loadWorkspaceDefaultFile(openedWorkspace)
    } catch (error) {
      dispatch({
        type: 'workspace/open-failed',
        message: getErrorMessage(error, 'Unable to switch workspace')
      })
    }
  }, [completeWorkspaceOpen, loadWorkspaceDefaultFile])

  const openPath = useCallback(async (resourcePath: string): Promise<void> => {
    dispatch({ type: 'workspace/open-started' })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const workspace = await window.editorApi.openPath(resourcePath)

      completeWorkspaceOpen(workspace)
      await loadWorkspaceDefaultFile(workspace)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to open launch path'),
        type: 'workspace/open-failed'
      })
    }
  }, [completeWorkspaceOpen, loadWorkspaceDefaultFile])

  useEffect(() => {
    const editorApi = window.editorApi

    if (!editorApi || hasConsumedInitialLaunchPathRef.current) {
      return
    }

    let isCancelled = false

    hasConsumedInitialLaunchPathRef.current = true
    void editorApi.consumeLaunchPath().then((resourcePath) => {
      if (isCancelled) {
        return
      }

      if (resourcePath) {
        void openPath(resourcePath).finally(() => {
          if (!isCancelled) {
            setHasResolvedInitialLaunchPath(true)
          }
        })
        return
      }

      const activeWorkspace = readActiveWorkspace(globalThis.localStorage)

      if (activeWorkspace) {
        void switchWorkspace(activeWorkspace).finally(() => {
          if (!isCancelled) {
            setHasResolvedInitialLaunchPath(true)
          }
        })
        return
      }

      setHasResolvedInitialLaunchPath(true)
    })

    const unsubscribe = editorApi.onLaunchPath((resourcePath) => {
      void openPath(resourcePath)
    })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [openPath, switchWorkspace])

  const forgetWorkspace = (workspace: RecentWorkspace): void => {
    setRecentWorkspaces((currentWorkspaces) => {
      const nextWorkspaces = forgetRecentWorkspace(currentWorkspaces, workspace)

      writeRecentWorkspaces(globalThis.localStorage, nextWorkspaces)

      return nextWorkspaces
    })
  }

  const refreshWorkspaceTree = useCallback(async (workspaceRoot?: string): Promise<void> => {
    const scopedWorkspaceRoot = workspaceRoot ?? state.workspace?.rootPath

    if (!scopedWorkspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const tree = await window.editorApi.listDirectory('')

      dispatch({
        tree,
        type: 'workspace/tree-refreshed',
        workspaceRoot: scopedWorkspaceRoot
      })
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to refresh workspace'),
        type: 'workspace/operation-failed',
        workspaceRoot: scopedWorkspaceRoot
      })
    }
  }, [state.workspace?.rootPath])

  const saveCurrentFile = useCallback(
    async (serializedMarkdown?: string): Promise<void> => {
      const loadedFile = state.loadedFile
      const workspaceRoot = state.workspace?.rootPath

      if (!loadedFile || !workspaceRoot) {
        return
      }

      dispatch({
        filePath: loadedFile.path,
        type: 'file/save-started',
        workspaceRoot
      })

      try {
        if (!window.editorApi) {
          throw new Error('Editor API unavailable. Restart the app and try again.')
        }

        const contents =
          serializedMarkdown ??
          state.draftMarkdown ??
          (await editorRef.current?.getMarkdown()) ??
          loadedFile.contents

        await window.editorApi.writeMarkdownFile(
          loadedFile.path,
          contents,
          workspaceRoot
        )
        dispatch({
          contents,
          filePath: loadedFile.path,
          type: 'file/save-succeeded',
          workspaceRoot
        })
      } catch (error) {
        dispatch({
          filePath: loadedFile.path,
          message: getErrorMessage(error, 'Unable to save file'),
          type: 'file/save-failed',
          workspaceRoot
        })
      }
    },
    [state.draftMarkdown, state.loadedFile, state.workspace?.rootPath]
  )

  const uploadImageAsset = useCallback(
    async (file: File): Promise<string> => {
      const loadedFilePath = state.loadedFile?.path
      const workspaceRoot = state.workspace?.rootPath

      if (!loadedFilePath || !workspaceRoot) {
        throw new Error('Open a Markdown file before pasting images')
      }

      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const result = await window.editorApi.saveImageAsset(
        loadedFilePath,
        file.name,
        file.type,
        await file.arrayBuffer(),
        workspaceRoot
      )

      await refreshWorkspaceTree(workspaceRoot)

      return result.fileUrl
    },
    [refreshWorkspaceTree, state.loadedFile?.path, state.workspace?.rootPath]
  )

  const getLatestMarkdownForAi = useCallback(async (): Promise<string> => {
    const loadedFile = state.loadedFile

    if (!loadedFile) {
      throw new Error('Open a Markdown file before using AI actions')
    }

    const contents =
      (await editorRef.current?.getMarkdown()) ??
      state.draftMarkdown ??
      loadedFile.contents

    if (contents !== loadedFile.contents) {
      await saveCurrentFile(contents)
    }

    return contents
  }, [saveCurrentFile, state.draftMarkdown, state.loadedFile])

  const summarizeMarkdown = useCallback(async (
    instruction?: string
  ): Promise<void> => {
    const aiApi = window.aiApi
    const loadedFile = state.loadedFile
    const workspaceRoot = state.workspace?.rootPath

    if (!aiApi || !loadedFile || !workspaceRoot) {
      return
    }

    const documentKey = createAiDocumentKey(workspaceRoot, loadedFile.path)
    const trimmedInstruction = instruction?.trim()
    const normalizedInstruction =
      trimmedInstruction && trimmedInstruction.length > 0
        ? trimmedInstruction
        : undefined

    setAiDocumentBusyState(
      documentKey,
      normalizedInstruction ? 'refining-summary' : 'summarizing'
    )
    clearAiDocumentError(documentKey)

    if (!normalizedInstruction) {
      clearAiDocumentResult(documentKey)
    }

    try {
      const markdown = await getLatestMarkdownForAi()
      const generationOptions = resolveAiGenerationOptions(aiSettings, aiTools)
      const result = await aiApi.summarizeMarkdown(
        loadedFile.path,
        markdown,
        workspaceRoot,
        normalizedInstruction,
        generationOptions
      )

      setAiResult({ documentKey, result })
    } catch (error) {
      setAiErrorMessage({
        documentKey,
        message: getErrorMessage(error, 'Unable to summarize Markdown')
      })
    } finally {
      clearAiDocumentBusyState(documentKey)
    }
  }, [
    clearAiDocumentBusyState,
    clearAiDocumentError,
    clearAiDocumentResult,
    getLatestMarkdownForAi,
    aiSettings,
    aiTools,
    setAiDocumentBusyState,
    state.loadedFile,
    state.workspace?.rootPath
  ])

  const translateMarkdown = useCallback(async (language: string): Promise<void> => {
    const aiApi = window.aiApi
    const loadedFile = state.loadedFile
    const workspaceRoot = state.workspace?.rootPath

    if (!aiApi || !loadedFile || !workspaceRoot) {
      return
    }

    const documentKey = createAiDocumentKey(workspaceRoot, loadedFile.path)

    setIsTranslateMenuOpen(false)
    setAiDocumentBusyState(documentKey, 'translating')
    clearAiDocumentError(documentKey)
    clearAiDocumentResult(documentKey)

    try {
      const markdown = await getLatestMarkdownForAi()
      const generationOptions = resolveAiGenerationOptions(aiSettings, aiTools)
      const result = await aiApi.translateMarkdown(
        loadedFile.path,
        markdown,
        language,
        workspaceRoot,
        generationOptions
      )

      setAiResult({ documentKey, result })
    } catch (error) {
      setAiErrorMessage({
        documentKey,
        message: getErrorMessage(error, 'Unable to translate Markdown')
      })
    } finally {
      clearAiDocumentBusyState(documentKey)
    }
  }, [
    clearAiDocumentBusyState,
    clearAiDocumentError,
    clearAiDocumentResult,
    getLatestMarkdownForAi,
    aiSettings,
    aiTools,
    setAiDocumentBusyState,
    state.loadedFile,
    state.workspace?.rootPath
  ])

  const rememberCustomTranslationLanguage = useCallback((): void => {
    setCustomAiTranslationLanguages((currentLanguages) => {
      const nextLanguages = rememberCustomAiTranslationLanguage(
        globalThis.localStorage,
        currentLanguages,
        customAiTranslationLanguageInput
      )

      return nextLanguages
    })
    setCustomAiTranslationLanguageInput('')
  }, [customAiTranslationLanguageInput])

  const forgetCustomTranslationLanguage = useCallback(
    (language: string): void => {
      setCustomAiTranslationLanguages((currentLanguages) =>
        forgetCustomAiTranslationLanguage(
          globalThis.localStorage,
          currentLanguages,
          language
        )
      )
    },
    []
  )

  useEffect(() => {
    const loadedFilePath = state.loadedFile?.path
    const workspaceRoot = state.workspace?.rootPath

    if (
      !state.isDirty ||
      state.isSavingFile ||
      !loadedFilePath ||
      !workspaceRoot
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentFile(state.draftMarkdown ?? undefined)
    }, AUTO_SAVE_IDLE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    saveCurrentFile,
    state.draftMarkdown,
    state.isDirty,
    state.isSavingFile,
    state.loadedFile?.path,
    state.workspace?.rootPath
  ])

  useEffect(() => {
    const saveOnShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') {
        return
      }

      event.preventDefault()
      void saveCurrentFile()
    }

    window.addEventListener('keydown', saveOnShortcut)

    return () => {
      window.removeEventListener('keydown', saveOnShortcut)
    }
  }, [saveCurrentFile])

  const createMarkdownFile = async (promptedPath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath
    const filePath = ensureMarkdownExtension(promptedPath)

    if (!workspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      await window.editorApi.createMarkdownFile(filePath, workspaceRoot)
      await refreshWorkspaceTree(workspaceRoot)
      await loadFile(filePath, workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to create Markdown file'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const createFolder = async (folderPath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath

    if (!workspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      await window.editorApi.createFolder(folderPath, workspaceRoot)
      await refreshWorkspaceTree(workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to create folder'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const renameSelectedEntry = async (promptedName: string): Promise<void> => {
    const selectedEntryPath = state.selectedEntryPath
    const workspaceRoot = state.workspace?.rootPath

    if (!selectedEntryPath || !state.workspace || !workspaceRoot) {
      return
    }

    const selectedNode = findNodeByPath(state.workspace.tree, selectedEntryPath)
    const parentPath = getParentPath(selectedEntryPath)
    const nextEntryName =
      selectedNode?.type === 'file'
        ? ensureMarkdownExtension(promptedName)
        : promptedName
    const nextEntryPath = joinWorkspacePath(parentPath, nextEntryName)

    if (nextEntryPath === selectedEntryPath) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const result = await window.editorApi.renameEntry(
        selectedEntryPath,
        nextEntryPath,
        workspaceRoot
      )

      dispatch({
        newPath: result.path,
        oldPath: selectedEntryPath,
        type: 'file/entry-renamed',
        workspaceRoot
      })
      updateWorkspaceFileHistory((currentHistory) =>
        renameWorkspaceFileHistoryEntry(
          currentHistory,
          workspaceRoot,
          selectedEntryPath,
          result.path
        )
      )
      await refreshWorkspaceTree(workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to rename entry'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const deleteSelectedEntry = async (): Promise<void> => {
    const selectedEntryPath = state.selectedEntryPath
    const workspaceRoot = state.workspace?.rootPath

    if (!selectedEntryPath || !workspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      await window.editorApi.deleteEntry(selectedEntryPath, workspaceRoot)
      dispatch({
        entryPath: selectedEntryPath,
        type: 'file/entry-deleted',
        workspaceRoot
      })
      updateWorkspaceFileHistory((currentHistory) =>
        removeWorkspaceFileHistoryEntry(
          currentHistory,
          workspaceRoot,
          selectedEntryPath
        )
      )
      await refreshWorkspaceTree(workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to delete entry'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const beginExplorerResize = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    event.preventDefault()
    updateExplorerWidthFromPointer(event.clientX)
    setIsResizingExplorer(true)
  }

  const resizeExplorerFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>
  ): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setExplorerWidth((currentWidth) => clampExplorerWidth(currentWidth - 16))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setExplorerWidth((currentWidth) => clampExplorerWidth(currentWidth + 16))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setExplorerWidth(EXPLORER_WIDTH_MIN)
    } else if (event.key === 'End') {
      event.preventDefault()
      setExplorerWidth(EXPLORER_WIDTH_MAX)
    }
  }

  const checkForUpdatesFromSettings = useCallback(async (): Promise<
    UpdateCheckResult
  > => {
    const updateApi = window.updateApi

    if (!updateApi) {
      return {
        currentVersion: APP_VERSION,
        message: 'Update checks are unavailable in this runtime.',
        updateAvailable: false
      }
    }

    const result = await updateApi.checkForUpdates()

    if (result.updateAvailable && result.update) {
      showAvailableUpdate(result.update)
    }

    return result
  }, [showAvailableUpdate])

  const installUpdate = async (): Promise<void> => {
    const updateApi = window.updateApi

    if (!updateApi || !availableUpdate) {
      return
    }

    setUpdateErrorMessage(null)

    try {
      if (availableUpdate.installMode === 'open-dmg') {
        setUpdateStatus('downloading')
        await updateApi.downloadAndOpenUpdate()
        setUpdateStatus('ready')
        setUpdateProgress({
          downloadedBytes: availableUpdate.assetSize ?? 0,
          percent: 100,
          totalBytes: availableUpdate.assetSize ?? null
        })
        return
      }

      await updateApi.installWindowsUpdate()
    } catch (error) {
      setUpdateStatus('failed')
      setUpdateErrorMessage(getErrorMessage(error, 'Unable to install update'))
    }
  }

  const dismissUpdate = (): void => {
    setIsUpdateDismissed(true)
    setUpdateStatus(null)
  }

  const appShellStyle: CSSProperties & Record<'--explorer-width', string> = {
    '--explorer-width': `${explorerWidth}px`
  }
  const isEditorFullWidth = editorViewMode === 'full-width'
  const resolvedTheme = resolveThemePreference(themePreference, systemThemeFamily)
  const editorViewToggleLabel = isEditorFullWidth
    ? 'Use centered editor view'
    : 'Use full-width editor view'
  const currentAiDocumentKey =
    state.workspace && state.loadedFile
      ? createAiDocumentKey(state.workspace.rootPath, state.loadedFile.path)
      : null
  const currentAiBusyState: AiActionBusyState = currentAiDocumentKey
    ? (aiBusyStatesByDocument[currentAiDocumentKey] ?? 'idle')
    : 'idle'
  const currentAiResult =
    currentAiDocumentKey && aiResult?.documentKey === currentAiDocumentKey
      ? aiResult.result
      : null
  const currentAiErrorMessage =
    currentAiDocumentKey && aiErrorMessage?.documentKey === currentAiDocumentKey
      ? aiErrorMessage.message
      : null
  const shouldShowAiActions = aiTools.length > 0 && Boolean(state.loadedFile)
  const recentFilePaths = state.workspace
    ? getWorkspaceRecentFiles(workspaceFileHistory, state.workspace.rootPath)
    : []

  return (
    <main
      className={[
        'app-shell',
        isExplorerCollapsed ? 'is-explorer-collapsed' : '',
        isResizingExplorer ? 'is-resizing-explorer' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-panel-family={resolvedTheme.panelFamily}
      data-theme={resolvedTheme.id}
      data-theme-family={resolvedTheme.family}
      data-theme-mode={themePreference.mode}
      ref={appShellRef}
      style={appShellStyle}
    >
      <ExplorerPane
        aiSettings={aiSettings}
        aiTools={aiTools}
        appVersion={APP_VERSION}
        isCollapsed={isExplorerCollapsed}
        onAiSettingsChange={updateAiSettings}
        onCheckForUpdates={checkForUpdatesFromSettings}
        onCreateFile={(filePath) => {
          void createMarkdownFile(filePath)
        }}
        onCreateFolder={(folderPath) => {
          void createFolder(folderPath)
        }}
        onDeleteEntry={() => {
          void deleteSelectedEntry()
        }}
        onForgetWorkspace={forgetWorkspace}
        onOpenFile={() => {
          void openFile()
        }}
        onOpenRecentFile={(filePath) => {
          void loadFile(filePath)
        }}
        onOpenWorkspace={() => {
          void openWorkspace()
        }}
        onRenameEntry={(entryName) => {
          void renameSelectedEntry(entryName)
        }}
        onSelectEntry={(entryPath) => {
          dispatch({ type: 'explorer/entry-selected', entryPath })
        }}
        onSelectFile={(filePath) => {
          void loadFile(filePath)
        }}
        onSwitchWorkspace={(workspace) => {
          void switchWorkspace(workspace)
        }}
        onToggleCollapsed={() => {
          setIsExplorerCollapsed((currentValue) => !currentValue)
        }}
        onSelectTheme={(themeId: AppThemeId) => {
          updateThemePreference((currentPreference) =>
            selectAppTheme(currentPreference, themeId)
          )
        }}
        onToggleSystemTheme={(shouldFollowSystem) => {
          updateThemePreference((currentPreference) =>
            shouldFollowSystem
              ? enableSystemThemePreference(currentPreference)
              : disableSystemThemePreference(
                  currentPreference,
                  resolvedTheme.family
                )
          )
        }}
        recentFilePaths={recentFilePaths}
        recentWorkspaces={recentWorkspaces}
        resolvedTheme={resolvedTheme}
        shouldAutoOpenWorkspaceDialog={
          hasResolvedInitialLaunchPath &&
          !state.workspace &&
          !state.isOpeningWorkspace
        }
        state={state}
        themePreference={themePreference}
      />
      {!isExplorerCollapsed ? (
        <div
          aria-label="Resize explorer sidebar"
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
          'editor-pane',
          isEditorFullWidth ? 'is-editor-full-width' : '',
          currentAiResult ? 'is-ai-result-active' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Editor"
      >
        <div className="editor-action-bar" aria-label="Editor actions">
          {shouldShowAiActions ? (
            <AiActionMenu
              busyState={currentAiBusyState}
              customLanguageInput={customAiTranslationLanguageInput}
              customLanguages={customAiTranslationLanguages}
              isTranslateMenuOpen={isTranslateMenuOpen}
              onAddCustomLanguage={rememberCustomTranslationLanguage}
              onCustomLanguageInputChange={setCustomAiTranslationLanguageInput}
              onForgetCustomLanguage={forgetCustomTranslationLanguage}
              onSummarize={() => {
                void summarizeMarkdown()
              }}
              onToggleTranslateMenu={() => {
                setIsTranslateMenuOpen((currentValue) => !currentValue)
              }}
              onTranslate={(language) => {
                void translateMarkdown(language)
              }}
            />
          ) : null}
          <button
            aria-label={editorViewToggleLabel}
            aria-pressed={isEditorFullWidth}
            className="editor-action-button"
            onClick={() => {
              setEditorViewMode((currentMode) => {
                const nextMode =
                  currentMode === 'full-width' ? 'centered' : 'full-width'

                writeEditorViewMode(globalThis.localStorage, nextMode)

                return nextMode
              })
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
              <StretchHorizontal
                aria-hidden="true"
                size={17}
                strokeWidth={2}
              />
            )}
          </button>
        </div>
        {currentAiErrorMessage ? (
          <p className="ai-result-error" role="alert">
            {currentAiErrorMessage}
          </p>
        ) : null}
        {currentAiResult ? (
          <AiResultPanel
            colorScheme={resolvedTheme.family}
            isRegeneratingSummary={currentAiBusyState === 'refining-summary'}
            onClose={() => {
              if (currentAiDocumentKey) {
                clearAiDocumentResult(currentAiDocumentKey)
              }
            }}
            onRegenerateSummary={(instruction) => {
              void summarizeMarkdown(instruction)
            }}
            result={currentAiResult}
            workspaceRoot={state.workspace?.rootPath ?? ''}
          />
        ) : state.loadedFile ? (
          <MarkdownBlockEditor
            key={`${state.workspace?.rootPath ?? ''}:${state.loadedFile.path}`}
            draftMarkdown={state.draftMarkdown ?? state.loadedFile.contents}
            colorScheme={resolvedTheme.family}
            errorMessage={state.fileErrorMessage}
            isDirty={state.isDirty}
            isSaving={state.isSavingFile}
            markdown={state.loadedFile.contents}
            onImageUpload={uploadImageAsset}
            onMarkdownChange={(contents) => {
              const workspaceRoot = state.workspace?.rootPath

              if (!workspaceRoot || !state.loadedFile) {
                return
              }

              dispatch({
                contents,
                filePath: state.loadedFile.path,
                type: 'file/content-changed',
                workspaceRoot
              })
            }}
            onSaveRequest={saveCurrentFile}
            path={state.loadedFile.path}
            ref={editorRef}
            workspaceRoot={state.workspace?.rootPath ?? ''}
          />
        ) : (
          <div className="editor-empty-state">
            <p className="editor-kicker">MDE</p>
            <h1>{state.selectedFilePath ?? 'Select a folder to begin'}</h1>
            {state.isLoadingFile ? <p>Loading file...</p> : null}
            {state.fileErrorMessage ? (
              <p className="editor-error" role="alert">
                {state.fileErrorMessage}
              </p>
            ) : null}
          </div>
        )}
      </section>
      {availableUpdate && updateStatus && !isUpdateDismissed ? (
        <UpdateDialog
          errorMessage={updateErrorMessage}
          onDismiss={dismissUpdate}
          onInstall={() => {
            void installUpdate()
          }}
          progress={updateProgress}
          status={updateStatus}
          update={availableUpdate}
        />
      ) : null}
    </main>
  )
}
