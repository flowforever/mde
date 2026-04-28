import type * as Electron from 'electron'

import { FILE_CHANNELS, WORKSPACE_CHANNELS } from '../main/ipc/channels'
import type { TreeNode } from '../shared/fileTree'
import type { EditorApi, FileContents } from '../shared/workspace'

type IpcRenderer = Pick<typeof Electron.ipcRenderer, 'invoke'>

export const createEditorApi = (ipcRenderer: IpcRenderer): EditorApi => ({
  listDirectory: (directoryPath) =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.listDirectory,
      directoryPath
    ) as Promise<readonly TreeNode[]>,
  openWorkspace: () =>
    ipcRenderer.invoke(WORKSPACE_CHANNELS.openWorkspace) as Promise<
      Awaited<ReturnType<EditorApi['openWorkspace']>>
    >,
  readMarkdownFile: (filePath) =>
    ipcRenderer.invoke(FILE_CHANNELS.readMarkdownFile, filePath) as Promise<FileContents>,
  writeMarkdownFile: (filePath, contents) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.writeMarkdownFile,
      filePath,
      contents
    ) as Promise<FileContents>,
  createMarkdownFile: (filePath) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.createMarkdownFile,
      filePath
    ) as Promise<FileContents>,
  createFolder: (folderPath) =>
    ipcRenderer.invoke(FILE_CHANNELS.createFolder, folderPath) as Promise<void>,
  renameEntry: (oldPath, newPath) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.renameEntry,
      oldPath,
      newPath
    ) as Promise<Awaited<ReturnType<EditorApi['renameEntry']>>>,
  deleteEntry: (entryPath) =>
    ipcRenderer.invoke(FILE_CHANNELS.deleteEntry, entryPath) as Promise<void>
})
