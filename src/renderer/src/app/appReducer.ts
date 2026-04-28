import type { AppAction, AppState } from './appTypes'

export const createInitialAppState = (): AppState => ({
  errorMessage: null,
  isOpeningWorkspace: false,
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
  }
}
