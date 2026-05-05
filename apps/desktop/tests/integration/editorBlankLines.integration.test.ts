import { BlockNoteEditor } from '@blocknote/core'
import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  exportBlocksToMarkdown,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage
} from '@mde/editor-react'

describe('editor blank line round trips', () => {
  let previousDocument: typeof globalThis.document | undefined
  let previousNavigator: typeof globalThis.navigator | undefined
  let previousWindow: typeof globalThis.window | undefined

  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')

    previousDocument = globalThis.document
    previousNavigator = globalThis.navigator
    previousWindow = globalThis.window
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: dom.window.document
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: dom.window.navigator
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: dom.window
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: previousDocument
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: previousWindow
    })
  })

  it('preserves consecutive blank lines through BlockNote import and export', async () => {
    const editor = BlockNoteEditor.create()
    const storedMarkdown = 'First paragraph\n\n\nSecond paragraph'
    const editorMarkdown = prepareMarkdownForEditor(storedMarkdown)
    const blocks = editor.tryParseMarkdownToBlocks(editorMarkdown)

    expect(blocks).toHaveLength(3)

    const exportedMarkdown = await exportBlocksToMarkdown(editor, blocks)

    expect(prepareMarkdownForStorage(exportedMarkdown)).toBe(`${storedMarkdown}\n`)
  })
})
