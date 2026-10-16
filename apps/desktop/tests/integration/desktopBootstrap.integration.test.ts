import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { AGENT_CHAT_CHANNELS, WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import { WINDOW_CHANNELS } from '../../src/shared/windowApi'

const state = vi.hoisted(() => ({
  root: '',
  handle: vi.fn(),
  lifecycle: new Map<string, () => void>(),
  windows: [] as { loadFile: ReturnType<typeof vi.fn> }[],
}))
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => `${state.root}/${name}`,
    setName: vi.fn(), setPath: vi.fn(),
    getAppPath: () => process.cwd(),
    getVersion: () => '1.6.7',
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: () => true,
    on: (event: string, listener: () => void) => state.lifecycle.set(event, listener),
    quit: vi.fn(), addRecentDocument: vi.fn(),
  },
  BrowserWindow: class {
    readonly webContents = { id: 1, on: vi.fn(), send: vi.fn() }
    readonly loadFile = vi.fn(() => Promise.resolve())
    readonly loadURL = vi.fn(() => Promise.resolve())
    readonly once = vi.fn()
    readonly on = vi.fn()
    readonly focus = vi.fn()
    readonly restore = vi.fn()
    readonly isMinimized = () => false
    constructor() { state.windows.push(this) }
  },
  clipboard: {}, dialog: {}, ipcMain: { handle: state.handle }, shell: { openExternal: vi.fn() },
}))
vi.mock('../../src/main/autoUpdate', () => ({ configureAutoUpdates: vi.fn(), resolveAutoUpdater: vi.fn() }))
vi.mock('../../src/main/services/cliRegistrationService', () => ({ registerMdeCliInBackground: vi.fn() }))

afterEach(async () => {
  state.lifecycle.get('before-quit')?.()
  vi.unstubAllEnvs()
  if (state.root) await rm(state.root, { recursive: true, force: true })
  state.handle.mockClear()
  state.windows.length = 0
  state.lifecycle.clear()
})

describe('desktop bootstrap', () => {
  it('registers working editor/chat routes without automation runtime handlers', async () => {
    state.root = await mkdtemp(join(tmpdir(), 'mde-bootstrap-'))
    vi.stubEnv('VITEST', '')
    vi.stubEnv('MDE_E2E_AGENT_CHAT_FAKE_CODEX', '1')
    vi.stubEnv('MDE_DISABLE_AUTO_UPDATE', '1')
    const argv = process.argv
    process.argv = ['electron', 'apps/desktop/out/main/index.js']
    try {
      vi.resetModules()
      await import('../../src/main/index')
      await vi.waitFor(() => expect(state.windows[0]?.loadFile).toHaveBeenCalled())
      const channels = state.handle.mock.calls.map(([channel]) => String(channel))
      expect(channels).toEqual(expect.arrayContaining([
        AGENT_CHAT_CHANNELS.createDraftSession,
        WORKSPACE_CHANNELS.consumeLaunchPath,
        WINDOW_CHANNELS.focusWorkspaceWindow,
      ]))
      expect(channels.some((channel) => channel.startsWith('automation:'))).toBe(false)
      expect(channels).not.toContain('window:open-automation-center')
    } finally {
      process.argv = argv
    }
  })
})
