import type { IpcMain } from 'electron'

import type { MarkdownFileService } from '../services/markdownFileService'
import { FILE_CHANNELS } from './channels'

interface RegisterFileHandlersOptions {
  readonly getActiveWorkspaceRoot: () => string | null
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly markdownFileService: MarkdownFileService
}

const getRequiredWorkspaceRoot = (
  getActiveWorkspaceRoot: () => string | null
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot()

  if (!activeWorkspaceRoot) {
    throw new Error('Open a workspace before managing files')
  }

  return activeWorkspaceRoot
}

const assertStringInput = (value: unknown, name: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }

  return value
}

export const registerFileHandlers = ({
  getActiveWorkspaceRoot,
  ipcMain,
  markdownFileService
}: RegisterFileHandlersOptions): void => {
  ipcMain.handle(FILE_CHANNELS.readMarkdownFile, async (_event, filePath) =>
    markdownFileService.readMarkdownFile(
      getRequiredWorkspaceRoot(getActiveWorkspaceRoot),
      assertStringInput(filePath, 'File path')
    )
  )

  ipcMain.handle(FILE_CHANNELS.writeMarkdownFile, async (_event, filePath, contents) =>
    markdownFileService.writeMarkdownFile(
      getRequiredWorkspaceRoot(getActiveWorkspaceRoot),
      assertStringInput(filePath, 'File path'),
      assertStringInput(contents, 'File contents')
    )
  )

  ipcMain.handle(FILE_CHANNELS.createMarkdownFile, async (_event, filePath) =>
    markdownFileService.createMarkdownFile(
      getRequiredWorkspaceRoot(getActiveWorkspaceRoot),
      assertStringInput(filePath, 'File path')
    )
  )

  ipcMain.handle(FILE_CHANNELS.createFolder, async (_event, folderPath) =>
    markdownFileService.createFolder(
      getRequiredWorkspaceRoot(getActiveWorkspaceRoot),
      assertStringInput(folderPath, 'Folder path')
    )
  )

  ipcMain.handle(FILE_CHANNELS.renameEntry, async (_event, oldPath, newPath) =>
    markdownFileService.renameEntry(
      getRequiredWorkspaceRoot(getActiveWorkspaceRoot),
      assertStringInput(oldPath, 'Old path'),
      assertStringInput(newPath, 'New path')
    )
  )

  ipcMain.handle(FILE_CHANNELS.deleteEntry, async (_event, entryPath) =>
    markdownFileService.deleteEntry(
      getRequiredWorkspaceRoot(getActiveWorkspaceRoot),
      assertStringInput(entryPath, 'Entry path')
    )
  )
}
