import { describe, expect, it } from 'vitest'

import {
  createVisibleEditorLinkTree,
  collectExpandedLinkDirectoryOptions
} from '../../apps/desktop/src/renderer/src/editor/editorLinkDirectories'
import {
  DEFAULT_HIDDEN_EXPLORER_WORKSPACES_STORAGE_KEY,
  HIDDEN_EXPLORER_ENTRIES_STORAGE_KEY
} from '../../apps/desktop/src/renderer/src/explorer/hiddenExplorerEntries'
import type { TreeNode } from '../../apps/desktop/src/shared/fileTree'

const createStorage = (
  values: Readonly<Record<string, string>>
): Pick<Storage, 'getItem'> => ({
  getItem: (key) => values[key] ?? null
})

describe('editor link directory integration', () => {
  it('derives picker directories from the same hidden-entry storage as Explorer', () => {
    const tree: readonly TreeNode[] = [
      {
        children: [],
        name: '.mde',
        path: '.mde',
        type: 'directory'
      },
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
        children: [],
        name: 'private',
        path: 'private',
        type: 'directory'
      }
    ]
    const visibleTree = createVisibleEditorLinkTree(tree, '/workspace', {
      storage: createStorage({
        [DEFAULT_HIDDEN_EXPLORER_WORKSPACES_STORAGE_KEY]: JSON.stringify([]),
        [HIDDEN_EXPLORER_ENTRIES_STORAGE_KEY]: JSON.stringify({
          '/workspace': ['private']
        })
      })
    })

    expect(
      collectExpandedLinkDirectoryOptions(
        visibleTree,
        new Set(['docs'])
      ).map((directory) => directory.path)
    ).toEqual(['docs', 'docs/nested'])
  })
})
