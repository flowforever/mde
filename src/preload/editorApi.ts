import type * as Electron from 'electron'

import { FILE_CHANNELS, WORKSPACE_CHANNELS } from '../main/ipc/channels'
import type { TreeNode } from '../shared/fileTree'
import type { EditorApi, FileContents, ImageAsset } from '../shared/workspace'

type IpcRenderer = Pick<
  typeof Electron.ipcRenderer,
  'invoke' | 'on' | 'removeListener'
>

export const createEditorApi = (ipcRenderer: IpcRenderer): EditorApi => ({
  consumeLaunchPath: () =>
    ipcRenderer.invoke(WORKSPACE_CHANNELS.consumeLaunchPath) as Promise<
      string | null
    >,
  listDirectory: (directoryPath) =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.listDirectory,
      directoryPath
    ) as Promise<readonly TreeNode[]>,
  onLaunchPath: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      resourcePath: unknown
    ): void => {
      if (typeof resourcePath === 'string') {
        callback(resourcePath)
      }
    }

    ipcRenderer.on(WORKSPACE_CHANNELS.launchPath, listener)

    return () => {
      ipcRenderer.removeListener(WORKSPACE_CHANNELS.launchPath, listener)
    }
  },
  openFile: () =>
    ipcRenderer.invoke(WORKSPACE_CHANNELS.openFile) as Promise<
      Awaited<ReturnType<EditorApi['openFile']>>
    >,
  openFileByPath: (filePath) =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.openFileByPath,
      filePath
    ) as Promise<Awaited<ReturnType<EditorApi['openFileByPath']>>>,
  openFileInNewWindow: () =>
    ipcRenderer.invoke(WORKSPACE_CHANNELS.openFileInNewWindow) as Promise<boolean>,
  openPath: (resourcePath) =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.openPath,
      resourcePath
    ) as Promise<Awaited<ReturnType<EditorApi['openPath']>>>,
  openPathInNewWindow: (resourcePath) =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.openPathInNewWindow,
      resourcePath
    ) as Promise<void>,
  openWorkspace: () =>
    ipcRenderer.invoke(WORKSPACE_CHANNELS.openWorkspace) as Promise<
      Awaited<ReturnType<EditorApi['openWorkspace']>>
    >,
  openWorkspaceByPath: (workspaceRoot) =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.openWorkspaceByPath,
      workspaceRoot
    ) as Promise<Awaited<ReturnType<EditorApi['openWorkspaceByPath']>>>,
  openWorkspaceInNewWindow: () =>
    ipcRenderer.invoke(
      WORKSPACE_CHANNELS.openWorkspaceInNewWindow
    ) as Promise<boolean>,
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
  saveImageAsset: (markdownFilePath, fileName, mimeType, contents, workspaceRoot) =>
    ipcRenderer.invoke(
      FILE_CHANNELS.saveImageAsset,
      markdownFilePath,
      fileName,
      mimeType,
      contents,
      workspaceRoot
    ) as Promise<ImageAsset>,
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
