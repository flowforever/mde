import type { TreeNode } from '@mde/editor-host/file-tree'
import {
  createInitialLinkDirectoryState,
  type LinkDirectoryOption
} from './editorLinkDirectories'

export interface LinkDialogState {
  readonly errorMessage: string | null
  readonly expandedDirectoryPaths: ReadonlySet<string>
  readonly hrefInput: string
  readonly mode: 'insert' | 'new-document'
  readonly newDocumentDirectoryPath: string
  readonly newDocumentName: string
  readonly selectedSuggestionIndex: number
  readonly visibleWorkspaceTree: readonly TreeNode[]
}

export const joinWorkspacePath = (
  parentPath: string,
  entryName: string
): string => (parentPath ? `${parentPath}/${entryName}` : entryName)

export const ensureMarkdownExtension = (filePath: string): string =>
  filePath.toLocaleLowerCase().endsWith('.md') ? filePath : `${filePath}.md`

export const getEditorLinkEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1
    ? entryPath
    : entryPath.slice(separatorIndex + 1)
}

export const createInitialLinkDialogState = ({
  currentFilePath,
  defaultNewDocumentName,
  visibleWorkspaceTree
}: {
  readonly currentFilePath: string
  readonly defaultNewDocumentName: string
  readonly visibleWorkspaceTree: readonly TreeNode[]
}): LinkDialogState => {
  const initialDirectoryState = createInitialLinkDirectoryState(
    visibleWorkspaceTree,
    currentFilePath
  )

  return {
    errorMessage: null,
    expandedDirectoryPaths: initialDirectoryState.expandedDirectoryPaths,
    hrefInput: '',
    mode: 'insert',
    newDocumentDirectoryPath: initialDirectoryState.selectedDirectoryPath,
    newDocumentName: defaultNewDocumentName,
    selectedSuggestionIndex: 0,
    visibleWorkspaceTree
  }
}

export const setLinkDialogMode = (
  state: LinkDialogState,
  mode: LinkDialogState['mode']
): LinkDialogState => ({
  ...state,
  errorMessage: null,
  mode
})

export const updateLinkDialogHref = (
  state: LinkDialogState,
  hrefInput: string
): LinkDialogState => ({
  ...state,
  hrefInput,
  selectedSuggestionIndex: 0
})

export const updateLinkDialogNewDocumentName = (
  state: LinkDialogState,
  newDocumentName: string
): LinkDialogState => ({
  ...state,
  errorMessage: null,
  newDocumentName
})

export const moveLinkDialogSuggestionSelection = (
  state: LinkDialogState,
  direction: -1 | 1,
  suggestionCount: number
): LinkDialogState => ({
  ...state,
  selectedSuggestionIndex:
    suggestionCount === 0
      ? 0
      : (state.selectedSuggestionIndex + direction + suggestionCount) %
        suggestionCount
})

export const selectLinkDialogDirectory = (
  state: LinkDialogState,
  directory: Pick<LinkDirectoryOption, 'hasChildDirectories' | 'isExpanded' | 'path'>
): LinkDialogState => {
  const expandedDirectoryPaths = new Set(state.expandedDirectoryPaths)

  if (directory.path.length > 0 && directory.hasChildDirectories) {
    if (directory.isExpanded) {
      expandedDirectoryPaths.delete(directory.path)
    } else {
      expandedDirectoryPaths.add(directory.path)
    }
  }

  return {
    ...state,
    errorMessage: null,
    expandedDirectoryPaths,
    newDocumentDirectoryPath: directory.path
  }
}

export const setLinkDialogError = (
  state: LinkDialogState,
  errorMessage: string
): LinkDialogState => ({
  ...state,
  errorMessage
})
