import { describe, expect, it, vi } from 'vitest'

import {
  WORKSPACE_FILE_HISTORY_STORAGE_KEY,
  getWorkspaceLastOpenedFile,
  getWorkspaceRecentFiles,
  readWorkspaceFileHistory,
  rememberWorkspaceFile,
  removeWorkspaceFileHistoryEntry,
  renameWorkspaceFileHistoryEntry,
  writeWorkspaceFileHistory
} from '../../src/renderer/src/workspaces/workspaceFileHistory'
import type { WorkspaceFileHistory } from '../../src/renderer/src/workspaces/workspaceFileHistory'

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
    values.set(WORKSPACE_FILE_HISTORY_STORAGE_KEY, initialValue)
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

describe('workspaceFileHistory', () => {
  it('uses the MDE storage key', () => {
    expect(WORKSPACE_FILE_HISTORY_STORAGE_KEY).toBe('mde.workspaceFileHistory')
  })

  it('reads valid workspace history entries and ignores invalid values', () => {
    const { storage } = createStorage(
      JSON.stringify([
        {
          lastOpenedFilePath: 'README.md',
          recentFilePaths: ['README.md', 'docs/intro.md', 'README.md', ''],
          workspaceRoot: '/workspace'
        },
        {
          lastOpenedFilePath: null,
          recentFilePaths: ['notes.md'],
          workspaceRoot: '/empty-last'
        },
        {
          lastOpenedFilePath: 'ignored.md',
          recentFilePaths: ['ignored.md'],
          workspaceRoot: '/workspace'
        },
        { lastOpenedFilePath: 'bad.md', recentFilePaths: ['bad.md'] }
      ])
    )
    const history = readWorkspaceFileHistory(storage)

    expect(getWorkspaceLastOpenedFile(history, '/workspace')).toBe('README.md')
    expect(getWorkspaceRecentFiles(history, '/workspace')).toEqual([
      'README.md',
      'docs/intro.md'
    ])
    expect(getWorkspaceLastOpenedFile(history, '/empty-last')).toBeNull()
    expect(getWorkspaceRecentFiles(history, '/missing')).toEqual([])
  })

  it('remembers files newest first without mutating previous history', () => {
    const existing = new Map([
      [
        '/workspace',
        {
          lastOpenedFilePath: 'README.md',
          recentFilePaths: ['README.md', 'docs/intro.md']
        }
      ]
    ])

    const nextHistory = rememberWorkspaceFile(
      existing,
      '/workspace',
      'docs/intro.md'
    )

    expect(getWorkspaceLastOpenedFile(nextHistory, '/workspace')).toBe(
      'docs/intro.md'
    )
    expect(getWorkspaceRecentFiles(nextHistory, '/workspace')).toEqual([
      'docs/intro.md',
      'README.md'
    ])
    expect(getWorkspaceLastOpenedFile(existing, '/workspace')).toBe('README.md')
  })

  it('caps recent files per workspace', () => {
    const filePaths = Array.from({ length: 20 }, (_, index) => `${index}.md`)
    const history = filePaths.reduce<WorkspaceFileHistory>(
      (currentHistory, filePath) =>
        rememberWorkspaceFile(currentHistory, '/workspace', filePath),
      new Map()
    )

    expect(getWorkspaceRecentFiles(history, '/workspace')).toHaveLength(16)
    expect(getWorkspaceRecentFiles(history, '/workspace')[0]).toBe('19.md')
    expect(getWorkspaceRecentFiles(history, '/workspace')).not.toContain('0.md')
  })

  it('updates remembered file paths when a file or folder is renamed', () => {
    const history = new Map([
      [
        '/workspace',
        {
          lastOpenedFilePath: 'docs/intro.md',
          recentFilePaths: ['docs/intro.md', 'docs/deep/guide.md', 'README.md']
        }
      ]
    ])
    const nextHistory = renameWorkspaceFileHistoryEntry(
      history,
      '/workspace',
      'docs',
      'guides'
    )

    expect(getWorkspaceLastOpenedFile(nextHistory, '/workspace')).toBe(
      'guides/intro.md'
    )
    expect(getWorkspaceRecentFiles(nextHistory, '/workspace')).toEqual([
      'guides/intro.md',
      'guides/deep/guide.md',
      'README.md'
    ])
  })

  it('removes deleted files or folders from remembered history', () => {
    const history = new Map([
      [
        '/workspace',
        {
          lastOpenedFilePath: 'docs/intro.md',
          recentFilePaths: ['docs/intro.md', 'docs/deep/guide.md', 'README.md']
        }
      ]
    ])
    const nextHistory = removeWorkspaceFileHistoryEntry(
      history,
      '/workspace',
      'docs'
    )

    expect(getWorkspaceLastOpenedFile(nextHistory, '/workspace')).toBeNull()
    expect(getWorkspaceRecentFiles(nextHistory, '/workspace')).toEqual([
      'README.md'
    ])
  })

  it('persists workspace history as JSON', () => {
    const { setItem, storage } = createStorage()
    const history = rememberWorkspaceFile(new Map(), '/workspace', 'README.md')

    writeWorkspaceFileHistory(history, storage)

    expect(setItem).toHaveBeenCalledWith(
      WORKSPACE_FILE_HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          lastOpenedFilePath: 'README.md',
          recentFilePaths: ['README.md'],
          workspaceRoot: '/workspace'
        }
      ])
    )
  })
})
