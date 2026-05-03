import { describe, expect, it } from 'vitest'

import {
  readSearchHistory,
  rememberSearchHistoryItem,
  writeSearchHistory
} from '../../src/renderer/src/search/searchHistory'

const createStorage = (): Storage => {
  const values = new Map<string, string>()

  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('search history persistence', () => {
  it('round trips normalized search history through storage', () => {
    const storage = createStorage()
    const history = rememberSearchHistoryItem(['alpha'], '  beta  ')

    writeSearchHistory('mde.testSearchHistory', history, storage)

    expect(readSearchHistory('mde.testSearchHistory', storage)).toEqual([
      'beta',
      'alpha'
    ])
  })

  it('ignores corrupted stored search history', () => {
    const storage = createStorage()

    storage.setItem('mde.testSearchHistory', '{not json')

    expect(readSearchHistory('mde.testSearchHistory', storage)).toEqual([])
  })
})
