export interface TextSearchMatch {
  readonly columnNumber: number
  readonly endOffset: number
  readonly lineNumber: number
  readonly startOffset: number
}

export const normalizeSearchQuery = (query: string): string => query.trim()

export const findTextSearchMatches = (
  contents: string,
  query: string
): readonly TextSearchMatch[] => {
  const normalizedQuery = normalizeSearchQuery(query)

  if (normalizedQuery.length === 0) {
    return []
  }

  const lowerContents = contents.toLocaleLowerCase()
  const lowerQuery = normalizedQuery.toLocaleLowerCase()
  const matches: TextSearchMatch[] = []
  let index = lowerContents.indexOf(lowerQuery)

  while (index !== -1) {
    const precedingContents = contents.slice(0, index)
    const lineNumber = precedingContents.split('\n').length
    const lastLineBreakIndex = precedingContents.lastIndexOf('\n')
    const columnNumber = index - lastLineBreakIndex

    matches.push({
      columnNumber,
      endOffset: index + normalizedQuery.length,
      lineNumber,
      startOffset: index
    })
    index = lowerContents.indexOf(lowerQuery, index + normalizedQuery.length)
  }

  return matches
}

export const getNextSearchMatchIndex = (
  currentIndex: number,
  matchCount: number
): number => (matchCount <= 0 ? -1 : (currentIndex + 1) % matchCount)
