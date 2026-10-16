import type * as Electron from 'electron'

declare const require: (moduleName: 'electron') => Pick<
  typeof Electron,
  'contextBridge' | 'ipcRenderer' | 'webUtils'
>

import { createEditorApi } from './editorApi'
import { createAiApi } from './aiApi'
import { createAgentChatApi } from './agentChatApi'
import { createUpdateApi } from './updateApi'
import { getWindowModeFromArgv } from '../shared/windowMode'
import { WINDOW_CHANNELS, type MdeWindowApi } from '../shared/windowApi'

const { contextBridge, ipcRenderer, webUtils } = require('electron')

declare const process: {
  readonly argv: readonly string[]
}

contextBridge.exposeInMainWorld('markdownEditorShell', {
  preloadLoaded: true
})

const mdeWindowApi: MdeWindowApi = {
  focusWorkspaceWindow: () =>
    ipcRenderer.invoke(WINDOW_CHANNELS.focusWorkspaceWindow) as Promise<void>,
  getWindowMode: () => getWindowModeFromArgv(process.argv),
}

contextBridge.exposeInMainWorld('mdeWindow', mdeWindowApi)
contextBridge.exposeInMainWorld('agentChatApi', createAgentChatApi(ipcRenderer))
contextBridge.exposeInMainWorld('editorApi', createEditorApi(ipcRenderer, webUtils))
contextBridge.exposeInMainWorld('aiApi', createAiApi(ipcRenderer))
contextBridge.exposeInMainWorld('updateApi', createUpdateApi(ipcRenderer))
