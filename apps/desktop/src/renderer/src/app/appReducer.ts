import type { AppAction, AppState } from './appTypes'

export const createInitialAppState = (): AppState => ({
  deletedDocumentHistory: [],
  documentHistoryFilterId: 'all',
  documentHistoryVersions: [],
  draftMarkdown: null,
  errorMessage: null,
  fileErrorMessage: null,
  historyPreview: null,
  isDocumentHistoryPanelVisible: false,
  isDeletedDocumentHistoryVisible: false,
  isDirty: false,
  isLoadingFile: false,
  isOpeningWorkspace: false,
  isSavingFile: false,
  loadedFile: null,
  loadingWorkspaceRoot: null,
  selectedEntryPath: null,
  selectedFilePath: null,
  workspace: null
})

const isPathAtOrInside = (entryPath: string, targetPath: string): boolean =>
  targetPath === entryPath || targetPath.startsWith(`${entryPath}/`)

const replacePathPrefix = (
  targetPath: string,
  oldPath: string,
  newPath: string
): string =>
  targetPath === oldPath
    ? newPath
    : `${newPath}/${targetPath.slice(oldPath.length + 1)}`

const isCurrentWorkspace = (state: AppState, workspaceRoot: string): boolean =>
  state.workspace?.rootPath === workspaceRoot

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'workspace/open-started':
      return {
        ...state,
        errorMessage: null,
        isOpeningWorkspace: true
      }
    case 'workspace/opened':
      return {
        ...state,
        errorMessage: null,
        isOpeningWorkspace: false,
        fileErrorMessage: null,
        draftMarkdown: null,
        isDirty: false,
        isLoadingFile: false,
        isSavingFile: false,
        deletedDocumentHistory: [],
        documentHistoryFilterId: 'all',
        documentHistoryVersions: [],
        historyPreview: null,
        isDocumentHistoryPanelVisible: false,
        isDeletedDocumentHistoryVisible: false,
        loadedFile: null,
        loadingWorkspaceRoot: null,
        selectedEntryPath: null,
        selectedFilePath: null,
        workspace: action.workspace
      }
    case 'workspace/open-cancelled':
      return {
        ...state,
        isOpeningWorkspace: false
      }
    case 'workspace/open-failed':
      return {
        ...state,
        errorMessage: action.message,
        isOpeningWorkspace: false
      }
    case 'workspace/tree-refreshed':
      if (!state.workspace || !isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        errorMessage: null,
        workspace: {
          ...state.workspace,
          tree: action.tree
        }
      }
    case 'workspace/operation-failed':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        errorMessage: action.message
      }
    case 'history/deleted-documents-loaded':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        deletedDocumentHistory: action.documents,
        isDeletedDocumentHistoryVisible: true
      }
    case 'history/versions-loaded':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        documentHistoryFilterId: 'all',
        documentHistoryVersions: action.versions,
        isDocumentHistoryPanelVisible: true
      }
    case 'history/deleted-documents-visibility-set':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        isDeletedDocumentHistoryVisible: action.isVisible
      }
    case 'history/filter-selected':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        documentHistoryFilterId: action.filterId
      }
    case 'history/panel-visibility-set':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        isDocumentHistoryPanelVisible: action.isVisible
      }
    case 'history/preview-loaded':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        historyPreview: {
          contents: action.contents,
          deletedDocument: action.deletedDocument,
          mode: action.mode,
          version: action.version
        },
        isDocumentHistoryPanelVisible: true
      }
    case 'history/preview-closed':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        historyPreview: null
      }
    case 'explorer/entry-selected':
      return {
        ...state,
        selectedEntryPath: action.entryPath
      }
    case 'file/selected':
      return {
        ...state,
        selectedEntryPath: action.filePath,
        selectedFilePath: action.filePath
      }
    case 'file/load-started':
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      return {
        ...state,
        draftMarkdown: null,
        fileErrorMessage: null,
        historyPreview: null,
        isDirty: false,
        isDocumentHistoryPanelVisible: false,
        isLoadingFile: true,
        isSavingFile: false,
        loadedFile: null,
        loadingWorkspaceRoot: action.workspaceRoot,
        selectedEntryPath: action.filePath,
        selectedFilePath: action.filePath
      }
    case 'file/loaded':
      if (
        action.file.path !== state.selectedFilePath ||
        action.workspaceRoot !== state.loadingWorkspaceRoot
      ) {
        return state
      }

      return {
        ...state,
        draftMarkdown: action.file.contents,
        fileErrorMessage: null,
        isDirty: false,
        isLoadingFile: false,
        isSavingFile: false,
        loadedFile: action.file,
        loadingWorkspaceRoot: null
      }
    case 'file/external-contents-changed':
      if (
        state.loadedFile?.path !== action.file.path ||
        !isCurrentWorkspace(state, action.workspaceRoot)
      ) {
        return state
      }

      return {
        ...state,
        draftMarkdown: action.file.contents,
        fileErrorMessage: null,
        isDirty: false,
        isLoadingFile: false,
        isSavingFile: false,
        loadedFile: action.file,
        loadingWorkspaceRoot: null
      }
    case 'file/load-failed':
      if (
        action.filePath !== state.selectedFilePath ||
        action.workspaceRoot !== state.loadingWorkspaceRoot
      ) {
        return state
      }

      return {
        ...state,
        draftMarkdown: null,
        fileErrorMessage: action.message,
        isDirty: false,
        isLoadingFile: false,
        isSavingFile: false,
        loadedFile: null,
        loadingWorkspaceRoot: null
      }
    case 'file/content-changed':
      if (
        state.loadedFile?.path !== action.filePath ||
        !isCurrentWorkspace(state, action.workspaceRoot)
      ) {
        return state
      }

      return {
        ...state,
        draftMarkdown: action.contents,
        fileErrorMessage: null,
        isDirty: action.contents !== state.loadedFile.contents
      }
    case 'file/content-restored':
      if (
        state.loadedFile?.path !== action.filePath ||
        !isCurrentWorkspace(state, action.workspaceRoot)
      ) {
        return state
      }

      return {
        ...state,
        draftMarkdown: action.contents,
        fileErrorMessage: null,
        isDirty: action.contents !== state.loadedFile.contents
      }
    case 'file/save-started':
      if (
        state.loadedFile?.path !== action.filePath ||
        state.workspace?.rootPath !== action.workspaceRoot
      ) {
        return state
      }

      return {
        ...state,
        fileErrorMessage: null,
        isSavingFile: true
      }
    case 'file/save-succeeded': {
      if (
        state.loadedFile?.path !== action.filePath ||
        state.workspace?.rootPath !== action.workspaceRoot
      ) {
        return state
      }

      const draftMarkdown = state.draftMarkdown ?? action.contents

      return {
        ...state,
        draftMarkdown,
        fileErrorMessage: null,
        isDirty: draftMarkdown !== action.contents,
        isSavingFile: false,
        loadedFile: {
          contents: action.contents,
          path: action.filePath
        }
      }
    }
    case 'file/save-failed':
      if (
        state.loadedFile?.path !== action.filePath ||
        state.workspace?.rootPath !== action.workspaceRoot
      ) {
        return state
      }

      return {
        ...state,
        fileErrorMessage: action.message,
        isSavingFile: false
      }
    case 'file/entry-renamed': {
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      const loadedFilePath = state.loadedFile?.path
      const renamedLoadedFilePath =
        loadedFilePath && isPathAtOrInside(action.oldPath, loadedFilePath)
          ? replacePathPrefix(loadedFilePath, action.oldPath, action.newPath)
          : loadedFilePath
      const renamedSelectedEntryPath =
        state.selectedEntryPath &&
        isPathAtOrInside(action.oldPath, state.selectedEntryPath)
          ? replacePathPrefix(
              state.selectedEntryPath,
              action.oldPath,
              action.newPath
            )
          : state.selectedEntryPath

      return {
        ...state,
        loadedFile:
          state.loadedFile && renamedLoadedFilePath
            ? {
                ...state.loadedFile,
                path: renamedLoadedFilePath
              }
            : state.loadedFile,
        selectedEntryPath: renamedSelectedEntryPath,
        selectedFilePath:
          state.selectedFilePath &&
          isPathAtOrInside(action.oldPath, state.selectedFilePath)
            ? replacePathPrefix(
                state.selectedFilePath,
                action.oldPath,
                action.newPath
              )
            : state.selectedFilePath
      }
    }
    case 'file/entry-deleted': {
      if (!isCurrentWorkspace(state, action.workspaceRoot)) {
        return state
      }

      const removedLoadedFile =
        state.loadedFile &&
        isPathAtOrInside(action.entryPath, state.loadedFile.path)
      const removedSelectedEntry =
        state.selectedEntryPath &&
        isPathAtOrInside(action.entryPath, state.selectedEntryPath)

      if (!removedLoadedFile && !removedSelectedEntry) {
        return state
      }

      return {
        ...state,
        draftMarkdown: removedLoadedFile ? null : state.draftMarkdown,
        fileErrorMessage: removedLoadedFile ? null : state.fileErrorMessage,
        isDirty: removedLoadedFile ? false : state.isDirty,
        isLoadingFile: removedLoadedFile ? false : state.isLoadingFile,
        isSavingFile: removedLoadedFile ? false : state.isSavingFile,
        loadedFile: removedLoadedFile ? null : state.loadedFile,
        loadingWorkspaceRoot: removedLoadedFile ? null : state.loadingWorkspaceRoot,
        selectedEntryPath: removedSelectedEntry ? null : state.selectedEntryPath,
        selectedFilePath: removedLoadedFile ? null : state.selectedFilePath
      }
    }
  }
}
