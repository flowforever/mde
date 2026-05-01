import type { Dialog, IpcMain, WebContents } from 'electron'

import type { WorkspaceLaunchResource } from '../../shared/workspace'
import type { WorkspaceService } from '../services/workspaceService'
import { WORKSPACE_CHANNELS } from './channels'

interface RegisterWorkspaceHandlersOptions {
  readonly dialog: Pick<Dialog, 'showOpenDialog'>
  readonly initialLaunchPath?: string | null | undefined
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly openExternalLink?: (url: string) => Promise<void> | void
  readonly openPathInNewWindow?: (
    resourcePath: WorkspaceLaunchResource
  ) => Promise<void> | void
  readonly rememberRecentResource?: (resourcePath: string) => void
  readonly testFilePath?: string | undefined
  readonly testWorkspacePath?: string | undefined
  readonly workspaceService: WorkspaceService
}

interface WorkspaceIpcEvent {
  readonly sender?: {
    readonly id?: number
  }
}

export interface WorkspaceHandlerSession {
  readonly getActiveWorkspaceRoot: (event?: WorkspaceIpcEvent | null) => string | null
  readonly removeWindow: (sender: Pick<WebContents, 'id'>) => void
  readonly setPendingLaunchPath: (
    sender: Pick<WebContents, 'id'>,
    launchPath: WorkspaceLaunchResource | null
  ) => void
}

interface WorkspaceWindowState {
  readonly id: number
  activeWorkspaceRoot: string | null
  pendingLaunchPath: WorkspaceLaunchResource | null
}

const DEFAULT_WINDOW_ID = 0

const getSenderId = (
  event?: WorkspaceIpcEvent | null
): number => {
  const senderId = event?.sender?.id

  return typeof senderId === 'number' ? senderId : DEFAULT_WINDOW_ID
}

export const getTestWorkspacePath = (
  argv: readonly string[] = process.argv
): string | undefined => {
  const prefix = '--test-workspace='
  const argument = argv.find((value) => value.startsWith(prefix))

  return argument?.slice(prefix.length)
}

export const getTestFilePath = (
  argv: readonly string[] = process.argv
): string | undefined => {
  const prefix = '--test-file='
  const argument = argv.find((value) => value.startsWith(prefix))

  return argument?.slice(prefix.length)
}

export const registerWorkspaceHandlers = ({
  dialog,
  initialLaunchPath = null,
  ipcMain,
  openExternalLink,
  openPathInNewWindow,
  rememberRecentResource = () => undefined,
  testFilePath,
  testWorkspacePath,
  workspaceService
}: RegisterWorkspaceHandlersOptions): WorkspaceHandlerSession => {
  const statesByWindowId = new Map<number, WorkspaceWindowState>([
    [
      DEFAULT_WINDOW_ID,
      {
        activeWorkspaceRoot: null,
        id: DEFAULT_WINDOW_ID,
        pendingLaunchPath: initialLaunchPath
      }
    ]
  ])

  const getWindowState = (
    event?: WorkspaceIpcEvent | null
  ): WorkspaceWindowState => {
    const id = getSenderId(event)
    const existingState = statesByWindowId.get(id)

    if (existingState) {
      return existingState
    }

    const state: WorkspaceWindowState = {
      activeWorkspaceRoot: null,
      id,
      pendingLaunchPath: null
    }

    statesByWindowId.set(id, state)

    return state
  }

  const rememberWorkspaceResource = (workspace: {
    readonly filePath?: string
    readonly rootPath: string
    readonly type?: 'file' | 'workspace'
  }): void => {
    rememberRecentResource(
      workspace.type === 'file' && workspace.filePath
        ? workspace.filePath
        : workspace.rootPath
    )
  }

  const openResourceInNewWindow = async (
    resourcePath: WorkspaceLaunchResource
  ): Promise<void> => {
    if (!openPathInNewWindow) {
      throw new Error('Opening resources in a new window is unavailable')
    }

    await openPathInNewWindow(resourcePath)
  }

  const assertHttpUrl = (value: unknown): string => {
    if (typeof value !== 'string') {
      throw new Error('External link must be a string')
    }

    let url: URL

    try {
      url = new URL(value)
    } catch {
      throw new Error('External link must be an HTTP or HTTPS URL')
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('External link must be an HTTP or HTTPS URL')
    }

    return url.toString()
  }

  const openHttpUrlExternally = async (url: string): Promise<void> => {
    if (!openExternalLink) {
      throw new Error('Opening external links is unavailable')
    }

    await openExternalLink(url)
  }

  const openWorkspaceByPath = async (
    event: WorkspaceIpcEvent | null,
    workspacePath: string
  ) => {
    const workspace = await workspaceService.openWorkspace(workspacePath)
    const state = getWindowState(event)

    state.activeWorkspaceRoot = workspace.rootPath
    rememberWorkspaceResource(workspace)

    return workspace
  }

  const openFileByPath = async (
    event: WorkspaceIpcEvent | null,
    filePath: string
  ) => {
    const workspace = await workspaceService.openMarkdownFile(filePath)
    const state = getWindowState(event)

    state.activeWorkspaceRoot = workspace.rootPath
    rememberWorkspaceResource(workspace)

    return workspace
  }

  const openPath = async (
    event: WorkspaceIpcEvent | null,
    resourcePath: string
  ) => {
    const workspace = await workspaceService.openPath(resourcePath)
    const state = getWindowState(event)

    state.activeWorkspaceRoot = workspace.rootPath
    rememberWorkspaceResource(workspace)

    return workspace
  }

  ipcMain.handle(WORKSPACE_CHANNELS.openWorkspace, async (event) => {
    if (testWorkspacePath) {
      return openWorkspaceByPath(event, testWorkspacePath)
    }

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return openWorkspaceByPath(event, result.filePaths[0] ?? '')
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.openWorkspaceByPath,
    async (event, workspacePath: unknown) => {
      if (typeof workspacePath !== 'string') {
        throw new Error('Workspace path must be a string')
      }

      return openWorkspaceByPath(event, workspacePath)
    }
  )

  ipcMain.handle(WORKSPACE_CHANNELS.openWorkspaceInNewWindow, async () => {
    if (testWorkspacePath) {
      await openResourceInNewWindow(testWorkspacePath)
      return true
    }

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return false
    }

    await openResourceInNewWindow(result.filePaths[0] ?? '')

    return true
  })

  ipcMain.handle(WORKSPACE_CHANNELS.openFile, async (event) => {
    if (testFilePath) {
      return openFileByPath(event, testFilePath)
    }

    const result = await dialog.showOpenDialog({
      filters: [{ extensions: ['md'], name: 'Markdown' }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return openFileByPath(event, result.filePaths[0] ?? '')
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.openFileByPath,
    async (event, filePath: unknown) => {
      if (typeof filePath !== 'string') {
        throw new Error('File path must be a string')
      }

      return openFileByPath(event, filePath)
    }
  )

  ipcMain.handle(WORKSPACE_CHANNELS.openFileInNewWindow, async () => {
    if (testFilePath) {
      await openResourceInNewWindow(testFilePath)
      return true
    }

    const result = await dialog.showOpenDialog({
      filters: [{ extensions: ['md'], name: 'Markdown' }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return false
    }

    await openResourceInNewWindow(result.filePaths[0] ?? '')

    return true
  })

  ipcMain.handle(WORKSPACE_CHANNELS.consumeLaunchPath, (event) => {
    const state = getWindowState(event)
    const launchPath = state.pendingLaunchPath

    state.pendingLaunchPath = null

    return Promise.resolve(launchPath)
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.openPath,
    async (event, resourcePath: unknown) => {
      if (typeof resourcePath !== 'string') {
        throw new Error('Launch path must be a string')
      }

      return openPath(event, resourcePath)
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.openPathInNewWindow,
    async (_event, resourcePath: unknown) => {
      if (typeof resourcePath !== 'string') {
        throw new Error('Launch path must be a string')
      }

      await openResourceInNewWindow(resourcePath)
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.openWorkspaceFileInNewWindow,
    async (_event, workspaceRoot: unknown, filePath: unknown) => {
      if (typeof workspaceRoot !== 'string') {
        throw new Error('Workspace root must be a string')
      }

      if (typeof filePath !== 'string') {
        throw new Error('File path must be a string')
      }

      await openResourceInNewWindow({
        filePath,
        type: 'workspace-file',
        workspaceRoot
      })
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.openExternalLink,
    async (_event, url: unknown) => {
      await openHttpUrlExternally(assertHttpUrl(url))
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.listDirectory,
    async (event, directoryPath: string) => {
      const activeWorkspaceRoot = getWindowState(event).activeWorkspaceRoot

      if (!activeWorkspaceRoot) {
        throw new Error('Open a workspace before listing directories')
      }

      return workspaceService.listDirectory(activeWorkspaceRoot, directoryPath)
    }
  )

  return {
    getActiveWorkspaceRoot: (event) => getWindowState(event).activeWorkspaceRoot,
    removeWindow: (sender) => {
      statesByWindowId.delete(sender.id)
    },
    setPendingLaunchPath: (sender, launchPath) => {
      const existingState = statesByWindowId.get(sender.id)

      statesByWindowId.set(sender.id, {
        activeWorkspaceRoot: existingState?.activeWorkspaceRoot ?? null,
        id: sender.id,
        pendingLaunchPath: launchPath
      })
    }
  }
}
