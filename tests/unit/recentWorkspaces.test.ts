import { describe, expect, it, vi } from 'vitest'

import {
  RECENT_WORKSPACES_STORAGE_KEY,
  forgetRecentWorkspace,
  readRecentWorkspaces,
  rememberWorkspace,
  writeRecentWorkspaces
} from '../../src/renderer/src/workspaces/recentWorkspaces'

const createStorage = (
  initialValue?: string
): {
  readonly setItem: ReturnType<typeof vi.fn>
  readonly storage: Storage
} => {
  const values = new Map<string, string>()
  const setItem = vi.fn((key: string, value: string) => {
    values.set(key, value)
  })

  if (initialValue !== undefined) {
    values.set(RECENT_WORKSPACES_STORAGE_KEY, initialValue)
  }

  return {
    setItem,
    storage: {
      clear: vi.fn(() => {
        values.clear()
      }),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
      get length() {
        return values.size
      },
      removeItem: vi.fn((key: string) => {
        values.delete(key)
      }),
      setItem
    }
  }
}

describe('recentWorkspaces', () => {
  it('reads only valid remembered workspaces', () => {
    const { storage } = createStorage(
      JSON.stringify([
        { name: 'Docs', rootPath: '/workspaces/docs', type: 'workspace' },
        {
          filePath: '/notes/API.md',
          name: 'API.md',
          openedFilePath: 'API.md',
          rootPath: '/notes',
          type: 'file'
        },
        { name: '', rootPath: '/empty-name' },
        { name: 'Missing path' },
        { name: 'Docs duplicate', rootPath: '/workspaces/docs', type: 'workspace' },
        {
          filePath: '/notes/API.md',
          name: 'API duplicate.md',
          openedFilePath: 'API.md',
          rootPath: '/notes',
          type: 'file'
        }
      ])
    )

    expect(readRecentWorkspaces(storage)).toEqual([
      { name: 'Docs', rootPath: '/workspaces/docs', type: 'workspace' },
      {
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        type: 'file'
      }
    ])
  })

  it('moves the active workspace to the front and caps the list', () => {
    const existingWorkspaces = Array.from({ length: 30 }, (_, index) => ({
      name: `Workspace ${index}`,
      rootPath: `/workspaces/${index}`,
      type: 'workspace' as const
    }))

    expect(
      rememberWorkspace(existingWorkspaces, {
        name: 'Workspace 5',
        rootPath: '/workspaces/5',
        type: 'workspace'
      })
    ).toEqual([
      { name: 'Workspace 5', rootPath: '/workspaces/5', type: 'workspace' },
      ...existingWorkspaces.slice(0, 5),
      ...existingWorkspaces.slice(6, 24)
    ])
  })

  it('remembers standalone files separately from their parent workspace', () => {
    expect(
      rememberWorkspace(
        [
          {
            name: 'notes',
            rootPath: '/notes',
            type: 'workspace'
          }
        ],
        {
          filePath: '/notes/API.md',
          name: 'API.md',
          openedFilePath: 'API.md',
          rootPath: '/notes',
          type: 'file'
        }
      )
    ).toEqual([
      {
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        type: 'file'
      },
      {
        name: 'notes',
        rootPath: '/notes',
        type: 'workspace'
      }
    ])
  })

  it('removes a remembered workspace or file without touching other entries', () => {
    const workspaces = [
      {
        name: 'notes',
        rootPath: '/notes',
        type: 'workspace' as const
      },
      {
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        type: 'file' as const
      }
    ]

    expect(forgetRecentWorkspace(workspaces, workspaces[1])).toEqual([
      {
        name: 'notes',
        rootPath: '/notes',
        type: 'workspace'
      }
    ])
  })

  it('persists remembered workspaces as JSON', () => {
    const { setItem, storage } = createStorage()

    writeRecentWorkspaces(storage, [
      { name: 'Docs', rootPath: '/workspaces/docs', type: 'workspace' }
    ])

    expect(setItem).toHaveBeenCalledWith(
      RECENT_WORKSPACES_STORAGE_KEY,
      JSON.stringify([
        { name: 'Docs', rootPath: '/workspaces/docs', type: 'workspace' }
      ])
    )
  })
})
