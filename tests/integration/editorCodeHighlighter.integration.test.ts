import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createEditorCodeHighlighter,
  DARK_EDITOR_CODE_THEME,
  LIGHT_EDITOR_CODE_THEME
} from '../../apps/desktop/src/renderer/src/editor/editorCodeHighlighter'

describe('editor code highlighter integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('selects the loaded Shiki theme from the current app theme family at parse time', async () => {
    const shell: { getAttribute: (name: string) => string | null } = {
      getAttribute: (name: string) =>
        name === 'data-theme-family' ? 'dark' : null
    }
    const documentStub = {
      querySelector: (selector: string) =>
        selector === '.app-shell' ? shell : null
    }

    vi.stubGlobal('document', documentStub)

    const highlighter = await createEditorCodeHighlighter()

    expect(highlighter.getLoadedThemes()[0]).toBe(DARK_EDITOR_CODE_THEME)

    shell.getAttribute = (name: string) =>
      name === 'data-theme-family' ? 'light' : null

    expect(highlighter.getLoadedThemes()[0]).toBe(LIGHT_EDITOR_CODE_THEME)
  })
})
