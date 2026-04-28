import type { FileContents, Workspace } from '../../../shared/workspace'

export interface AppState {
  readonly errorMessage: string | null
  readonly fileErrorMessage: string | null
  readonly isLoadingFile: boolean
  readonly isOpeningWorkspace: boolean
  readonly loadedFile: FileContents | null
  readonly selectedFilePath: string | null
  readonly workspace: Workspace | null
}

export type AppAction =
  | { readonly type: 'workspace/open-started' }
  | { readonly type: 'workspace/opened'; readonly workspace: Workspace }
  | { readonly type: 'workspace/open-cancelled' }
  | { readonly type: 'workspace/open-failed'; readonly message: string }
  | { readonly type: 'file/selected'; readonly filePath: string }
  | { readonly type: 'file/load-started'; readonly filePath: string }
  | { readonly type: 'file/loaded'; readonly file: FileContents }
  | { readonly type: 'file/load-failed'; readonly message: string }
