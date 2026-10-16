import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

import { build } from 'vite'
import { describe, expect, it, vi } from 'vitest'

import { AGENT_CHAT_CHANNELS, WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import type { EditorApi } from '../../src/shared/workspace'
import type { AgentChatApi } from '../../src/shared/agentChat'

describe('desktop preload public surface', () => {
  it('exposes working editor and chat APIs without automation methods', async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        ssr: resolve('apps/desktop/src/preload/index.ts'),
        write: false,
        minify: false,
        rollupOptions: { external: ['electron'], output: { format: 'cjs' } },
      },
    })
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one in-memory preload bundle')
    const chunk = result.output.find((entry) => entry.type === 'chunk')
    if (chunk?.type !== 'chunk') throw new Error('Missing preload chunk')
    const exposed = new Map<string, unknown>()
    const ipcRenderer = { invoke: vi.fn().mockResolvedValue(null), on: vi.fn(), removeListener: vi.fn() }
    runInNewContext(chunk.code, {
      require: (name: string) => {
        if (name !== 'electron') throw new Error(`Unexpected preload dependency: ${name}`)
        return { contextBridge: { exposeInMainWorld: (key: string, value: unknown) => exposed.set(key, value) }, ipcRenderer, webUtils: { getPathForFile: vi.fn() } }
      },
      process: { argv: ['electron', '--mde-window-mode=automation-center'] },
      exports: {}, module: { exports: {} },
    })
    expect([...exposed.keys()].sort()).toEqual(['agentChatApi', 'aiApi', 'editorApi', 'markdownEditorShell', 'mdeWindow', 'updateApi'])
    const windowApi = exposed.get('mdeWindow') as { getWindowMode: () => string }
    expect(Object.keys(windowApi).sort()).toEqual(['focusWorkspaceWindow', 'getWindowMode'])
    expect(windowApi.getWindowMode()).toBe('editor')
    await (exposed.get('editorApi') as EditorApi).consumeLaunchPath()
    await (exposed.get('agentChatApi') as AgentChatApi).getAvailability({ selectedEngineId: 'codex', workspaceRoot: '/workspace' })
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(WORKSPACE_CHANNELS.consumeLaunchPath)
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(AGENT_CHAT_CHANNELS.getAvailability, { selectedEngineId: 'codex', workspaceRoot: '/workspace' })
  })
})
