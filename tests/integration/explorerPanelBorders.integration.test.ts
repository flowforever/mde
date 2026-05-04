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

  it('keeps the footer settings control at the standard icon button size', async () => {
    const css = await readThemeCss()
    const settingsButtonBlock = getCssBlock(
      css,
      '.explorer-footer-settings-button'
    )
    const themeSelectorBlock = getCssBlock(css, '.theme-selector-button')
    const themeCopyBlock = getCssBlock(css, '.theme-selector-copy')
    const themePrimaryTextBlock = getCssBlock(
      css,
      '.theme-selector-copy span:first-child'
    )
    const themeSecondaryTextBlock = getCssBlock(
      css,
      '.theme-selector-copy span:last-child'
    )

    expect(settingsButtonBlock).toContain('align-self: center')
    expect(settingsButtonBlock).toContain('justify-self: center')
    expect(settingsButtonBlock).toContain('width: 32px')
    expect(settingsButtonBlock).toContain('min-width: 32px')
    expect(settingsButtonBlock).toContain('height: 32px')
    expect(settingsButtonBlock).toContain('min-height: 32px')
    expect(settingsButtonBlock).not.toContain('height: 38px')
    expect(themeSelectorBlock).toContain('height: 32px')
    expect(themeSelectorBlock).toContain('min-height: 32px')
    expect(themeSelectorBlock).toContain(
      'grid-template-columns: 22px minmax(0, 1fr) auto 14px'
    )
    expect(themeSelectorBlock).toContain('gap: 4px')
    expect(themeSelectorBlock).toContain('padding: 4px')
    expect(themeCopyBlock).toContain('align-items: baseline')
    expect(themeCopyBlock).toContain('gap: 6px')
    expect(themePrimaryTextBlock).toContain('flex: 0 0 auto')
    expect(themePrimaryTextBlock).toContain('line-height: 16px')
    expect(themeSecondaryTextBlock).toContain('flex: 1 1 auto')
    expect(themeSecondaryTextBlock).toContain('min-width: 0')
    expect(themeSecondaryTextBlock).toContain('line-height: 15px')
  })
})
