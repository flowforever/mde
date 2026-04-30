import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import type { MarkdownFileService } from '../services/markdownFileService'
import { FILE_CHANNELS } from './channels'

interface RegisterFileHandlersOptions {
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly markdownFileService: MarkdownFileService
}

const getRequiredWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null,
  expectedWorkspaceRoot: string
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot(event)

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

const assertArrayBufferInput = (value: unknown, name: string): ArrayBuffer => {
  if (!(value instanceof ArrayBuffer)) {
    throw new Error(`${name} must be binary data`)
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
    async (event, filePath, workspaceRoot) =>
      markdownFileService.readMarkdownFile(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.writeMarkdownFile,
    async (event, filePath, contents, workspaceRoot) =>
      markdownFileService.writeMarkdownFile(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path'),
        assertStringInput(contents, 'File contents')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.saveImageAsset,
    async (
      event,
      markdownFilePath,
      fileName,
      mimeType,
      contents,
      workspaceRoot
    ) =>
      markdownFileService.saveImageAsset(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        {
          contents: assertArrayBufferInput(contents, 'Image contents'),
          fileName: assertStringInput(fileName, 'File name'),
          markdownFilePath: assertStringInput(
            markdownFilePath,
            'Markdown file path'
          ),
          mimeType: assertStringInput(mimeType, 'MIME type')
        }
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.createMarkdownFile,
    async (event, filePath, workspaceRoot) =>
      markdownFileService.createMarkdownFile(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.createFolder,
    async (event, folderPath, workspaceRoot) =>
      markdownFileService.createFolder(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(folderPath, 'Folder path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.renameEntry,
    async (event, oldPath, newPath, workspaceRoot) =>
      markdownFileService.renameEntry(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(oldPath, 'Old path'),
        assertStringInput(newPath, 'New path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.deleteEntry,
    async (event, entryPath, workspaceRoot) =>
      markdownFileService.deleteEntry(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(entryPath, 'Entry path')
      )
  )
}
