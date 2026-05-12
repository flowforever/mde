import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Agent Chat manual coverage', () => {
  it('documents Codex sustained availability and workspace-local attachment cache', () => {
    const manual = readFileSync(
      join(process.cwd(), 'user-manual/zh-CN/ai.md'),
      'utf8'
    )

    expect(manual).toContain('Agent Chat')
    expect(manual).toContain('Codex app-server sustained protocol')
    expect(manual).toContain('.mde/agent-chat/')
    expect(manual).toContain('粘贴图片')
  })
})
