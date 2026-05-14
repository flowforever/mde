import { describe, expect, it } from 'vitest'

import {
  normalizeDesktopMarkdownAssetPath,
  normalizeLocalMarkdownAssetStoragePath
} from '../../src/shared/markdownAssets'

describe('desktop markdown asset path safety', () => {
  it('normalizes local and legacy Markdown asset paths to storage paths', () => {
    expect(normalizeDesktopMarkdownAssetPath('mde-assets/image.png')).toEqual({
      kind: 'local',
      markdownPath: 'mde-assets/image.png',
      storagePath: 'image.png'
    })
    expect(
      normalizeDesktopMarkdownAssetPath('.mde/assets/nested/image.png')
    ).toEqual({
      kind: 'legacy',
      markdownPath: '.mde/assets/nested/image.png',
      storagePath: 'nested/image.png'
    })
  })

  it('rejects traversal, encoded traversal, absolute paths, and unsafe slash variants', () => {
    const unsafePaths = [
      'mde-assets/../secret.png',
      'mde-assets/./image.png',
      'mde-assets/%2e%2e/secret.png',
      'mde-assets/%252e%252e/secret.png',
      'mde-assets/nested%2fsecret.png',
      'mde-assets/nested\\secret.png',
      'mde-assets/nested∕secret.png',
      'mde-assets//secret.png',
      '/workspace/docs/mde-assets/image.png',
      'file:///workspace/docs/mde-assets/image.png',
      'C:/workspace/docs/mde-assets/image.png'
    ]

    for (const unsafePath of unsafePaths) {
      expect(normalizeDesktopMarkdownAssetPath(unsafePath), unsafePath).toBeNull()
    }
  })

  it('rejects unsafe local storage paths without a Markdown asset prefix', () => {
    expect(normalizeLocalMarkdownAssetStoragePath('image.png')).toBe('image.png')
    expect(normalizeLocalMarkdownAssetStoragePath('../secret.png')).toBeNull()
    expect(normalizeLocalMarkdownAssetStoragePath('%2e%2e/secret.png')).toBeNull()
    expect(normalizeLocalMarkdownAssetStoragePath('nested%2fsecret.png')).toBeNull()
  })
})
