import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertPathInsideWorkspace,
  resolveWorkspacePath
} from '../../src/main/services/pathSafety'

describe('pathSafety', () => {
  const workspacePath = resolve('/tmp/mdv-workspace')

  it('accepts paths inside the workspace', () => {
    const filePath = join(workspacePath, 'docs', 'intro.md')

    expect(assertPathInsideWorkspace(workspacePath, filePath)).toBe(filePath)
  })

  it('rejects traversal outside the workspace', () => {
    const outsidePath = resolve(workspacePath, '..', 'secrets.md')

    expect(() => assertPathInsideWorkspace(workspacePath, outsidePath)).toThrow(
      /outside workspace/i
    )
  })

  it('resolves relative paths only within the workspace', () => {
    expect(resolveWorkspacePath(workspacePath, 'docs/intro.md')).toBe(
      join(workspacePath, 'docs', 'intro.md')
    )

    expect(() => resolveWorkspacePath(workspacePath, '../secrets.md')).toThrow(
      /outside workspace/i
    )
  })
})
