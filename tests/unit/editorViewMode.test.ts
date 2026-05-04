import { describe, expect, it, vi } from 'vitest'

import {
  EDITOR_VIEW_MODE_STORAGE_KEY,
  readEditorViewMode,
  writeEditorViewMode
} from '../../apps/desktop/src/renderer/src/editor/editorViewMode'

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
    values.set(EDITOR_VIEW_MODE_STORAGE_KEY, initialValue)
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

describe('editorViewMode', () => {
  it('uses the MDE storage key', () => {
    expect(EDITOR_VIEW_MODE_STORAGE_KEY).toBe('mde.editorViewMode')
  })

  it('reads only the persisted full-width mode', () => {
    expect(readEditorViewMode(createStorage('full-width').storage)).toBe(
      'full-width'
    )
    expect(readEditorViewMode(createStorage('centered').storage)).toBe(
      'centered'
    )
    expect(readEditorViewMode(createStorage('expanded').storage)).toBe(
      'centered'
    )
  })

  it('writes the selected editor view mode', () => {
    const { setItem, storage } = createStorage()

    writeEditorViewMode(storage, 'full-width')

    expect(setItem).toHaveBeenCalledWith(
      EDITOR_VIEW_MODE_STORAGE_KEY,
      'full-width'
    )
    expect(readEditorViewMode(storage)).toBe('full-width')
  })

  it('falls back to centered mode when storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('storage unavailable')
      }),
      setItem: vi.fn(() => {
        throw new Error('storage unavailable')
      })
    }

    expect(readEditorViewMode(storage)).toBe('centered')
    expect(() => {
      writeEditorViewMode(storage, 'full-width')
    }).not.toThrow()
  })
})
