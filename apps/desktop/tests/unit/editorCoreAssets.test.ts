import { describe, expect, it } from 'vitest'

import {
  collectMarkdownAssetReferences,
  rewriteMarkdownImageTargets
} from '@mde/editor-core/assets'

describe('editor core assets', () => {
  it('classifies portable paths, external URLs, and host display URLs', () => {
    expect(
      collectMarkdownAssetReferences(
        [
          '![Portable](.mde/assets/a.png)',
          '![Remote](https://example.com/a.png)',
          '![Display](file:///Users/test/workspace/a.png)'
        ].join('\n')
      )
    ).toEqual([
      {
        altText: 'Portable',
        kind: 'portable-markdown-path',
        rawTarget: '.mde/assets/a.png'
      },
      {
        altText: 'Remote',
        kind: 'external-url',
        rawTarget: 'https://example.com/a.png'
      },
      {
        altText: 'Display',
        kind: 'host-display-url',
        rawTarget: 'file:///Users/test/workspace/a.png'
      }
    ])
  })

  it('rewrites image targets through an injected resolver without knowing host policy', () => {
    const markdown = [
      '![Portable](.mde/assets/a.png "title")',
      '![Remote](https://example.com/a.png)'
    ].join('\n')

    expect(
      rewriteMarkdownImageTargets(markdown, (reference) =>
        reference.kind === 'portable-markdown-path'
          ? `host://${reference.rawTarget}`
          : null
      )
    ).toBe(
      [
        '![Portable](host://.mde/assets/a.png "title")',
        '![Remote](https://example.com/a.png)'
      ].join('\n')
    )
  })
})
