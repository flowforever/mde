import { describe, expect, it } from 'vitest'

import {
  findSearchMatches,
  getNextSearchMatchIndex
} from '../../src/renderer/src/search/editorSearch'

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
})
