import { describe, expect, it } from 'vitest'

import {
  collectMarkdownFilePaths,
  collectMarkdownLinkReferences,
  createMarkdownPathSuggestions,
  createRelativeMarkdownLink,
  isSupportedMarkdownLinkHref,
  resolveMarkdownLinkTarget
} from '../../packages/editor-core/src/links'
import type { TreeNode } from '../../apps/desktop/src/shared/fileTree'

const tree: readonly TreeNode[] = [
  { name: 'README.md', path: 'README.md', type: 'file' },
  {
    children: [
      { name: 'intro.md', path: 'docs/intro.md', type: 'file' },
      {
        children: [
          { name: 'deep.md', path: 'docs/nested/deep.md', type: 'file' }
        ],
        name: 'nested',
        path: 'docs/nested',
        type: 'directory'
      }
    ],
    name: 'docs',
    path: 'docs',
    type: 'directory'
  }
]

describe('editor core links', () => {
  it('classifies host-neutral link targets', () => {
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: 'docs/current.md',
        href: '../README.md'
      })
    ).toEqual({ kind: 'workspace-markdown', path: 'README.md' })
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: 'docs/current.md',
        href: '#overview'
      })
    ).toEqual({ anchor: 'overview', kind: 'anchor' })
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: 'docs/current.md',
        href: 'https://example.com'
      })
    ).toEqual({ kind: 'external-url', url: 'https://example.com' })
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: 'docs/current.md',
        href: '/Users/test/workspace/README.md'
      })
    ).toEqual({
      href: '/Users/test/workspace/README.md',
      kind: 'host-local-resource'
    })
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: 'docs/current.md',
        href: 'javascript:alert(1)'
      })
    ).toEqual({
      kind: 'unsupported',
      reason: 'dangerous-url'
    })
  })

  it('collects Markdown links without treating images as links', () => {
    expect(
      collectMarkdownLinkReferences(
        [
          '![Image](.mde/assets/a.png)',
          '[Intro](intro.md)',
          '[External](https://example.com)'
        ].join('\n'),
        { currentFilePath: 'docs/current.md' }
      )
    ).toEqual([
      {
        href: 'intro.md',
        target: { kind: 'workspace-markdown', path: 'docs/intro.md' }
      },
      {
        href: 'https://example.com',
        target: { kind: 'external-url', url: 'https://example.com' }
      }
    ])
  })

  it('keeps path suggestions and relative href generation host-neutral', () => {
    const markdownFilePaths = collectMarkdownFilePaths(tree)

    expect(markdownFilePaths).toEqual([
      'README.md',
      'docs/intro.md',
      'docs/nested/deep.md'
    ])
    expect(
      createMarkdownPathSuggestions('doc/dee', markdownFilePaths, {
        currentFilePath: 'docs/intro.md'
      })
    ).toEqual([
      {
        path: 'docs/nested/deep.md',
        relativePath: 'nested/deep.md'
      }
    ])
    expect(createRelativeMarkdownLink('docs/current.md', 'README.md')).toBe(
      '../README.md'
    )
  })

  it('rejects dangerous hrefs while allowing supported editor link schemes', () => {
    expect(isSupportedMarkdownLinkHref('javascript:alert(1)')).toBe(false)
    expect(isSupportedMarkdownLinkHref('')).toBe(false)
    expect(isSupportedMarkdownLinkHref('https://example.com')).toBe(true)
    expect(isSupportedMarkdownLinkHref('file:///Users/test/doc.md')).toBe(true)
    expect(isSupportedMarkdownLinkHref('docs/intro.md')).toBe(true)
  })
})
