import { describe, expect, it, vi } from 'vitest'

import {
  exportBlocksToMarkdown,
  importMarkdownToBlocks,
  MARKDOWN_BLANK_LINE_MARKER,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage,
  type MarkdownBlockEditorAdapter
} from '@mde/editor-react'
import { createDesktopMarkdownAssetResolver } from '../../src/renderer/src/editorHost/desktopMarkdownAssetResolver'

describe('markdownTransforms', () => {
  it('imports Markdown-compatible block types through the editor adapter', async () => {
    const blocks = [
      { content: 'Title', props: { level: 1 }, type: 'heading' },
      { content: 'Paragraph text', type: 'paragraph' },
      { content: 'Bullet item', type: 'bulletListItem' },
      { content: 'Quoted text', type: 'quote' },
      { content: 'const value = 1', type: 'codeBlock' }
    ]
    const editor: MarkdownBlockEditorAdapter<typeof blocks> = {
      blocksToMarkdownLossy: vi.fn(),
      tryParseMarkdownToBlocks: vi.fn().mockReturnValue(blocks)
    }

    const result = await importMarkdownToBlocks(
      editor,
      [
        '# Title',
        '',
        'Paragraph text',
        '',
        '- Bullet item',
        '',
        '> Quoted text',
        '',
        '```ts',
        'const value = 1',
        '```'
      ].join('\n')
    )

    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
      expect.stringContaining('- Bullet item')
    )
    expect(result).toEqual(blocks)
  })

  it('exports Markdown-compatible block types through the editor adapter', async () => {
    const blocks = [
      { content: 'Title', props: { level: 1 }, type: 'heading' },
      { content: 'Paragraph text', type: 'paragraph' },
      { content: 'Bullet item', type: 'bulletListItem' },
      { content: 'Quoted text', type: 'quote' },
      { content: 'const value = 1', type: 'codeBlock' }
    ]
    const editor: MarkdownBlockEditorAdapter<typeof blocks> = {
      blocksToMarkdownLossy: vi
        .fn()
        .mockReturnValue(
          '# Title\n\nParagraph text\n\n- Bullet item\n\n> Quoted text\n\n```ts\nconst value = 1\n```'
        ),
      tryParseMarkdownToBlocks: vi.fn()
    }

    const result = await exportBlocksToMarkdown(editor, blocks)

    expect(editor.blocksToMarkdownLossy).toHaveBeenCalledWith(blocks)
    expect(result).toContain('# Title')
    expect(result).toContain('- Bullet item')
    expect(result).toContain('> Quoted text')
    expect(result).toContain('```ts')
  })

  it('exports empty paragraph blocks as restorable blank-line markers', async () => {
    const blocks = [
      {
        children: [],
        content: [{ styles: {}, text: 'First', type: 'text' }],
        id: 'first',
        props: {},
        type: 'paragraph'
      },
      {
        children: [],
        content: [],
        id: 'blank',
        props: {},
        type: 'paragraph'
      },
      {
        children: [],
        content: [{ styles: {}, text: 'Second', type: 'text' }],
        id: 'second',
        props: {},
        type: 'paragraph'
      }
    ]
    const editor: MarkdownBlockEditorAdapter<typeof blocks> = {
      blocksToMarkdownLossy: vi.fn((nextBlocks: typeof blocks = []) =>
        nextBlocks
          .map((block) =>
            Array.isArray(block.content)
              ? block.content
                  .map((item: { readonly text?: string }) => item.text ?? '')
                  .join('')
              : String(block.content ?? '')
          )
          .join('\n\n')
      ),
      tryParseMarkdownToBlocks: vi.fn()
    }

    const result = await exportBlocksToMarkdown(editor, blocks)

    expect(editor.blocksToMarkdownLossy).toHaveBeenCalledWith([
      blocks[0],
      {
        ...blocks[1],
        content: [
          {
            styles: {},
            text: MARKDOWN_BLANK_LINE_MARKER,
            type: 'text'
          }
        ]
      },
      blocks[2]
    ])
    expect(result).toBe(`First\n\n${MARKDOWN_BLANK_LINE_MARKER}\n\nSecond`)
  })

  it('resolves local image asset paths to file URLs for editor preview', () => {
    const result = prepareMarkdownForEditor(
      '![Screenshot](.mde/assets/screenshot.png)',
      createDesktopMarkdownAssetResolver({
        markdownFilePath: 'docs/README.md',
        workspaceRoot: '/Users/test/workspace'
      })
    )

    expect(result).toBe(
      '![Screenshot](file:///Users/test/workspace/docs/.mde/assets/screenshot.png)'
    )
  })

  it('accepts an injected asset resolver for non-desktop preview URLs', () => {
    const result = prepareMarkdownForEditor(
      '![Screenshot](asset://logical-id)',
      {
        toEditorUrl: (reference) =>
          reference.rawTarget === 'asset://logical-id'
            ? 'host-display://logical-id'
            : null,
        toStoragePath: () => null
      }
    )

    expect(result).toBe('![Screenshot](host-display://logical-id)')
  })

  it('preserves intentional blank lines outside fenced code during editor storage round trips', () => {
    const storedMarkdown = [
      'First paragraph',
      '',
      '',
      'Second paragraph',
      '',
      '```ts',
      'const value = 1',
      '',
      '',
      'const next = 2',
      '```'
    ].join('\n')

    const editorMarkdown = prepareMarkdownForEditor(storedMarkdown)

    expect(editorMarkdown).toBe(
      [
        'First paragraph',
        '',
        MARKDOWN_BLANK_LINE_MARKER,
        '',
        'Second paragraph',
        '',
        '```ts',
        'const value = 1',
        '',
        '',
        'const next = 2',
        '```'
      ].join('\n')
    )
    expect(
      prepareMarkdownForStorage(editorMarkdown)
    ).toBe(storedMarkdown)
  })

  it('keeps stored Markdown portable by converting file URLs back to sibling asset paths', () => {
    const result = prepareMarkdownForStorage(
      '![Screenshot](file:///Users/test/workspace/docs/.mde/assets/screenshot.png)',
      createDesktopMarkdownAssetResolver({
        markdownFilePath: 'docs/README.md',
        workspaceRoot: '/Users/test/workspace'
      })
    )

    expect(result).toBe('![Screenshot](.mde/assets/screenshot.png)')
  })

  it('accepts an injected asset resolver for non-desktop storage paths', () => {
    const result = prepareMarkdownForStorage(
      '![Screenshot](host-display://logical-id)',
      {
        toEditorUrl: () => null,
        toStoragePath: (reference) =>
          reference.rawTarget === 'host-display://logical-id'
            ? 'assets/screenshot.png'
            : null
      }
    )

    expect(result).toBe('![Screenshot](assets/screenshot.png)')
  })
})
