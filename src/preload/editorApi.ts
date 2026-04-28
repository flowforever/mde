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
  readMarkdownFile: (filePath, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.readMarkdownFile,
      filePath,
      workspaceRoot
    ) as Promise<FileContents>,
  writeMarkdownFile: (filePath, contents, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.writeMarkdownFile,
      filePath,
      contents,
      workspaceRoot
    ) as Promise<FileContents>,
  createMarkdownFile: (filePath, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.createMarkdownFile,
      filePath,
      workspaceRoot
    ) as Promise<FileContents>,
  createFolder: (folderPath, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.createFolder,
      folderPath,
      workspaceRoot
    ) as Promise<void>,
  renameEntry: (oldPath, newPath, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.renameEntry,
      oldPath,
      newPath,
      workspaceRoot
    ) as Promise<Awaited<ReturnType<EditorApi['renameEntry']>>>,
  deleteEntry: (entryPath, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.deleteEntry,
      entryPath,
      workspaceRoot
    ) as Promise<void>
})
