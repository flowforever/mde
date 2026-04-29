import { describe, expect, it, vi } from 'vitest'

import {
  exportBlocksToMarkdown,
  importMarkdownToBlocks,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage,
  type MarkdownBlockEditorAdapter
} from '../../src/renderer/src/editor/markdownTransforms'

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

  it('resolves local image asset paths to file URLs for editor preview', () => {
    const result = prepareMarkdownForEditor(
      '![Screenshot](.mde/assets/screenshot.png)',
      {
        markdownFilePath: 'docs/README.md',
        workspaceRoot: '/Users/test/workspace'
      }
    )

    expect(result).toBe(
      '![Screenshot](file:///Users/test/workspace/docs/.mde/assets/screenshot.png)'
    )
  })

  it('keeps stored Markdown portable by converting file URLs back to sibling asset paths', () => {
    const result = prepareMarkdownForStorage(
      '![Screenshot](file:///Users/test/workspace/docs/.mde/assets/screenshot.png)',
      {
        markdownFilePath: 'docs/README.md',
        workspaceRoot: '/Users/test/workspace'
      }
    )

    expect(result).toBe('![Screenshot](.mde/assets/screenshot.png)')
  })
})
