import type { TreeNode } from '../../../shared/fileTree'
import type { FileContents, Workspace } from '../../../shared/workspace'
import type {
  DeletedDocumentHistoryEntry,
  DocumentHistoryFilterId,
  DocumentHistoryVersion
} from '../../../shared/documentHistory'

export interface HistoryPreviewState {
  readonly contents: string
  readonly deletedDocument?: DeletedDocumentHistoryEntry
  readonly mode: 'current-file' | 'deleted-document'
  readonly version: DocumentHistoryVersion
}

export interface AppState {
  readonly deletedDocumentHistory?: readonly DeletedDocumentHistoryEntry[]
  readonly documentHistoryFilterId?: DocumentHistoryFilterId
  readonly documentHistoryVersions?: readonly DocumentHistoryVersion[]
  readonly draftMarkdown: string | null
  readonly errorMessage: string | null
  readonly fileErrorMessage: string | null
  readonly historyPreview?: HistoryPreviewState | null
  readonly isDocumentHistoryPanelVisible?: boolean
  readonly isDeletedDocumentHistoryVisible?: boolean
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
  | {
      readonly type: 'history/deleted-documents-loaded'
      readonly documents: readonly DeletedDocumentHistoryEntry[]
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'history/versions-loaded'
      readonly versions: readonly DocumentHistoryVersion[]
      readonly workspaceRoot: string
    }
  | {
      readonly filterId: DocumentHistoryFilterId
      readonly type: 'history/filter-selected'
      readonly workspaceRoot: string
    }
  | {
      readonly isVisible: boolean
      readonly type: 'history/panel-visibility-set'
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'history/preview-loaded'
      readonly contents: string
      readonly deletedDocument?: DeletedDocumentHistoryEntry
      readonly mode: 'current-file' | 'deleted-document'
      readonly version: DocumentHistoryVersion
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'history/preview-closed'
      readonly workspaceRoot: string
    }
  | {
      readonly type: 'file/content-restored'
      readonly contents: string
      readonly filePath: string
      readonly workspaceRoot: string
    }
  | { readonly type: 'explorer/entry-selected'; readonly entryPath: string | null }
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
  | {
      readonly type: 'file/content-changed'
      readonly contents: string
      readonly filePath: string
      readonly workspaceRoot: string
    }
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
