import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

const execFileAsync = promisify(execFile)

interface LaunchedElectronApp {
  app: ElectronApplication
  window: Page
}

export const launchElectronApp = async (): Promise<LaunchedElectronApp> => {
  await execFileAsync('npm', ['run', 'build'])

  const app = await electron.launch({
    args: ['out/main/index.js']
  })
  const window = await app.firstWindow()

  return { app, window }
}
