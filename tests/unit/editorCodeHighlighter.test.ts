import { describe, expect, it } from 'vitest'

import {
  DARK_EDITOR_CODE_THEME,
  getEditorCodeThemeForThemeFamily,
  LIGHT_EDITOR_CODE_THEME
} from '../../apps/desktop/src/renderer/src/editor/editorCodeHighlighter'

describe('editorCodeHighlighter', () => {
  it('uses a dark Shiki theme for dark app themes', () => {
    expect(getEditorCodeThemeForThemeFamily('dark')).toBe(DARK_EDITOR_CODE_THEME)
  })

  it('falls back to the light Shiki theme outside dark app themes', () => {
    expect(getEditorCodeThemeForThemeFamily('light')).toBe(LIGHT_EDITOR_CODE_THEME)
    expect(getEditorCodeThemeForThemeFamily(null)).toBe(LIGHT_EDITOR_CODE_THEME)
  })
})
