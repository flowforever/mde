import { describe, expect, it, vi } from 'vitest'

import {
  configureAutoUpdates,
  resolveAutoUpdater,
  shouldCheckForUpdates
} from '../../src/main/autoUpdate'

describe('auto update', () => {
  it('checks for updates only in packaged apps', () => {
    expect(
      shouldCheckForUpdates({
        env: {},
        isPackaged: true
      })
    ).toBe(true)
    expect(
      shouldCheckForUpdates({
        env: {},
        isPackaged: false
      })
    ).toBe(false)
  })

  it('can be disabled with an environment flag', () => {
    expect(
      shouldCheckForUpdates({
        env: {
          MDE_DISABLE_AUTO_UPDATE: '1'
        },
        isPackaged: true
      })
    ).toBe(false)
  })

  it('resolves electron-updater from CommonJS default exports', () => {
    const autoUpdater = {
      autoDownload: false,
      checkForUpdatesAndNotify: vi.fn(),
      on: vi.fn()
    }

    expect(
      resolveAutoUpdater({
        default: {
          autoUpdater
        }
      })
    ).toBe(autoUpdater)
  })

  it('resolves electron-updater from named exports', () => {
    const autoUpdater = {
      autoDownload: false,
      checkForUpdatesAndNotify: vi.fn(),
      on: vi.fn()
    }

    expect(resolveAutoUpdater({ autoUpdater })).toBe(autoUpdater)
  })

  it('skips auto update setup when electron-updater is unavailable', () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn()
    }

    const isConfigured = configureAutoUpdates({
      app: {
        isPackaged: true,
        whenReady: vi.fn().mockResolvedValue(undefined)
      },
      autoUpdater: undefined,
      env: {},
      logger
    })

    expect(isConfigured).toBe(false)
    expect(logger.error).toHaveBeenCalledWith('MDE auto updater is unavailable')
  })

  it('configures electron-updater to check GitHub releases', async () => {
    const checkForUpdatesAndNotify = vi.fn().mockResolvedValue(undefined)
    const on = vi.fn()
    const app = {
      isPackaged: true,
      whenReady: vi.fn().mockResolvedValue(undefined)
    }
    const autoUpdater = {
      autoDownload: false,
      checkForUpdatesAndNotify,
      on
    }

    const isConfigured = configureAutoUpdates({
      app,
      autoUpdater,
      env: {},
      logger: {
        error: vi.fn(),
        info: vi.fn()
      }
    })

    await app.whenReady.mock.results[0].value
    await Promise.resolve()

    expect(isConfigured).toBe(true)
    expect(autoUpdater.autoDownload).toBe(true)
    expect(on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(checkForUpdatesAndNotify).toHaveBeenCalledTimes(1)
  })
})
