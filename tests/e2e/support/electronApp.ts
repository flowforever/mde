import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

import { createElectronLaunchEnv } from './e2eLaunchEnv'

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
    args: ['--lang=en-US', 'out/main/index.js', ...options.args ?? []],
    env: createElectronLaunchEnv({
      e2eUserDataPath,
      overrideEnv: options.env
    })
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
  await window.waitForLoadState('domcontentloaded', { timeout: 20_000 })
  await window.evaluate(() => {
    globalThis.localStorage.setItem('mde.appLanguagePreference', 'en')
    globalThis.localStorage.removeItem('mde.customAppLanguagePacks')
  })
  // Avoid reloading the first window before the renderer finishes consuming
  // one-shot command-line launch paths.
  await window.locator('.app-shell').waitFor({
    state: 'visible',
    timeout: 20_000
  })

  const mainDiagnostics = await app.evaluate(() => {
    const diagnostics = globalThis.__mdeStartupDiagnostics

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
