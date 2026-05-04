import { describe, expect, it } from 'vitest'

import {
  composeMarkdownWithFrontmatter,
  splitMarkdownFrontmatter
} from '../../apps/desktop/src/renderer/src/editor/frontmatter'

describe('frontmatter', () => {
  it('splits YAML frontmatter only at the start of a document', () => {
    const result = splitMarkdownFrontmatter(
      [
        '---',
        'name: auto-pick-tasks',
        'description: Use ready tasks',
        '---',
        '# Auto Pick Tasks',
        '',
        'Body text.'
      ].join('\n')
    )

    expect(result.frontmatter).toMatchObject({
      fieldCount: 2,
      fields: [
        { key: 'name', value: 'auto-pick-tasks' },
        { key: 'description', value: 'Use ready tasks' }
      ],
      isValid: true,
      raw: 'name: auto-pick-tasks\ndescription: Use ready tasks'
    })
    expect(result.body).toBe('# Auto Pick Tasks\n\nBody text.')
  })

  it('ignores horizontal rules in the Markdown body', () => {
    const result = splitMarkdownFrontmatter(
      ['# Title', '', '---', '', 'Body text.'].join('\n')
    )

    expect(result.frontmatter).toBeNull()
    expect(result.body).toBe('# Title\n\n---\n\nBody text.')
  })

  it('supports BOM and CRLF wrapped frontmatter', () => {
    const result = splitMarkdownFrontmatter(
      '\uFEFF---\r\nname: auto-pick-tasks\r\n---\r\n# Body'
    )

    expect(result.leadingBom).toBe('\uFEFF')
    expect(result.lineEnding).toBe('\r\n')
    expect(result.frontmatter?.raw).toBe('name: auto-pick-tasks')
    expect(result.body).toBe('# Body')
  })

  it('recognizes a one-field frontmatter block', () => {
    const result = splitMarkdownFrontmatter('---\nname: old\n---\n# Body')

    expect(result.frontmatter).toMatchObject({
      fieldCount: 1,
      raw: 'name: old'
    })
    expect(result.body).toBe('# Body')
  })

  it('preserves raw frontmatter when composing body changes', () => {
    const parsed = splitMarkdownFrontmatter(
      [
        '---',
        '# comment',
        'name: auto-pick-tasks',
        'nested:',
        '  enabled: true',
        '---',
        '# Body'
      ].join('\n')
    )

    expect(
      composeMarkdownWithFrontmatter(parsed, '# Body\n\nUpdated paragraph.')
    ).toBe(
      [
        '---',
        '# comment',
        'name: auto-pick-tasks',
        'nested:',
        '  enabled: true',
        '---',
        '# Body',
        '',
        'Updated paragraph.'
      ].join('\n')
    )
  })

  it('uses edited raw frontmatter when composing', () => {
    const parsed = splitMarkdownFrontmatter('---\nname: old\n---\n# Body')

    expect(
      composeMarkdownWithFrontmatter(parsed, '# Body', 'name: new')
    ).toBe('---\nname: new\n---\n# Body')
  })

  it('removes the wrapper when edited frontmatter is empty', () => {
    const parsed = splitMarkdownFrontmatter('---\nname: old\n---\n# Body')

    expect(composeMarkdownWithFrontmatter(parsed, '# Body', '  \n')).toBe(
      '# Body'
    )
  })

  it('keeps invalid YAML readable and marked as invalid', () => {
    const result = splitMarkdownFrontmatter(
      ['---', 'name: [unterminated', '---', '# Body'].join('\n')
    )

    expect(result.frontmatter).toMatchObject({
      fields: [{ key: 'name', value: '[unterminated' }],
      isValid: false,
      raw: 'name: [unterminated'
    })
    expect(result.frontmatter?.parseErrorMessage).toEqual(expect.any(String))
    expect(result.body).toBe('# Body')
  })
})
