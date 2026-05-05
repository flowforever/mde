import type * as Electron from 'electron'

declare const require: (moduleName: 'electron') => Pick<
  typeof Electron,
  'contextBridge' | 'ipcRenderer' | 'webUtils'
>

import { createEditorApi } from './editorApi'
import { createAiApi } from './aiApi'
import { createUpdateApi } from './updateApi'

const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('markdownEditorShell', {
  preloadLoaded: true
})

contextBridge.exposeInMainWorld('editorApi', createEditorApi(ipcRenderer, webUtils))
contextBridge.exposeInMainWorld('aiApi', createAiApi(ipcRenderer))
contextBridge.exposeInMainWorld('updateApi', createUpdateApi(ipcRenderer))
