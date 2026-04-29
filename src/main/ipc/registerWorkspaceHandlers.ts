import type { Dialog, IpcMain } from 'electron'

import type { WorkspaceService } from '../services/workspaceService'
import { WORKSPACE_CHANNELS } from './channels'

interface RegisterWorkspaceHandlersOptions {
  readonly dialog: Pick<Dialog, 'showOpenDialog'>
  readonly initialLaunchPath?: string | null | undefined
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly testFilePath?: string | undefined
  readonly testWorkspacePath?: string | undefined
  readonly workspaceService: WorkspaceService
}

export interface WorkspaceHandlerSession {
  readonly getActiveWorkspaceRoot: () => string | null
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
  testFilePath,
  testWorkspacePath,
  workspaceService
}: RegisterWorkspaceHandlersOptions): WorkspaceHandlerSession => {
  let activeWorkspaceRoot: string | null = null
  let pendingLaunchPath: string | null = initialLaunchPath

  const openWorkspaceByPath = async (workspacePath: string) => {
    const workspace = await workspaceService.openWorkspace(workspacePath)

    activeWorkspaceRoot = workspace.rootPath

    return workspace
  }

  const openFileByPath = async (filePath: string) => {
    const workspace = await workspaceService.openMarkdownFile(filePath)

    activeWorkspaceRoot = workspace.rootPath

    return workspace
  }

  const openPath = async (resourcePath: string) => {
    const workspace = await workspaceService.openPath(resourcePath)

    activeWorkspaceRoot = workspace.rootPath

    return workspace
  }

  ipcMain.handle(WORKSPACE_CHANNELS.openWorkspace, async () => {
    if (testWorkspacePath) {
      return openWorkspaceByPath(testWorkspacePath)
    }

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return openWorkspaceByPath(result.filePaths[0] ?? '')
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.openWorkspaceByPath,
    async (_event, workspacePath: unknown) => {
      if (typeof workspacePath !== 'string') {
        throw new Error('Workspace path must be a string')
      }

      return openWorkspaceByPath(workspacePath)
    }
  )

  ipcMain.handle(WORKSPACE_CHANNELS.openFile, async () => {
    if (testFilePath) {
      return openFileByPath(testFilePath)
    }

    const result = await dialog.showOpenDialog({
      filters: [{ extensions: ['md'], name: 'Markdown' }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return openFileByPath(result.filePaths[0] ?? '')
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.openFileByPath,
    async (_event, filePath: unknown) => {
      if (typeof filePath !== 'string') {
        throw new Error('File path must be a string')
      }

      return openFileByPath(filePath)
    }
  )

  ipcMain.handle(WORKSPACE_CHANNELS.consumeLaunchPath, () => {
    const launchPath = pendingLaunchPath

    pendingLaunchPath = null

    return Promise.resolve(launchPath)
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.openPath,
    async (_event, resourcePath: unknown) => {
      if (typeof resourcePath !== 'string') {
        throw new Error('Launch path must be a string')
      }

      return openPath(resourcePath)
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.listDirectory,
    async (_event, directoryPath: string) => {
      if (!activeWorkspaceRoot) {
        throw new Error('Open a workspace before listing directories')
      }

      return workspaceService.listDirectory(activeWorkspaceRoot, directoryPath)
    }
  )

  return {
    getActiveWorkspaceRoot: () => activeWorkspaceRoot
  }
}
