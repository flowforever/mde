import type { IpcMain } from 'electron'

import type { MarkdownFileService } from '../services/markdownFileService'
import { FILE_CHANNELS } from './channels'

interface RegisterFileHandlersOptions {
  readonly getActiveWorkspaceRoot: () => string | null
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly markdownFileService: MarkdownFileService
}

export const registerFileHandlers = ({
  getActiveWorkspaceRoot,
  ipcMain,
  markdownFileService
}: RegisterFileHandlersOptions): void => {
  ipcMain.handle(FILE_CHANNELS.readMarkdownFile, async (_event, filePath: string) => {
    const activeWorkspaceRoot = getActiveWorkspaceRoot()

    if (!activeWorkspaceRoot) {
      throw new Error('Open a workspace before reading files')
    }

    return markdownFileService.readMarkdownFile(activeWorkspaceRoot, filePath)
  })
}
