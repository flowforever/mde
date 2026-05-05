import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { configureAutoUpdates } from '../../src/main/autoUpdate'
import { UPDATE_CHANNELS } from '../../src/main/ipc/channels'

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

describe('auto update IPC integration', () => {
  it('falls back to the public releases feed when macOS update IPC hits a GitHub REST rate limit', async () => {
    const { handlers, ipcMain } = createIpcMain()
    const expectedUpdateArch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 403
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
              <content type="html">&lt;p&gt;Update check fallback&lt;/p&gt;</content>
            </entry>
          </feed>`,
          {
            headers: { 'content-type': 'application/atom+xml' },
            status: 200
          }
        )
      )

    expect(
      configureAutoUpdates({
        app: {
          getPath: vi.fn(() => join(tmpdir(), 'mde-update-ipc')),
          getVersion: vi.fn(() => '1.2.16'),
          isPackaged: true
        },
        env: {},
        fetch,
        ipcMain,
        platform: 'darwin',
        shell: {
          openPath: vi.fn()
        }
      })
    ).toBe(true)

    const result = await handlers.get(UPDATE_CHANNELS.checkForUpdates)?.({
      sender: { send: vi.fn() }
    })

    expect(result).toMatchObject({
      currentVersion: '1.2.16',
      update: {
        assetName: `MDE-1.2.17-mac-${expectedUpdateArch}.dmg`,
        latestVersion: '1.2.17',
        releaseUrl: 'https://github.com/flowforever/mde/releases/tag/v1.2.17'
      },
      updateAvailable: true
    })
  })
})
