import type { AppAction, AppState } from './appTypes'

export const createInitialAppState = (): AppState => ({
  errorMessage: null,
  fileErrorMessage: null,
  isLoadingFile: false,
  isOpeningWorkspace: false,
  loadedFile: null,
  selectedFilePath: null,
  workspace: null
})

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
        isLoadingFile: false,
        loadedFile: null,
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
    case 'file/selected':
      return {
        ...state,
        selectedFilePath: action.filePath
      }
    case 'file/load-started':
      return {
        ...state,
        fileErrorMessage: null,
        isLoadingFile: true,
        loadedFile: null,
        selectedFilePath: action.filePath
      }
    case 'file/loaded':
      if (action.file.path !== state.selectedFilePath) {
        return state
      }

      return {
        ...state,
        fileErrorMessage: null,
        isLoadingFile: false,
        loadedFile: action.file
      }
    case 'file/load-failed':
      if (action.filePath !== state.selectedFilePath) {
        return state
      }

      return {
        ...state,
        fileErrorMessage: action.message,
        isLoadingFile: false,
        loadedFile: null
      }
  }
}
