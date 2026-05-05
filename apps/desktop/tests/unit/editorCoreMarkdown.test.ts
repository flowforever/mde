import { describe, expect, it } from 'vitest'

import {
  parseMarkdownSemanticDocument,
  parseMarkdownSourceDocument
} from '@mde/editor-core/markdown'

describe('editor core Markdown semantics', () => {
  it('preserves source offsets, BOM, CRLF, frontmatter, and raw Markdown', () => {
    const markdown = [
      '\uFEFF---',
      'title: Shared editor',
      '---',
      '# Body',
      '',
      'Paragraph.'
    ].join('\r\n')

    const document = parseMarkdownSourceDocument(markdown)

    expect(document.rawMarkdown).toBe(markdown)
    expect(document.leadingBom).toBe('\uFEFF')
    expect(document.lineEnding).toBe('\r\n')
    expect(document.frontmatter?.raw).toBe('title: Shared editor')
    expect(document.body).toBe('# Body\r\n\r\nParagraph.')
    expect(document.bodyStartLineNumber).toBe(4)
    expect(document.bodyStartOffset).toBe(markdown.indexOf('# Body'))
  })

  it('creates a semantic document with Mermaid, asset, and link references', () => {
    const markdown = [
      '---',
      'name: example',
      '---',
      '# Workflow',
      '',
      '![Local](.mde/assets/diagram.png)',
      '![Remote](https://example.com/image.png)',
      '',
      '[Intro](docs/intro.md)',
      '[Anchor](#section)',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```'
    ].join('\n')

    const semanticDocument = parseMarkdownSemanticDocument(markdown)

    expect(semanticDocument.source.rawMarkdown).toBe(markdown)
    expect(semanticDocument.mermaidBlocks).toEqual([
      { index: 0, source: 'flowchart TD\n  A --> B' }
    ])
    expect(semanticDocument.assetReferences).toEqual([
      {
        altText: 'Local',
        kind: 'portable-markdown-path',
        rawTarget: '.mde/assets/diagram.png'
      },
      {
        altText: 'Remote',
        kind: 'external-url',
        rawTarget: 'https://example.com/image.png'
      }
    ])
    expect(semanticDocument.linkReferences).toEqual([
      {
        href: 'docs/intro.md',
        target: { kind: 'workspace-markdown', path: 'docs/intro.md' }
      },
      {
        href: '#section',
        target: { anchor: 'section', kind: 'anchor' }
      }
    ])
  })
})
