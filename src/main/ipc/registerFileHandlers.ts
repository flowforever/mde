import type { IpcMain } from 'electron'

import type { MarkdownFileService } from '../services/markdownFileService'
import { FILE_CHANNELS } from './channels'

interface RegisterFileHandlersOptions {
  readonly getActiveWorkspaceRoot: () => string | null
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly markdownFileService: MarkdownFileService
}

const getRequiredWorkspaceRoot = (
  getActiveWorkspaceRoot: () => string | null,
  expectedWorkspaceRoot: string
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot()

  if (!activeWorkspaceRoot) {
    throw new Error('Open a workspace before managing files')
  }

  if (activeWorkspaceRoot !== expectedWorkspaceRoot) {
    throw new Error('Workspace changed before file operation completed')
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
  ipcMain.handle(
    FILE_CHANNELS.readMarkdownFile,
    async (_event, filePath, workspaceRoot) =>
      markdownFileService.readMarkdownFile(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.writeMarkdownFile,
    async (_event, filePath, contents, workspaceRoot) =>
      markdownFileService.writeMarkdownFile(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path'),
        assertStringInput(contents, 'File contents')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.createMarkdownFile,
    async (_event, filePath, workspaceRoot) =>
      markdownFileService.createMarkdownFile(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.createFolder,
    async (_event, folderPath, workspaceRoot) =>
      markdownFileService.createFolder(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(folderPath, 'Folder path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.renameEntry,
    async (_event, oldPath, newPath, workspaceRoot) =>
      markdownFileService.renameEntry(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(oldPath, 'Old path'),
        assertStringInput(newPath, 'New path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.deleteEntry,
    async (_event, entryPath, workspaceRoot) =>
      markdownFileService.deleteEntry(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(entryPath, 'Entry path')
      )
  )
}
