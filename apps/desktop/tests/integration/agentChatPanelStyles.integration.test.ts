import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const readThemeCss = (): Promise<string> =>
  readFile(resolve('apps/desktop/src/renderer/src/styles/theme.css'), 'utf8')

const getCssBlock = (css: string, selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockPattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`)
  const match = blockPattern.exec(css)

  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`)
  }

  return match[1]
}

describe('Agent Chat panel styles', () => {
  it('keeps a single divider between the editor and resizable chat panel', async () => {
    const css = await readThemeCss()

    expect(getCssBlock(css, '.agent-chat-resize-handle')).toContain(
      'border-left: 1px solid var(--editor-border)'
    )
    expect(getCssBlock(css, '.agent-chat-panel')).not.toContain('border-left')
    expect(getCssBlock(css, '.agent-chat-panel')).not.toContain('max-width')
  })
})
