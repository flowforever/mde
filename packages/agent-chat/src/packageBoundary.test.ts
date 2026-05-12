import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('@mde/agent-chat package boundary', () => {
  it('exports package contracts from the public index', async () => {
    const exports = await import('./index')

    expect(exports.AGENT_CHAT_ENGINE_IDS).toEqual(['codex', 'claude'])
  })

  it('does not import Electron, React, or desktop app modules', () => {
    const sourceRoot = dirname(fileURLToPath(import.meta.url))
    const files = ['index.ts', 'types.ts'].map((file) =>
      readFileSync(join(sourceRoot, file), 'utf8')
    )

    expect(files.join('\n')).not.toMatch(/from ['"]electron['"]/)
    expect(files.join('\n')).not.toMatch(/from ['"]react['"]/)
    expect(files.join('\n')).not.toContain('apps/desktop')
  })
})
