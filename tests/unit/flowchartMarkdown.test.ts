import { describe, expect, it } from 'vitest'

import {
  extractMermaidBlocks,
  replaceMermaidBlockSource
} from '../../src/renderer/src/editor/flowchartMarkdown'

describe('flowchartMarkdown', () => {
  it('extracts Mermaid fenced blocks from Markdown', () => {
    const blocks = extractMermaidBlocks(
      [
        '## End-to-End Flow',
        '',
        '```mermaid',
        'flowchart TD',
        '  A[Start] --> B[Done]',
        '```'
      ].join('\n')
    )

    expect(blocks).toEqual([
      {
        index: 0,
        source: 'flowchart TD\n  A[Start] --> B[Done]'
      }
    ])
  })

  it('replaces a selected Mermaid block without changing surrounding Markdown', () => {
    const markdown = [
      '# Workflow',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
      '',
      'Keep this paragraph.'
    ].join('\n')

    const result = replaceMermaidBlockSource(markdown, 0, 'flowchart LR\n  B --> C')

    expect(result).toBe(
      [
        '# Workflow',
        '',
        '```mermaid',
        'flowchart LR',
        '  B --> C',
        '```',
        '',
        'Keep this paragraph.'
      ].join('\n')
    )
  })
})
