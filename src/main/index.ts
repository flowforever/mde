import { join } from 'node:path'

import type {
  App,
  BrowserWindow,
  BrowserWindowConstructorOptions,
} from 'electron'

type BrowserWindowConstructor = typeof BrowserWindow

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
    createWindowOptions(join(__dirname, '../preload/index.js'))
  )

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
  const { app, BrowserWindow } = (await import('electron')) as {
    app: App
    BrowserWindow: BrowserWindowConstructor
  }

  await app.whenReady()
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
