import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV
} from '../../../src/shared/appIdentity'

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

interface LaunchElectronAppOptions {
  readonly args?: readonly string[]
  readonly env?: NodeJS.ProcessEnv
}

export const launchElectronApp = async (
  options: LaunchElectronAppOptions = {}
): Promise<LaunchedElectronApp> => {
  const startupDiagnostics: StartupDiagnostics = {
    errors: [],
    output: []
  }
  const e2eUserDataPath = await mkdtemp(join(tmpdir(), 'mde-e2e-user-data-'))
  const app = await electron.launch({
    args: ['out/main/index.js', ...options.args ?? []],
    env: {
      ...process.env,
      ...options.env,
      [CAPTURE_STARTUP_DIAGNOSTICS_ENV]: '1',
      [DISABLE_SINGLE_INSTANCE_ENV]: '1',
      [E2E_USER_DATA_PATH_ENV]: e2eUserDataPath
    }
  })

  const childProcess = app.process()

  app.on('close', () => {
    void rm(e2eUserDataPath, { force: true, recursive: true })
  })

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
  const mainDiagnostics = await app.evaluate(() => {
    const diagnostics = globalThis.__mdeStartupDiagnostics as
      | StartupDiagnostics
      | undefined

    if (!diagnostics) {
      throw new Error('Main-process startup diagnostics were not initialized')
    }

    return diagnostics
  })

  startupDiagnostics.errors.push(...mainDiagnostics.errors)
  startupDiagnostics.output.push(...mainDiagnostics.output)

  return { app, startupDiagnostics, window }
}

export const buildElectronApp = async (): Promise<void> => {
  await execFileAsync('npm', ['run', 'build'])
}
