import { dirname, join } from 'node:path'

import type {
  App,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  WebContents,
} from 'electron'

import {
  getTestFilePath,
  getTestWorkspacePath,
  registerWorkspaceHandlers
} from './ipc/registerWorkspaceHandlers'
import { getLaunchPathFromArgv } from './launchArgs'
import { WORKSPACE_CHANNELS } from './ipc/channels'
import { registerFileHandlers } from './ipc/registerFileHandlers'
import { createMarkdownFileService } from './services/markdownFileService'
import { createWorkspaceService } from './services/workspaceService'
import {
  APP_PRODUCT_NAME,
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  STARTUP_DIAGNOSTICS_GLOBAL_KEY
} from '../shared/appIdentity'
import { configureAutoUpdates, resolveAutoUpdater } from './autoUpdate'

export {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  STARTUP_DIAGNOSTICS_GLOBAL_KEY
} from '../shared/appIdentity'

type BrowserWindowConstructor = typeof BrowserWindow
interface StartupDiagnostics {
  errors: string[]
  output: string[]
}

declare global {
  var __mdeStartupDiagnostics: StartupDiagnostics | undefined
}

type StartupDiagnosticsGlobal = typeof globalThis & {
  [STARTUP_DIAGNOSTICS_GLOBAL_KEY]?: StartupDiagnostics
}

const startupDiagnosticPattern = /preload|security|unable to load preload/i
const DEV_PRODUCT_NAME = `${APP_PRODUCT_NAME} Dev`

interface RuntimeIdentityApp {
  readonly isPackaged: boolean
  getPath(name: 'userData'): string
  setName(name: string): void
  setPath(name: 'userData', path: string): void
}

const getDevelopmentUserDataPath = (currentUserDataPath: string): string =>
  currentUserDataPath.endsWith(DEV_PRODUCT_NAME)
    ? currentUserDataPath
    : join(dirname(currentUserDataPath), DEV_PRODUCT_NAME)

export const configureRuntimeIdentity = (app: RuntimeIdentityApp): void => {
  if (app.isPackaged) {
    return
  }

  app.setName(DEV_PRODUCT_NAME)
  app.setPath('userData', getDevelopmentUserDataPath(app.getPath('userData')))
}

const getStartupDiagnostics = (): StartupDiagnostics | undefined => {
  if (process.env[CAPTURE_STARTUP_DIAGNOSTICS_ENV] !== '1') {
    return undefined
  }

  const diagnosticsGlobal = globalThis as StartupDiagnosticsGlobal

  diagnosticsGlobal[STARTUP_DIAGNOSTICS_GLOBAL_KEY] ??= {
    errors: [],
    output: []
  }

  return diagnosticsGlobal[STARTUP_DIAGNOSTICS_GLOBAL_KEY]
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
): Promise<BrowserWindow> => {
  const window = new BrowserWindow(
    createWindowOptions(createPreloadPath(__dirname))
  )

  captureStartupDiagnostics(window.webContents)

  window.once('ready-to-show', () => {
    window.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
    return window
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

const bootstrap = async (): Promise<void> => {
  const { app, BrowserWindow, dialog, ipcMain } = (await import('electron')) as {
    app: App
    BrowserWindow: BrowserWindowConstructor
    dialog: Electron.Dialog
    ipcMain: Electron.IpcMain
  }
  const electronUpdaterModule = await import('electron-updater')
  configureRuntimeIdentity(app)
  const initialLaunchPath = getLaunchPathFromArgv()
  const hasSingleInstanceLock =
    process.env[DISABLE_SINGLE_INSTANCE_ENV] === '1' ||
    app.requestSingleInstanceLock()

  if (!hasSingleInstanceLock) {
    app.quit()
    return
  }

  let mainWindow: BrowserWindow | null = null
  const setMainWindow = (window: BrowserWindow): void => {
    mainWindow = window

    window.once('closed', () => {
      if (mainWindow === window) {
        mainWindow = null
      }
    })
  }

  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    const launchPath = getLaunchPathFromArgv(commandLine, workingDirectory)

    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()

    if (launchPath) {
      mainWindow.webContents.send(WORKSPACE_CHANNELS.launchPath, launchPath)
    }
  })

  await app.whenReady()
  configureAutoUpdates({
    app,
    autoUpdater: resolveAutoUpdater(electronUpdaterModule)
  })
  const workspaceSession = registerWorkspaceHandlers({
    dialog,
    initialLaunchPath,
    ipcMain,
    testFilePath: getTestFilePath(),
    testWorkspacePath: getTestWorkspacePath(),
    workspaceService: createWorkspaceService()
  })
  registerFileHandlers({
    getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
    ipcMain,
    markdownFileService: createMarkdownFileService()
  })
  setMainWindow(await createMainWindow(BrowserWindow))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow(BrowserWindow).then(setMainWindow)
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
