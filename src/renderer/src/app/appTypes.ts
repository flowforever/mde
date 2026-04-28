import type { Workspace } from '../../../shared/workspace'

export interface AppState {
  readonly errorMessage: string | null
  readonly isOpeningWorkspace: boolean
  readonly selectedFilePath: string | null
  readonly workspace: Workspace | null
}

export type AppAction =
  | { readonly type: 'workspace/open-started' }
  | { readonly type: 'workspace/opened'; readonly workspace: Workspace }
  | { readonly type: 'workspace/open-cancelled' }
  | { readonly type: 'workspace/open-failed'; readonly message: string }
  | { readonly type: 'file/selected'; readonly filePath: string }
