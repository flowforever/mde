export const DISABLE_AUTO_UPDATE_ENV = 'MDE_DISABLE_AUTO_UPDATE'

interface AutoUpdateEnvironment {
  readonly [DISABLE_AUTO_UPDATE_ENV]?: string
}

interface AutoUpdateApp {
  readonly isPackaged: boolean
  readonly whenReady: () => Promise<unknown>
}

interface AutoUpdateClient {
  autoDownload: boolean
  readonly checkForUpdatesAndNotify: () => Promise<unknown>
  readonly on: unknown
}

interface AutoUpdateLogger {
  readonly error: (...args: readonly unknown[]) => void
  readonly info: (...args: readonly unknown[]) => void
}

export const shouldCheckForUpdates = ({
  env = process.env,
  isPackaged
}: {
  readonly env?: AutoUpdateEnvironment
  readonly isPackaged: boolean
}): boolean => isPackaged && env[DISABLE_AUTO_UPDATE_ENV] !== '1'

const registerUpdateListener = (
  autoUpdater: AutoUpdateClient,
  eventName: string,
  listener: (...args: readonly unknown[]) => void
): void => {
  const registerListener = autoUpdater.on as (
    eventName: string,
    listener: (...args: readonly unknown[]) => void
  ) => unknown

  registerListener.call(autoUpdater, eventName, listener)
}

export const configureAutoUpdates = ({
  app,
  autoUpdater,
  env = process.env,
  logger = console
}: {
  readonly app: AutoUpdateApp
  readonly autoUpdater: AutoUpdateClient
  readonly env?: AutoUpdateEnvironment
  readonly logger?: AutoUpdateLogger
}): boolean => {
  if (!shouldCheckForUpdates({ env, isPackaged: app.isPackaged })) {
    return false
  }

  autoUpdater.autoDownload = true
  registerUpdateListener(autoUpdater, 'checking-for-update', () => {
    logger.info('Checking for MDE updates')
  })
  registerUpdateListener(autoUpdater, 'update-available', () => {
    logger.info('MDE update is available')
  })
  registerUpdateListener(autoUpdater, 'update-not-available', () => {
    logger.info('MDE is up to date')
  })
  registerUpdateListener(autoUpdater, 'update-downloaded', () => {
    logger.info('MDE update downloaded')
  })
  registerUpdateListener(autoUpdater, 'error', (error) => {
    logger.error('MDE auto update failed', error)
  })

  void app
    .whenReady()
    .then(() => autoUpdater.checkForUpdatesAndNotify())
    .catch((error: unknown) => {
      logger.error('MDE auto update check failed', error)
    })

  return true
}
