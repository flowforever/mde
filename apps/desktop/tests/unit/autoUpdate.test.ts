import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it, vi } from 'vitest'

import {
  configureAutoUpdates,
  createGitHubManualUpdateService,
  findCompatibleDmgAsset,
  shouldCheckForUpdates
} from '../../src/main/autoUpdate'
import { UPDATE_CHANNELS } from '../../src/main/ipc/channels'

const releaseResponse = {
  body: '## Bug Fixes\n\n- Improved editor updates.',
  html_url: 'https://github.com/flowforever/mde/releases/tag/v1.2.0',
  name: 'MDE 1.2.0',
  prerelease: false,
  tag_name: 'v1.2.0',
  assets: [
    {
      browser_download_url:
        'https://github.com/flowforever/mde/releases/download/v1.2.0/MDE-1.2.0-mac-x64.dmg',
      name: 'MDE-1.2.0-mac-x64.dmg',
      size: 123
    },
    {
      browser_download_url:
        'https://github.com/flowforever/mde/releases/download/v1.2.0/MDE-1.2.0-mac-arm64.dmg',
      name: 'MDE-1.2.0-mac-arm64.dmg',
      size: 456
    }
  ],
  published_at: '2026-04-29T09:11:32.622Z'
}

const createReleaseResponse = (version: string) => ({
  ...releaseResponse,
  html_url: `https://github.com/flowforever/mde/releases/tag/v${version}`,
  name: `MDE ${version}`,
  tag_name: `v${version}`,
  assets: releaseResponse.assets.map((asset) => ({
    ...asset,
    browser_download_url: asset.browser_download_url.replace(
      /v1\.2\.0\/MDE-1\.2\.0/u,
      `v${version}/MDE-${version}`
    ),
    name: asset.name.replace('1.2.0', version)
  }))
})

const createApp = (userDataPath: string, version = '1.1.1') => ({
  getPath: vi.fn(() => userDataPath),
  getVersion: vi.fn(() => version),
  isPackaged: true,
  quit: vi.fn()
})

const createIpcMain = () => {
  const handlers = new Map<string, (event: unknown) => Promise<unknown>>()

  return {
    handlers,
    ipcMain: {
      handle: vi.fn(
        (channel: string, handler: (event: unknown) => Promise<unknown>) => {
          handlers.set(channel, handler)
        }
      )
    }
  }
}

describe('manual update', () => {
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

  it('can force update checks in development for end-to-end coverage', () => {
    expect(
      shouldCheckForUpdates({
        env: {
          MDE_TEST_FORCE_AUTO_UPDATE: '1'
        },
        isPackaged: false
      })
    ).toBe(true)
  })

  it('selects the current architecture DMG from a trusted GitHub release', () => {
    expect(findCompatibleDmgAsset(releaseResponse.assets, 'arm64')).toEqual({
      name: 'MDE-1.2.0-mac-arm64.dmg',
      size: 456,
      url: 'https://github.com/flowforever/mde/releases/download/v1.2.0/MDE-1.2.0-mac-arm64.dmg'
    })
  })

  it('rejects DMG assets outside the MDE GitHub release namespace', () => {
    expect(() =>
      findCompatibleDmgAsset(
        [
          {
            browser_download_url:
              'https://evil.example/MDE-1.2.0-mac-arm64.dmg',
            name: 'MDE-1.2.0-mac-arm64.dmg',
            size: 456
          }
        ],
        'arm64'
      )
    ).toThrow(/trusted GitHub release/i)
  })

  it('rejects unsupported macOS architectures', () => {
    expect(() => findCompatibleDmgAsset(releaseResponse.assets, 'ia32')).toThrow(
      /does not publish macOS updates/i
    )
  })

  it('returns no update when the GitHub release is not newer', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(releaseResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    )
    const service = createGitHubManualUpdateService({
      app: createApp(await mkdtemp(join(tmpdir(), 'mde-update-current-')), '1.2.0'),
      fetch,
      platform: 'darwin',
      shell: { openPath: vi.fn() }
    })

    await expect(service.checkForUpdates()).resolves.toEqual({
      currentVersion: '1.2.0',
      message: 'MDE is up to date.',
      updateAvailable: false
    })
  })

  it('returns disabled and unsupported manual update results without fetching', async () => {
    const fetch = vi.fn()
    const disabledService = createGitHubManualUpdateService({
      app: createApp(await mkdtemp(join(tmpdir(), 'mde-update-disabled-'))),
      enabled: false,
      fetch,
      platform: 'darwin',
      shell: { openPath: vi.fn() }
    })
    const unsupportedService = createGitHubManualUpdateService({
      app: createApp(await mkdtemp(join(tmpdir(), 'mde-update-linux-'))),
      fetch,
      platform: 'linux',
      shell: { openPath: vi.fn() }
    })

    await expect(disabledService.checkForUpdates()).resolves.toEqual({
      currentVersion: '1.1.1',
      message: 'Update checks are disabled.',
      updateAvailable: false
    })
    await expect(disabledService.downloadAndOpenUpdate()).rejects.toThrow(
      /disabled/i
    )
    await expect(unsupportedService.checkForUpdates()).resolves.toEqual({
      currentVersion: '1.1.1',
      message: 'Manual DMG updates are only available on macOS.',
      updateAvailable: false
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces malformed GitHub release responses', async () => {
    const service = createGitHubManualUpdateService({
      app: createApp(await mkdtemp(join(tmpdir(), 'mde-update-invalid-'))),
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tag_name: 'v1.2.0' }), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      ),
      platform: 'darwin',
      shell: { openPath: vi.fn() }
    })

    await expect(service.checkForUpdates()).rejects.toThrow(/missing assets/i)
  })

  it('finds a newer release and stores it for installation', async () => {
    const service = createGitHubManualUpdateService({
      app: createApp(await mkdtemp(join(tmpdir(), 'mde-update-check-'))),
      arch: 'x64',
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify(releaseResponse), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      ),
      platform: 'darwin',
      shell: {
        openPath: vi.fn()
      }
    })

    const result = await service.checkForUpdates()

    expect(result.currentVersion).toBe('1.1.1')
    expect(result.updateAvailable).toBe(true)
    expect(result.update?.assetName).toBe('MDE-1.2.0-mac-x64.dmg')
    expect(result.update?.latestVersion).toBe('1.2.0')
  })

  it('selects the highest newer semver release from the releases feed', async () => {
    const service = createGitHubManualUpdateService({
      app: createApp(await mkdtemp(join(tmpdir(), 'mde-update-feed-')), '1.2.2'),
      arch: 'x64',
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            createReleaseResponse('1.2.9'),
            createReleaseResponse('1.2.11'),
            createReleaseResponse('1.2.8')
          ]),
          {
            headers: { 'content-type': 'application/json' },
            status: 200
          }
        )
      ),
      platform: 'darwin',
      shell: {
        openPath: vi.fn()
      }
    })

    const result = await service.checkForUpdates()

    expect(result.currentVersion).toBe('1.2.2')
    expect(result.updateAvailable).toBe(true)
    expect(result.update?.assetName).toBe('MDE-1.2.11-mac-x64.dmg')
    expect(result.update?.latestVersion).toBe('1.2.11')
  })

  it.each([403, 429])(
    'falls back to the public releases feed when GitHub REST release checks fail with status %s',
    async (status) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('rate limited', {
            status
          })
        )
        .mockResolvedValueOnce(
          new Response(
            `<?xml version="1.0" encoding="UTF-8"?>
          <feed>
            <entry>
              <title>MDE 1.2.17</title>
              <link rel="alternate" href="https://github.com/flowforever/mde/releases/tag/v1.2.17" />
              <updated>2026-04-30T10:09:05Z</updated>
              <content type="html">&lt;h2&gt;Bug Fixes&lt;/h2&gt;&lt;p&gt;Update checks no longer fail on API rate limits.&lt;/p&gt;</content>
            </entry>
          </feed>`,
            {
              headers: { 'content-type': 'application/atom+xml' },
              status: 200
            }
          )
        )
      const service = createGitHubManualUpdateService({
        app: createApp(
          await mkdtemp(join(tmpdir(), 'mde-update-rate-limit-')),
          '1.2.16'
        ),
        arch: 'x64',
        fetch,
        platform: 'darwin',
        shell: {
          openPath: vi.fn()
        }
      })

      const result = await service.checkForUpdates()

      expect(result.currentVersion).toBe('1.2.16')
      expect(result.updateAvailable).toBe(true)
      expect(result.update).toEqual(
        expect.objectContaining({
          assetName: 'MDE-1.2.17-mac-x64.dmg',
          assetSize: 0,
          latestVersion: '1.2.17',
          releaseName: 'MDE 1.2.17',
          releaseUrl: 'https://github.com/flowforever/mde/releases/tag/v1.2.17'
        })
      )
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://github.com/flowforever/mde/releases.atom',
        expect.any(Object)
      )
    }
  )

  it('downloads the selected DMG, reports progress, and opens it', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'mde-update-download-'))
    const app = createApp(userDataPath)
    const openPath = vi.fn().mockResolvedValue('')
    const progress = vi.fn()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(releaseResponse), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-length': '4' },
          status: 200
        })
      )
    const service = createGitHubManualUpdateService({
      app,
      arch: 'arm64',
      fetch,
      platform: 'darwin',
      shell: { openPath }
    })

    await service.checkForUpdates()

    await expect(service.downloadAndOpenUpdate(progress)).resolves.toEqual({
      filePath: join(userDataPath, 'updates', 'MDE-1.2.0-mac-arm64.dmg'),
      version: '1.2.0'
    })
    await expect(
      readFile(join(userDataPath, 'updates', 'MDE-1.2.0-mac-arm64.dmg'))
    ).resolves.toEqual(Buffer.from([1, 2, 3, 4]))
    expect(progress).toHaveBeenLastCalledWith({
      downloadedBytes: 4,
      percent: 100,
      totalBytes: 4
    })
    expect(openPath).toHaveBeenCalledWith(
      join(userDataPath, 'updates', 'MDE-1.2.0-mac-arm64.dmg')
    )
    expect(app.quit).toHaveBeenCalledTimes(1)
  })

  it('cleans up and reports download failures', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'mde-update-failure-'))
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(releaseResponse), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response('not found', {
          status: 404
        })
      )
    const app = createApp(userDataPath)
    const service = createGitHubManualUpdateService({
      app,
      arch: 'arm64',
      fetch,
      platform: 'darwin',
      shell: { openPath: vi.fn() }
    })

    await service.checkForUpdates()

    await expect(service.downloadAndOpenUpdate()).rejects.toThrow(
      /download failed/i
    )
  })

  it('reports when macOS cannot open the downloaded DMG', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'mde-update-open-error-'))
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(releaseResponse), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          headers: { 'content-length': '1' },
          status: 200
        })
      )
    const app = createApp(userDataPath)
    const service = createGitHubManualUpdateService({
      app,
      arch: 'arm64',
      fetch,
      platform: 'darwin',
      shell: { openPath: vi.fn().mockResolvedValue('denied') }
    })

    await service.checkForUpdates()

    await expect(service.downloadAndOpenUpdate()).rejects.toThrow(
      /unable to open downloaded installer/i
    )
    expect(app.quit).not.toHaveBeenCalled()
  })
})

describe('Windows auto update', () => {
  it('checks, downloads, and installs through electron-updater IPC', async () => {
    const listeners = new Map<string, (...args: readonly unknown[]) => void>()
    const sender = { send: vi.fn() }
    const { handlers, ipcMain } = createIpcMain()
    const autoUpdater = {
      autoDownload: false,
      checkForUpdates: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((eventName: string, listener: (...args: readonly unknown[]) => void) => {
        listeners.set(eventName, listener)
      }),
      quitAndInstall: vi.fn()
    }

    expect(
      configureAutoUpdates({
        app: {
          getPath: vi.fn(),
          getVersion: vi.fn(() => '1.1.1'),
          isPackaged: true,
          whenReady: vi.fn().mockResolvedValue(undefined)
        },
        autoUpdater,
        env: {},
        ipcMain,
        platform: 'win32',
        shell: { openPath: vi.fn() }
      })
    ).toBe(true)

    expect(autoUpdater.autoDownload).toBe(true)
    await expect(
      handlers.get(UPDATE_CHANNELS.checkForUpdates)?.({ sender })
    ).resolves.toEqual({
      currentVersion: '1.1.1',
      message: 'Checking for Windows updates.',
      updateAvailable: false
    })
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)

    listeners.get('download-progress')?.({
      percent: 50,
      total: 100,
      transferred: 50
    })
    expect(sender.send).toHaveBeenCalledWith(UPDATE_CHANNELS.downloadProgress, {
      downloadedBytes: 50,
      percent: 50,
      totalBytes: 100
    })

    listeners.get('download-progress')?.({
      total: 50,
      transferred: 25
    })
    expect(sender.send).toHaveBeenCalledWith(UPDATE_CHANNELS.downloadProgress, {
      downloadedBytes: 25,
      percent: 50,
      totalBytes: 50
    })

    listeners.get('update-available')?.({
      releaseDate: '2026-04-29T09:11:32.622Z',
      releaseName: 'MDE 1.2.0',
      releaseNotes: [
        {
          note: 'Windows update notes',
          version: '1.2.0'
        }
      ],
      version: '1.2.0'
    })
    expect(sender.send).toHaveBeenCalledWith(
      UPDATE_CHANNELS.updateAvailable,
      expect.objectContaining({
        installMode: 'restart-to-install',
        latestVersion: '1.2.0',
        releaseNotes: '1.2.0\nWindows update notes'
      })
    )

    listeners.get('update-downloaded')?.({
      releaseDate: '2026-04-29T09:11:32.622Z',
      releaseName: 'MDE 1.2.0',
      releaseNotes: 'Windows update',
      version: '1.2.0'
    })
    expect(sender.send).toHaveBeenCalledWith(
      UPDATE_CHANNELS.updateReady,
      expect.objectContaining({
        installMode: 'restart-to-install',
        latestVersion: '1.2.0'
      })
    )

    await handlers.get(UPDATE_CHANNELS.installWindows)?.({ sender })
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('registers disabled and unavailable Windows updater handlers', async () => {
    const disabledIpc = createIpcMain()
    const unavailableIpc = createIpcMain()
    const logger = {
      error: vi.fn(),
      info: vi.fn()
    }

    expect(
      configureAutoUpdates({
        app: {
          getPath: vi.fn(),
          getVersion: vi.fn(() => '1.1.1'),
          isPackaged: true
        },
        env: { MDE_DISABLE_AUTO_UPDATE: '1' },
        ipcMain: disabledIpc.ipcMain,
        platform: 'win32',
        shell: { openPath: vi.fn() }
      })
    ).toBe(false)
    await expect(
      disabledIpc.handlers.get(UPDATE_CHANNELS.checkForUpdates)?.({
        sender: { send: vi.fn() }
      })
    ).resolves.toEqual({
      currentVersion: '1.1.1',
      message: 'Update checks are disabled.',
      updateAvailable: false
    })
    expect(() =>
      disabledIpc.handlers.get(UPDATE_CHANNELS.installWindows)?.({
        sender: { send: vi.fn() }
      })
    ).toThrow(/unavailable/i)

    expect(
      configureAutoUpdates({
        app: {
          getPath: vi.fn(),
          getVersion: vi.fn(() => '1.1.1'),
          isPackaged: true
        },
        env: {},
        ipcMain: unavailableIpc.ipcMain,
        logger,
        platform: 'win32',
        shell: { openPath: vi.fn() }
      })
    ).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(
      'MDE Windows auto updater is unavailable'
    )
    await expect(
      unavailableIpc.handlers.get(UPDATE_CHANNELS.checkForUpdates)?.({
        sender: { send: vi.fn() }
      })
    ).resolves.toEqual({
      currentVersion: '1.1.1',
      message: 'Windows auto updater is unavailable.',
      updateAvailable: false
    })
  })

  it('registers macOS and unsupported platform fallback update handlers', async () => {
    const macIpc = createIpcMain()
    const linuxIpc = createIpcMain()
    const logger = {
      error: vi.fn(),
      info: vi.fn()
    }

    expect(
      configureAutoUpdates({
        app: createApp(await mkdtemp(join(tmpdir(), 'mde-config-mac-'))),
        env: {},
        ipcMain: macIpc.ipcMain,
        logger,
        platform: 'darwin'
      })
    ).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(
      'MDE macOS update shell integration is unavailable'
    )
    expect(
      macIpc.handlers.get(UPDATE_CHANNELS.checkForUpdates)?.({
        sender: { send: vi.fn() }
      })
    ).toEqual({
      currentVersion: '1.1.1',
      message: 'Automatic updates are available on macOS and Windows only.',
      updateAvailable: false
    })

    expect(
      configureAutoUpdates({
        app: createApp(await mkdtemp(join(tmpdir(), 'mde-config-linux-'))),
        env: {},
        ipcMain: linuxIpc.ipcMain,
        platform: 'linux',
        shell: { openPath: vi.fn() }
      })
    ).toBe(false)
    expect(() =>
      linuxIpc.handlers.get(UPDATE_CHANNELS.downloadAndOpen)?.({
        sender: { send: vi.fn() }
      })
    ).toThrow(/macOS and Windows only/i)
  })
})
