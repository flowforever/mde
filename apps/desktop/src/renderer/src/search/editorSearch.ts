import {
  findTextSearchMatches,
  getNextSearchMatchIndex,
  type TextSearchMatch
} from '../../../shared/search'

export type EditorSearchMatch = TextSearchMatch

export const findSearchMatches = (
  contents: string,
  query: string
): readonly EditorSearchMatch[] => findTextSearchMatches(contents, query)

export { getNextSearchMatchIndex }
