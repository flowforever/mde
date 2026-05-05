import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { fileURLToPath } from 'node:url'
import { isAbsolute } from 'node:path'

import {
  createDocumentHistoryService,
  type DocumentHistoryService
} from '../services/documentHistoryService'
import type { MarkdownFileService } from '../services/markdownFileService'
import { FILE_CHANNELS } from './channels'

type FileClipboard = Pick<Electron.Clipboard, 'readText' | 'writeText'> &
  Partial<
    Pick<Electron.Clipboard, 'availableFormats' | 'read' | 'readBuffer'>
  >

interface RegisterFileHandlersOptions {
  readonly clipboard?: FileClipboard
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null
  readonly documentHistoryService?: DocumentHistoryService
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

const assertStringArrayInput = (
  value: unknown,
  name: string
): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be a string array`)
  }

  return value.map((item) => assertStringInput(item, name))
}

const normalizeClipboardPath = (rawPath: string): string | null => {
  const trimmedPath = rawPath.trim()

  if (trimmedPath.length === 0) {
    return null
  }

  if (trimmedPath.startsWith('file://')) {
    try {
      return fileURLToPath(trimmedPath)
    } catch {
      return null
    }
  }

  return isAbsolute(trimmedPath) ? trimmedPath : null
}

const addClipboardPathsFromText = (paths: Set<string>, text: string): void => {
  text
    .split(/\0|\r?\n/)
    .map(normalizeClipboardPath)
    .forEach((entryPath) => {
      if (entryPath) {
        paths.add(entryPath)
      }
    })
}

const readClipboardFilePaths = (clipboard: FileClipboard): readonly string[] => {
  const paths = new Set<string>()

  addClipboardPathsFromText(paths, clipboard.readText())

  const readableFormats = new Set([
    'text/uri-list',
    'public.file-url',
    'public.url',
    'text/plain'
  ])

  clipboard
    .availableFormats?.()
    .filter((format) => readableFormats.has(format))
    .forEach((format) => {
      addClipboardPathsFromText(paths, clipboard.read?.(format) ?? '')
    })

  clipboard
    .availableFormats?.()
    .filter((format) => format === 'NSFilenamesPboardType')
    .forEach((format) => {
      const contents = clipboard.readBuffer?.(format)

      if (!contents || contents.length === 0) {
        return
      }

      addClipboardPathsFromText(paths, contents.toString('utf8'))
      addClipboardPathsFromText(paths, contents.toString('utf16le'))
    })

  return Array.from(paths)
}

export const registerFileHandlers = ({
  clipboard,
  documentHistoryService = createDocumentHistoryService(),
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
    FILE_CHANNELS.markdownFileExists,
    async (event, filePath, workspaceRoot) =>
      markdownFileService.markdownFileExists(
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
    FILE_CHANNELS.searchWorkspaceMarkdown,
    async (event, query, workspaceRoot) =>
      markdownFileService.searchMarkdownFiles(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(query, 'Search query')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.listDocumentHistory,
    async (event, filePath, workspaceRoot) =>
      documentHistoryService.listDocumentHistory(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(filePath, 'File path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.listDeletedDocumentHistory,
    async (event, workspaceRoot) =>
      documentHistoryService.markExternalDeletes(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        )
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.readDocumentHistoryVersion,
    async (event, versionId, workspaceRoot) =>
      documentHistoryService.readVersion(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(versionId, 'Version id')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.restoreDocumentHistoryVersion,
    async (event, versionId, workspaceRoot) =>
      documentHistoryService.restoreVersion(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(versionId, 'Version id')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.restoreDeletedDocumentHistoryVersion,
    async (event, versionId, workspaceRoot) =>
      documentHistoryService.restoreVersion(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(versionId, 'Version id')
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
    FILE_CHANNELS.copyWorkspaceEntry,
    async (event, sourcePath, targetDirectoryPath, workspaceRoot) =>
      markdownFileService.copyWorkspaceEntry(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(sourcePath, 'Source path'),
        assertStringInput(targetDirectoryPath, 'Target directory path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.pasteExternalEntries,
    async (event, sourcePaths, targetDirectoryPath, workspaceRoot) =>
      markdownFileService.pasteExternalEntries(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringArrayInput(sourcePaths, 'Source paths'),
        assertStringInput(targetDirectoryPath, 'Target directory path')
      )
  )

  ipcMain.handle(
    FILE_CHANNELS.pasteClipboardEntries,
    async (event, targetDirectoryPath, workspaceRoot) => {
      if (!clipboard) {
        throw new Error('Clipboard is unavailable')
      }

      const sourcePaths = readClipboardFilePaths(clipboard)

      if (sourcePaths.length === 0) {
        throw new Error('Clipboard does not contain files')
      }

      return markdownFileService.pasteExternalEntries(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        sourcePaths,
        assertStringInput(targetDirectoryPath, 'Target directory path')
      )
    }
  )

  ipcMain.handle(FILE_CHANNELS.readClipboardText, () => {
    if (!clipboard) {
      throw new Error('Clipboard is unavailable')
    }

    return clipboard.readText()
  })

  ipcMain.handle(FILE_CHANNELS.writeClipboardText, (_event, contents) => {
    if (!clipboard) {
      throw new Error('Clipboard is unavailable')
    }

    clipboard.writeText(assertStringInput(contents, 'Clipboard contents'))
  })

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
