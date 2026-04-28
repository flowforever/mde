import type { Dialog, IpcMain } from 'electron'

import type { WorkspaceService } from '../services/workspaceService'
import { WORKSPACE_CHANNELS } from './channels'

interface RegisterWorkspaceHandlersOptions {
  readonly dialog: Pick<Dialog, 'showOpenDialog'>
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly testWorkspacePath?: string | undefined
  readonly workspaceService: WorkspaceService
}

export const getTestWorkspacePath = (
  argv: readonly string[] = process.argv
): string | undefined => {
  const prefix = '--test-workspace='
  const argument = argv.find((value) => value.startsWith(prefix))

  return argument?.slice(prefix.length)
}

export const registerWorkspaceHandlers = ({
  dialog,
  ipcMain,
  testWorkspacePath,
  workspaceService
}: RegisterWorkspaceHandlersOptions): void => {
  ipcMain.handle(WORKSPACE_CHANNELS.openWorkspace, async () => {
    if (testWorkspacePath) {
      return workspaceService.openWorkspace(testWorkspacePath)
    }

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return workspaceService.openWorkspace(result.filePaths[0] ?? '')
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.listDirectory,
    (_event, workspacePath: string, directoryPath: string) =>
      workspaceService.listDirectory(workspacePath, directoryPath)
  )
}
