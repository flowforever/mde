import { describe, expect, it } from 'vitest'

import {
  findSearchMatches,
  getNextSearchMatchIndex
} from '../../apps/desktop/src/renderer/src/search/editorSearch'
import {
  filterSearchHistory,
  GLOBAL_SEARCH_HISTORY_LIMIT,
  rememberSearchHistoryItem,
  togglePinnedSearchQuery
} from '../../apps/desktop/src/renderer/src/search/searchHistory'

describe('editorSearch', () => {
  it('finds case-insensitive matches with line and column positions', () => {
    expect(findSearchMatches('Alpha beta\nalpha ALPHA', 'alpha')).toEqual([
      { columnNumber: 1, endOffset: 5, lineNumber: 1, startOffset: 0 },
      { columnNumber: 1, endOffset: 16, lineNumber: 2, startOffset: 11 },
      { columnNumber: 7, endOffset: 22, lineNumber: 2, startOffset: 17 }
    ])
  })

  it('cycles the active match index from Enter key navigation', () => {
    expect(getNextSearchMatchIndex(-1, 3)).toBe(0)
    expect(getNextSearchMatchIndex(0, 3)).toBe(1)
    expect(getNextSearchMatchIndex(2, 3)).toBe(0)
    expect(getNextSearchMatchIndex(0, 0)).toBe(-1)
  })

  it('remembers trimmed search terms with newest entries first', () => {
    const history = rememberSearchHistoryItem(['alpha', 'beta'], '  Beta  ')

    expect(history).toEqual(['Beta', 'alpha'])
  })

  it('filters search history by the in-progress query', () => {
    expect(filterSearchHistory(['alpha', 'beta', 'alphabet'], 'alp')).toEqual([
      'alpha',
      'alphabet'
    ])
    expect(filterSearchHistory(['alpha'], '')).toEqual(['alpha'])
  })

  it('supports a sixteen-item cap for workspace recent search history', () => {
    const history = Array.from(
      { length: GLOBAL_SEARCH_HISTORY_LIMIT + 4 },
      (_, index) => `item-${index}`
    )

    expect(GLOBAL_SEARCH_HISTORY_LIMIT).toBe(16)
    expect(
      rememberSearchHistoryItem(history, 'latest', GLOBAL_SEARCH_HISTORY_LIMIT)
    ).toEqual([
      'latest',
      ...history.slice(0, GLOBAL_SEARCH_HISTORY_LIMIT - 1)
    ])
  })

  it('toggles pinned search queries without mutating existing state', () => {
    const pinned = ['alpha']
    const added = togglePinnedSearchQuery(pinned, 'beta')

    expect(added).toEqual(['alpha', 'beta'])
    expect(pinned).toEqual(['alpha'])
    expect(togglePinnedSearchQuery(added, 'alpha')).toEqual(['beta'])
  })
})
