import type * as Electron from 'electron'

declare const require: (moduleName: 'electron') => Pick<
  typeof Electron,
  'contextBridge'
>

const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('markdownEditorShell', {
  preloadLoaded: true
})
