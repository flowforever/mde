import { describe, expect, it } from 'vitest'

import {
  collectExpandedLinkDirectoryOptions,
  createInitialLinkDirectoryState
} from '../../apps/desktop/src/renderer/src/editor/editorLinkDirectories'
import type { TreeNode } from '../../apps/desktop/src/shared/fileTree'

describe('editorLinkDirectories', () => {
  const visibleTree: readonly TreeNode[] = [
    {
      children: [
        {
          children: [],
          name: 'nested',
          path: 'docs/nested',
          type: 'directory'
        }
      ],
      name: 'docs',
      path: 'docs',
      type: 'directory'
    },
    {
      children: [
        {
          children: [],
          name: 'child',
          path: 'other/child',
          type: 'directory'
        }
      ],
      name: 'other',
      path: 'other',
      type: 'directory'
    }
  ]

  it('selects and expands only the current document directory branch', () => {
    const initialState = createInitialLinkDirectoryState(
      visibleTree,
      'docs/nested/current.md'
    )

    expect(initialState.selectedDirectoryPath).toBe('docs/nested')
    expect([...initialState.expandedDirectoryPaths]).toEqual([
      'docs',
      'docs/nested'
    ])
    expect(
      collectExpandedLinkDirectoryOptions(
        visibleTree,
        initialState.expandedDirectoryPaths
      ).map((directory) => directory.path)
    ).toEqual(['docs', 'docs/nested', 'other'])
  })

  it('falls back to workspace root when the current directory is not visible', () => {
    const initialState = createInitialLinkDirectoryState(
      visibleTree,
      '.mde/current.md'
    )

    expect(initialState.selectedDirectoryPath).toBe('')
    expect([...initialState.expandedDirectoryPaths]).toEqual([])
  })
})
