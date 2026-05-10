import type * as Electron from 'electron'

declare const require: (moduleName: 'electron') => Pick<
  typeof Electron,
  'contextBridge' | 'ipcRenderer' | 'webUtils'
>

import { createEditorApi } from './editorApi'
import { createAutomationApi } from './automationApi'
import { createAiApi } from './aiApi'
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
  openAutomationCenter: () =>
    ipcRenderer.invoke(WINDOW_CHANNELS.openAutomationCenter) as Promise<void>
}

contextBridge.exposeInMainWorld('mdeWindow', mdeWindowApi)
contextBridge.exposeInMainWorld('mdeAutomation', createAutomationApi(ipcRenderer))
contextBridge.exposeInMainWorld('editorApi', createEditorApi(ipcRenderer, webUtils))
contextBridge.exposeInMainWorld('aiApi', createAiApi(ipcRenderer))
contextBridge.exposeInMainWorld('updateApi', createUpdateApi(ipcRenderer))
