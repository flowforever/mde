import type { TreeNode } from '../../../shared/fileTree'
import type { FileContents, Workspace } from '../../../shared/workspace'

export interface AppState {
  readonly draftMarkdown: string | null
  readonly errorMessage: string | null
  readonly fileErrorMessage: string | null
  readonly isDirty: boolean
  readonly isLoadingFile: boolean
  readonly isOpeningWorkspace: boolean
  readonly isSavingFile: boolean
  readonly loadedFile: FileContents | null
  readonly loadingWorkspaceRoot: string | null
  readonly selectedEntryPath: string | null
  readonly selectedFilePath: string | null
  readonly workspace: Workspace | null
}

export type AppAction =
  | { readonly type: 'workspace/open-started' }
  | { readonly type: 'workspace/opened'; readonly workspace: Workspace }
  | { readonly type: 'workspace/open-cancelled' }
  | { readonly type: 'workspace/open-failed'; readonly message: string }
  | {
      readonly type: 'workspace/tree-refreshed'
      readonly tree: readonly TreeNode[]
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'workspace/operation-failed'
      readonly message: string
      readonly workspaceRoot: string
    }
  | { readonly type: 'explorer/entry-selected'; readonly entryPath: string }
  | { readonly type: 'file/selected'; readonly filePath: string }
  | {
      readonly type: 'file/load-started'
      readonly filePath: string
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/loaded'
      readonly file: FileContents
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/load-failed'
      readonly filePath: string
      readonly message: string
      readonly workspaceRoot: string
    }
  | { readonly type: 'file/content-changed'; readonly contents: string }
  | {
      readonly type: 'file/save-started'
      readonly filePath: string
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/save-succeeded'
      readonly contents: string
      readonly filePath: string
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/save-failed'
      readonly filePath: string
      readonly message: string
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/entry-renamed'
      readonly oldPath: string
      readonly newPath: string
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/entry-deleted'
      readonly entryPath: string
      readonly workspaceRoot: string
    }
