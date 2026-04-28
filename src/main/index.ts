import { join } from 'node:path'

import type {
  App,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  WebContents,
} from 'electron'

import {
  getTestWorkspacePath,
  registerWorkspaceHandlers
} from './ipc/registerWorkspaceHandlers'
import { registerFileHandlers } from './ipc/registerFileHandlers'
import { createMarkdownFileService } from './services/markdownFileService'
import { createWorkspaceService } from './services/workspaceService'

type BrowserWindowConstructor = typeof BrowserWindow
interface StartupDiagnostics {
  errors: string[]
  output: string[]
}

declare global {
  var __mdvStartupDiagnostics: StartupDiagnostics | undefined
}

const startupDiagnosticPattern = /preload|security|unable to load preload/i

const getStartupDiagnostics = (): StartupDiagnostics | undefined => {
  if (process.env.MDV_CAPTURE_STARTUP_DIAGNOSTICS !== '1') {
    return undefined
  }

  globalThis.__mdvStartupDiagnostics ??= {
    errors: [],
    output: []
  }

  return globalThis.__mdvStartupDiagnostics
}

const recordStartupError = (message: string): void => {
  const diagnostics = getStartupDiagnostics()

  if (!diagnostics) {
    return
  }

  diagnostics.errors.push(message)
  diagnostics.output.push(message)
}

const captureStartupDiagnostics = (webContents: WebContents): void => {
  if (!getStartupDiagnostics()) {
    return
  }

  webContents.on('preload-error', (_event, preloadPath, error) => {
    recordStartupError(`Preload error in ${preloadPath}: ${error.message}`)
  })

  webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 || startupDiagnosticPattern.test(message)) {
      recordStartupError(message)
    }
  })

  webContents.on('render-process-gone', (_event, details) => {
    recordStartupError(
      `Render process gone: ${details.reason} (${details.exitCode})`
    )
  })
}

export const createPreloadPath = (mainDirectory: string): string =>
  join(mainDirectory, '../preload/index.mjs')

export const createWindowOptions = (
  preloadPath: string
): BrowserWindowConstructorOptions => ({
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600,
  backgroundColor: '#fbf7ef',
  show: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: preloadPath,
    sandbox: true
  }
})

const createMainWindow = async (
  BrowserWindow: BrowserWindowConstructor
): Promise<void> => {
  const window = new BrowserWindow(
    createWindowOptions(createPreloadPath(__dirname))
  )

  captureStartupDiagnostics(window.webContents)

  window.once('ready-to-show', () => {
    window.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))
}

const bootstrap = async (): Promise<void> => {
  const { app, BrowserWindow, dialog, ipcMain } = (await import('electron')) as {
    app: App
    BrowserWindow: BrowserWindowConstructor
    dialog: Electron.Dialog
    ipcMain: Electron.IpcMain
  }

  await app.whenReady()
  const workspaceSession = registerWorkspaceHandlers({
    dialog,
    ipcMain,
    testWorkspacePath: getTestWorkspacePath(),
    workspaceService: createWorkspaceService()
  })
  registerFileHandlers({
    getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
    ipcMain,
    markdownFileService: createMarkdownFileService()
  })
  await createMainWindow(BrowserWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow(BrowserWindow)
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

if (!process.env.VITEST) {
  void bootstrap()
}
