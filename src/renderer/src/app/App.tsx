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

import type { EditorApi, Workspace } from '../../../shared/workspace'
import type {
  AvailableUpdate,
  UpdateApi,
  UpdateDownloadProgress
} from '../../../shared/update'
import { appReducer, createInitialAppState } from './appReducer'
import {
  MarkdownBlockEditor,
  type MarkdownBlockEditorHandle
} from '../editor/MarkdownBlockEditor'
import { ExplorerPane } from '../explorer/ExplorerPane'
import { UpdateDialog, type UpdateDialogStatus } from './UpdateDialog'
import {
  forgetRecentWorkspace,
  readRecentWorkspaces,
  rememberWorkspace,
  type RecentWorkspace,
  writeRecentWorkspaces
} from '../workspaces/recentWorkspaces'
import type { TreeNode } from '../../../shared/fileTree'

declare global {
  interface Window {
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

const clampExplorerWidth = (width: number): number =>
  Math.min(EXPLORER_WIDTH_MAX, Math.max(EXPLORER_WIDTH_MIN, Math.round(width)))

const getWindowTitle = (workspace: Workspace | null): string => {
  if (!workspace) {
    return 'MDE'
  }

  if (workspace.type === 'file') {
    return `${workspace.name} - ${workspace.rootPath}`
  }

  return workspace.rootPath
}

export const App = (): React.JSX.Element => {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialAppState)
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_WIDTH_DEFAULT)
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false)
  const [isResizingExplorer, setIsResizingExplorer] = useState(false)
  const [hasResolvedInitialLaunchPath, setHasResolvedInitialLaunchPath] =
    useState(() => !window.editorApi)
  const [recentWorkspaces, setRecentWorkspaces] = useState(
    readRecentWorkspaces
  )
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

  const rememberOpenedWorkspace = useCallback((workspace: Workspace): void => {
    setRecentWorkspaces((currentWorkspaces) => {
      const nextWorkspaces = rememberWorkspace(currentWorkspaces, workspace)

      writeRecentWorkspaces(globalThis.localStorage, nextWorkspaces)

      return nextWorkspaces
    })
  }, [])

  const completeWorkspaceOpen = useCallback((workspace: Workspace): void => {
    dispatch({ type: 'workspace/opened', workspace })
    rememberOpenedWorkspace(workspace)
  }, [rememberOpenedWorkspace])

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

    dispatch({ type: 'file/load-started', filePath, workspaceRoot })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const file = await window.editorApi.readMarkdownFile(filePath, workspaceRoot)

      dispatch({ type: 'file/loaded', file, workspaceRoot })
    } catch (error) {
      dispatch({
        filePath,
        message: getErrorMessage(error, 'Unable to read file'),
        type: 'file/load-failed',
        workspaceRoot
      })
    }
  }, [state.workspace?.rootPath])

  const loadOpenedWorkspaceFile = useCallback(async (
    workspace: Workspace
  ): Promise<void> => {
    if (workspace.type !== 'file' || !workspace.openedFilePath) {
      return
    }

    await loadFile(workspace.openedFilePath, workspace.rootPath)
  }, [loadFile])

  const updateExplorerWidthFromPointer = useCallback((clientX: number): void => {
    const shellLeft = appShellRef.current?.getBoundingClientRect().left ?? 0

    setExplorerWidth(clampExplorerWidth(clientX - shellLeft))
  }, [])

  useEffect(() => {
    document.title = getWindowTitle(state.workspace)
  }, [state.workspace])

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
  }, [])

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
      await loadOpenedWorkspaceFile(workspace)
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
      await loadOpenedWorkspaceFile(workspace)
    } catch (error) {
      dispatch({
        type: 'workspace/open-failed',
        message: getErrorMessage(error, 'Unable to open file')
      })
    }
  }

  const switchWorkspace = async (
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
      await loadOpenedWorkspaceFile(openedWorkspace)
    } catch (error) {
      dispatch({
        type: 'workspace/open-failed',
        message: getErrorMessage(error, 'Unable to switch workspace')
      })
    }
  }

  const openPath = useCallback(async (resourcePath: string): Promise<void> => {
    dispatch({ type: 'workspace/open-started' })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const workspace = await window.editorApi.openPath(resourcePath)

      completeWorkspaceOpen(workspace)
      await loadOpenedWorkspaceFile(workspace)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to open launch path'),
        type: 'workspace/open-failed'
      })
    }
  }, [completeWorkspaceOpen, loadOpenedWorkspaceFile])

  useEffect(() => {
    const editorApi = window.editorApi

    if (!editorApi) {
      return
    }

    let isCancelled = false

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

      setHasResolvedInitialLaunchPath(true)
    })

    const unsubscribe = editorApi.onLaunchPath((resourcePath) => {
      void openPath(resourcePath)
    })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [openPath])

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

  return (
    <main
      className={[
        'app-shell',
        isExplorerCollapsed ? 'is-explorer-collapsed' : '',
        isResizingExplorer ? 'is-resizing-explorer' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      ref={appShellRef}
      style={appShellStyle}
    >
      <ExplorerPane
        isCollapsed={isExplorerCollapsed}
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
        recentWorkspaces={recentWorkspaces}
        shouldAutoOpenWorkspaceDialog={
          hasResolvedInitialLaunchPath &&
          !state.workspace &&
          !state.isOpeningWorkspace
        }
        state={state}
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
      <section className="editor-pane" aria-label="Editor">
        {state.loadedFile ? (
          <MarkdownBlockEditor
            key={`${state.workspace?.rootPath ?? ''}:${state.loadedFile.path}`}
            draftMarkdown={state.draftMarkdown ?? state.loadedFile.contents}
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
