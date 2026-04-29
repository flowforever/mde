import type * as Electron from 'electron'

declare const require: (moduleName: 'electron') => Pick<
  typeof Electron,
  'contextBridge' | 'ipcRenderer'
>

import { createEditorApi } from './editorApi'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('markdownEditorShell', {
  preloadLoaded: true
})

contextBridge.exposeInMainWorld('editorApi', createEditorApi(ipcRenderer))
