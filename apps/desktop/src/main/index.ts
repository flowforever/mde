import { rm } from 'node:fs/promises'
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
  registerWorkspaceHandlers,
  type WorkspaceHandlerSession
} from './ipc/registerWorkspaceHandlers'
import { getLaunchPathFromArgv } from './launchArgs'
import { registerAiHandlers } from './ipc/registerAiHandlers'
import { registerAutomationHandlers } from './ipc/registerAutomationHandlers'
import { registerFileHandlers } from './ipc/registerFileHandlers'
import { createAiService } from './services/aiService'
import { createAutomationAdapterRegistry } from './services/automation/automationAdapterRegistry'
import {
  createFakeAgentCliAdapter,
  createJsonlAgentCliAdapter
} from './services/automation/agentCliAdapters'
import { createAutomationRuntime } from './services/automation/automationRuntime'
import { createAutomationRuntimeCoordinator } from './services/automation/automationRuntimeCoordinator'
import { createAutomationRuntimeOwner } from './services/automation/automationRuntimeOwner'
import { createAutomationStore } from './services/automation/automationStore'
import { createMdeRuntimeBridge } from './services/automation/mdeRuntimeBridge'
import { registerMdeCliInBackground } from './services/cliRegistrationService'
import { createMarkdownFileService } from './services/markdownFileService'
import { createWorkspaceService } from './services/workspaceService'
import {
  APP_PRODUCT_NAME,
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  STARTUP_DIAGNOSTICS_GLOBAL_KEY
} from '../shared/appIdentity'
import type { WorkspaceLaunchResource } from '../shared/workspace'
import {
  AUTOMATION_CENTER_WINDOW_MODE,
  EDITOR_WINDOW_MODE,
  WINDOW_MODE_ARGUMENT_PREFIX,
  type MdeWindowMode
} from '../shared/windowMode'
import { WINDOW_CHANNELS } from '../shared/windowApi'
import { configureAutoUpdates, resolveAutoUpdater } from './autoUpdate'
import { applyReadyToShowWindowMode } from './e2eWindowMode'

export {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  E2E_WINDOW_MODE_ENV,
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
const E2E_AUTOMATION_AUTONOMY_GATE_ENV = 'MDE_E2E_AUTOMATION_AUTONOMY_GATE'
const E2E_AUTOMATION_JSONL_ADAPTER_ENV = 'MDE_E2E_AUTOMATION_JSONL_ADAPTER'

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
  if (process.env[E2E_USER_DATA_PATH_ENV]) {
    app.setPath('userData', process.env[E2E_USER_DATA_PATH_ENV])
    return
  }

  app.setPath('userData', getDevelopmentUserDataPath(app.getPath('userData')))
}

export const createMoveEntryToTrash =
  (
    shell: Pick<Electron.Shell, 'trashItem'>,
    env: NodeJS.ProcessEnv = process.env
  ) =>
  async (entryPath: string): Promise<void> => {
    if (env[E2E_USER_DATA_PATH_ENV]) {
      await rm(entryPath, { force: false, recursive: true })
      return
    }

    await shell.trashItem(entryPath)
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

const createWindowModeArgument = (windowMode: MdeWindowMode): string =>
  `${WINDOW_MODE_ARGUMENT_PREFIX}${windowMode}`

export const createWindowOptions = (
  preloadPath: string,
  windowMode: MdeWindowMode = EDITOR_WINDOW_MODE
): BrowserWindowConstructorOptions => ({
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600,
  backgroundColor: '#fbf7ef',
  show: false,
  webPreferences: {
    additionalArguments: [createWindowModeArgument(windowMode)],
    contextIsolation: true,
    nodeIntegration: false,
    preload: preloadPath,
    sandbox: true
  }
})

const focusWindow = (window: BrowserWindow): void => {
  if (window.isMinimized()) {
    window.restore()
  }

  window.focus()
}

export const createEditorWindowTracker = (): {
  readonly focusOrCreateMainWindow: (
    openEditorWindow: (() => Promise<BrowserWindow>) | null
  ) => void
  readonly getMainWindow: () => BrowserWindow | null
  readonly setMainWindow: (
    window: BrowserWindow,
    onClosed?: () => void
  ) => void
} => {
  let editorWindows: readonly BrowserWindow[] = []
  let mainWindow: BrowserWindow | null = null

  const removeEditorWindow = (window: BrowserWindow): void => {
    editorWindows = editorWindows.filter(
      (editorWindow) => editorWindow !== window
    )
  }

  return {
    focusOrCreateMainWindow: (openEditorWindow) => {
      if (mainWindow) {
        focusWindow(mainWindow)
        return
      }

      if (openEditorWindow) {
        void openEditorWindow()
      }
    },
    getMainWindow: () => mainWindow,
    setMainWindow: (window, onClosed = () => undefined) => {
      removeEditorWindow(window)
      editorWindows = [...editorWindows, window]
      mainWindow = window

      window.on('focus', () => {
        mainWindow = window
      })

      window.once('closed', () => {
        onClosed()
        removeEditorWindow(window)

        if (mainWindow === window) {
          mainWindow = editorWindows.at(-1) ?? null
        }
      })
    }
  }
}

const createMdeWindow = async (
  BrowserWindow: BrowserWindowConstructor,
  windowMode: MdeWindowMode,
  onWindowCreated: (window: BrowserWindow) => void = () => undefined
): Promise<BrowserWindow> => {
  const window = new BrowserWindow(
    createWindowOptions(createPreloadPath(__dirname), windowMode)
  )

  captureStartupDiagnostics(window.webContents)
  onWindowCreated(window)

  window.once('ready-to-show', () => {
    applyReadyToShowWindowMode(window)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
    return window
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

export const createMainWindow = async (
  BrowserWindow: BrowserWindowConstructor,
  onWindowCreated: (window: BrowserWindow) => void = () => undefined
): Promise<BrowserWindow> =>
  createMdeWindow(BrowserWindow, EDITOR_WINDOW_MODE, onWindowCreated)

export const createAutomationCenterWindow = async (
  BrowserWindow: BrowserWindowConstructor,
  onWindowCreated: (window: BrowserWindow) => void = () => undefined
): Promise<BrowserWindow> =>
  createMdeWindow(BrowserWindow, AUTOMATION_CENTER_WINDOW_MODE, onWindowCreated)

export const createAutomationCenterWindowManager = (
  BrowserWindow: BrowserWindowConstructor,
  onWindowCreated: (window: BrowserWindow) => void = () => undefined
): {
  readonly openOrFocusAutomationCenterWindow: () => Promise<BrowserWindow>
} => {
  let automationCenterWindow: BrowserWindow | null = null

  const setAutomationCenterWindow = (window: BrowserWindow): void => {
    automationCenterWindow = window

    window.once('closed', () => {
      if (automationCenterWindow === window) {
        automationCenterWindow = null
      }
    })

    onWindowCreated(window)
  }

  return {
    openOrFocusAutomationCenterWindow: async () => {
      if (automationCenterWindow) {
        focusWindow(automationCenterWindow)
        return automationCenterWindow
      }

      return createAutomationCenterWindow(
        BrowserWindow,
        setAutomationCenterWindow
      )
    }
  }
}

const bootstrap = async (): Promise<void> => {
  const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = (await import(
    'electron'
  )) as {
    app: App
    BrowserWindow: BrowserWindowConstructor
    clipboard: Electron.Clipboard
    dialog: Electron.Dialog
    ipcMain: Electron.IpcMain
    shell: Electron.Shell
  }
  const electronUpdaterModule =
    process.platform === 'win32' ? await import('electron-updater') : undefined
  configureRuntimeIdentity(app)
  const initialLaunchPath = getLaunchPathFromArgv()
  const hasSingleInstanceLock =
    process.env[DISABLE_SINGLE_INSTANCE_ENV] === '1' ||
    app.requestSingleInstanceLock()

  if (!hasSingleInstanceLock) {
    app.quit()
    return
  }

  const editorWindowTracker = createEditorWindowTracker()
  let openAutomationCenterWindow:
    | (() => Promise<BrowserWindow>)
    | null = null
  let workspaceSession: WorkspaceHandlerSession | null = null
  let openAppWindow:
    | ((launchPath?: WorkspaceLaunchResource | null) => Promise<BrowserWindow>)
    | null = null
  const setMainWindow = (window: BrowserWindow): void => {
    const webContentsId = window.webContents.id

    editorWindowTracker.setMainWindow(window, () => {
      workspaceSession?.removeWindow({ id: webContentsId })
    })
  }

  const focusMainWindow = (): void => {
    const createEditorWindow = openAppWindow

    editorWindowTracker.focusOrCreateMainWindow(
      createEditorWindow ? () => createEditorWindow(null) : null
    )
  }

  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    const launchPath = getLaunchPathFromArgv(commandLine, workingDirectory)

    if (launchPath && openAppWindow) {
      void openAppWindow(launchPath)
      return
    }

    focusMainWindow()
  })

  await app.whenReady()
  registerMdeCliInBackground({ app })
  configureAutoUpdates({
    app,
    autoUpdater: resolveAutoUpdater(electronUpdaterModule),
    ipcMain,
    shell
  })
  workspaceSession = registerWorkspaceHandlers({
    dialog,
    initialLaunchPath,
    ipcMain,
    openExternalLink: async (url) => {
      await shell.openExternal(url)
    },
    openPathInNewWindow: async (resourcePath) => {
      if (!openAppWindow) {
        throw new Error('App window creation is not ready')
      }

      await openAppWindow(resourcePath)
    },
    rememberRecentResource: (resourcePath) => {
      app.addRecentDocument(resourcePath)
    },
    testFilePath: getTestFilePath(),
    testWorkspacePath: getTestWorkspacePath(),
    workspaceService: createWorkspaceService()
  })
  registerFileHandlers({
    clipboard,
    getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
    ipcMain,
    markdownFileService: createMarkdownFileService({
      moveEntryToTrash: createMoveEntryToTrash(shell)
    })
  })
  registerAiHandlers({
    aiService: createAiService(),
    getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
    ipcMain
  })
  const automationAppDataPath = app.getPath('userData')
  const automationStore = createAutomationStore({
    appDataPath: automationAppDataPath
  })
  const automationAdapterCapabilities =
    process.env[E2E_AUTOMATION_AUTONOMY_GATE_ENV] === 'false'
      ? { autonomyGate: false }
      : undefined
  const jsonlAdapterPath = process.env[E2E_AUTOMATION_JSONL_ADAPTER_ENV]
  const automationAdapterRegistry = createAutomationAdapterRegistry(
    jsonlAdapterPath
      ? [
          createJsonlAgentCliAdapter({
            commandPath: jsonlAdapterPath,
            engine: 'codex'
          })
        ]
      : [
          createFakeAgentCliAdapter({
            ...(automationAdapterCapabilities !== undefined
              ? { capabilities: automationAdapterCapabilities }
              : {}),
            commandPath: 'codex',
            engine: 'codex'
          }),
          createFakeAgentCliAdapter({
            ...(automationAdapterCapabilities !== undefined
              ? { capabilities: automationAdapterCapabilities }
              : {}),
            commandPath: 'claude',
            engine: 'claude-code'
          })
        ]
  )
  const automationRuntime = createAutomationRuntime({
    adapterRegistry: automationAdapterRegistry,
    profileId: automationAppDataPath,
    runtimeBridge: createMdeRuntimeBridge({
      appDataPath: automationAppDataPath
    }),
    store: automationStore
  })
  const automationRuntimeCoordinator = createAutomationRuntimeCoordinator({
    owner: createAutomationRuntimeOwner({
      appDataPath: automationAppDataPath
    }),
    runtime: automationRuntime,
    store: automationStore
  })

  await automationRuntimeCoordinator.start()

  registerAutomationHandlers({
    adapterRegistry: automationAdapterRegistry,
    getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
    homePath: app.getPath('home'),
    ipcMain,
    runtime: automationRuntimeCoordinator,
    store: automationStore
  })
  const automationCenterWindowManager = createAutomationCenterWindowManager(
    BrowserWindow
  )
  openAutomationCenterWindow =
    automationCenterWindowManager.openOrFocusAutomationCenterWindow
  ipcMain.handle(WINDOW_CHANNELS.openAutomationCenter, async () => {
    if (!openAutomationCenterWindow) {
      throw new Error('Automation Center window creation is not ready')
    }

    await openAutomationCenterWindow()
  })
  ipcMain.handle(WINDOW_CHANNELS.focusWorkspaceWindow, () => {
    focusMainWindow()
  })
  openAppWindow = (launchPath = null) =>
    createMainWindow(BrowserWindow, (window) => {
      workspaceSession?.setPendingLaunchPath(window.webContents, launchPath)
      setMainWindow(window)
    })

  await openAppWindow(initialLaunchPath)

  app.on('activate', () => {
    focusMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    void automationRuntimeCoordinator.prepareForShutdown()
  })
}

if (!process.env.VITEST) {
  void bootstrap()
}
