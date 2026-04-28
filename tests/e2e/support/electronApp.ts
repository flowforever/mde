import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

const execFileAsync = promisify(execFile)
const startupDiagnosticPattern = /preload|security|unable to load preload/i

interface StartupDiagnostics {
  errors: string[]
  output: string[]
}

interface LaunchedElectronApp {
  app: ElectronApplication
  startupDiagnostics: StartupDiagnostics
  window: Page
}

export const launchElectronApp = async (): Promise<LaunchedElectronApp> => {
  const startupDiagnostics: StartupDiagnostics = {
    errors: [],
    output: []
  }
  const app = await electron.launch({
    args: ['out/main/index.js']
  })

  const childProcess = app.process()

  childProcess.stdout?.on('data', (chunk: Buffer) => {
    const output = chunk.toString()

    startupDiagnostics.output.push(output)
    if (startupDiagnosticPattern.test(output)) {
      startupDiagnostics.errors.push(output)
    }
  })
  childProcess.stderr?.on('data', (chunk: Buffer) => {
    const output = chunk.toString()

    startupDiagnostics.output.push(output)
    if (startupDiagnosticPattern.test(output)) {
      startupDiagnostics.errors.push(output)
    }
  })

  app.on('window', (page) => {
    page.on('console', (message) => {
      const text = message.text()

      if (message.type() === 'error' || startupDiagnosticPattern.test(text)) {
        startupDiagnostics.errors.push(text)
      }
    })
    page.on('pageerror', (error) => {
      startupDiagnostics.errors.push(error.message)
    })
  })

  const window = await app.firstWindow()

  return { app, startupDiagnostics, window }
}

export const buildElectronApp = async (): Promise<void> => {
  await execFileAsync('npm', ['run', 'build'])
}
