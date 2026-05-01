import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const readThemeCss = (): Promise<string> =>
  readFile(resolve('src/renderer/src/styles/theme.css'), 'utf8')

const getCssBlock = (css: string, selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockPattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`)
  const match = blockPattern.exec(css)

  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`)
  }

  return match[1]
}

describe('explorer panel borders', () => {
  it('keeps a single divider across expanded and collapsed panel states', async () => {
    const css = await readThemeCss()

    expect(getCssBlock(css, '.explorer-pane')).not.toContain('border-right')
    expect(getCssBlock(css, '.explorer-pane.is-collapsed')).toContain(
      'border-right: 1px solid var(--panel-border)'
    )
    expect(getCssBlock(css, '.explorer-panel-resize-handle')).toContain(
      'border-top: 1px solid var(--panel-border)'
    )
    expect(getCssBlock(css, '.explorer-recent-files-section')).not.toContain(
      'border-top'
    )
    expect(getCssBlock(css, '.explorer-recent-files-section.is-collapsed'))
      .toContain('border-top: 1px solid var(--panel-border)')
  })
})
