import { describe, expect, it } from 'vitest'

import {
  AI_CLI_SETTINGS_STORAGE_KEY,
  getEffectiveAiToolId,
  readAiCliSettings,
  resolveAiGenerationOptions,
  writeAiCliSettings
} from '../../apps/desktop/src/renderer/src/ai/aiSettings'
import type { AiTool } from '../../apps/desktop/src/shared/ai'

const createStorage = (): Storage => {
  let entries: Record<string, string> = {}

  return {
    clear: () => {
      entries = {}
    },
    getItem: (key) => entries[key] ?? null,
    key: (index) => Object.keys(entries)[index] ?? null,
    get length() {
      return Object.keys(entries).length
    },
    removeItem: (key) => {
      const nextEntries = { ...entries }

      delete nextEntries[key]
      entries = nextEntries
    },
    setItem: (key, value) => {
      entries = { ...entries, [key]: value }
    }
  }
}

const installedTools: readonly AiTool[] = [
  { commandPath: '/fake/codex', id: 'codex', name: 'Codex' },
  { commandPath: '/fake/claude', id: 'claude', name: 'Claude Code' }
]

describe('aiSettings', () => {
  it('reads and writes the selected CLI and per-tool default models', () => {
    const storage = createStorage()

    writeAiCliSettings(storage, {
      modelNames: {
        claude: 'claude-sonnet-4-6',
        codex: 'gpt-5.4'
      },
      selectedToolId: 'claude'
    })

    expect(storage.getItem(AI_CLI_SETTINGS_STORAGE_KEY)).toContain(
      'claude-sonnet-4-6'
    )
    expect(readAiCliSettings(storage)).toEqual({
      modelNames: {
        claude: 'claude-sonnet-4-6',
        codex: 'gpt-5.4'
      },
      selectedToolId: 'claude'
    })
  })

  it('falls back to the first installed CLI when the remembered CLI is unavailable', () => {
    expect(
      getEffectiveAiToolId(
        {
          modelNames: {},
          selectedToolId: 'claude'
        },
        [{ commandPath: '/fake/codex', id: 'codex', name: 'Codex' }]
      )
    ).toBe('codex')
  })

  it('creates generation options with the selected installed CLI and trimmed model', () => {
    expect(
      resolveAiGenerationOptions(
        {
          modelNames: {
            codex: '  gpt-5.4  '
          },
          selectedToolId: 'codex'
        },
        installedTools
      )
    ).toEqual({
      modelName: 'gpt-5.4',
      toolId: 'codex'
    })
  })
})
