import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('shared editor package exports', () => {
  it('can be resolved through public package specifiers', () => {
    expect(require.resolve('@mde/editor-core/assets')).toMatch(
      /packages\/editor-core\/src\/assets\.ts$/u
    )
    expect(require.resolve('@mde/editor-core/markdown')).toMatch(
      /packages\/editor-core\/src\/markdown\.ts$/u
    )
    expect(require.resolve('@mde/editor-host/fake')).toMatch(
      /packages\/editor-host\/src\/fake\.ts$/u
    )
    expect(require.resolve('@mde/editor-host/file-tree')).toMatch(
      /packages\/editor-host\/src\/fileTree\.ts$/u
    )
    expect(require.resolve('@mde/editor-react/testing')).toMatch(
      /packages\/editor-react\/src\/testing\.ts$/u
    )
  })
})
