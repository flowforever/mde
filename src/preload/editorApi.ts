import type * as Electron from 'electron'

import { WORKSPACE_CHANNELS } from '../main/ipc/channels'
import type { TreeNode } from '../shared/fileTree'
import type { EditorApi } from '../shared/workspace'

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
    >
})
