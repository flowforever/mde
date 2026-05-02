import type { TreeNode } from './fileTree'
import type {
  DeletedDocumentHistoryEntry,
  DocumentHistoryPreview,
  DocumentHistoryVersion
} from './documentHistory'

export interface Workspace {
  readonly filePath?: string
  readonly name: string
  readonly openedFilePath?: string
  readonly rootPath: string
  readonly tree: readonly TreeNode[]
  readonly type?: 'file' | 'workspace'
}

export interface WorkspaceFileLaunchResource {
  readonly filePath: string
  readonly type: 'workspace-file'
  readonly workspaceRoot: string
}

export type WorkspaceLaunchResource = string | WorkspaceFileLaunchResource

export interface FileContents {
  readonly path: string
  readonly contents: string
}

export interface RenamedEntry {
  readonly path: string
}

export interface ImageAssetInput {
  readonly contents: ArrayBuffer | Uint8Array
  readonly fileName: string
  readonly markdownFilePath: string
  readonly mimeType: string
}

export interface ImageAsset {
  readonly fileUrl: string
  readonly markdownPath: string
}

export interface WorkspaceSearchMatch {
  readonly columnNumber: number
  readonly kind: 'body' | 'metadata'
  readonly lineNumber: number
  readonly preview: string
}

export interface WorkspaceSearchFileResult {
  readonly matches: readonly WorkspaceSearchMatch[]
  readonly path: string
}

export interface WorkspaceSearchResult {
  readonly limited: boolean
  readonly query: string
  readonly results: readonly WorkspaceSearchFileResult[]
}

export interface EditorApi {
  readonly consumeLaunchPath: () => Promise<WorkspaceLaunchResource | null>
  readonly onLaunchPath: (
    callback: (resourcePath: WorkspaceLaunchResource) => void
  ) => () => void
  readonly openFile: () => Promise<Workspace | null>
  readonly openFileByPath: (filePath: string) => Promise<Workspace>
  readonly openFileInNewWindow?: () => Promise<boolean>
  readonly openExternalLink?: (url: string) => Promise<void>
  readonly openPath: (resourcePath: string) => Promise<Workspace>
  readonly openPathInNewWindow?: (resourcePath: string) => Promise<void>
  readonly openWorkspaceFileInNewWindow?: (
    workspaceRoot: string,
    filePath: string
  ) => Promise<void>
  readonly openWorkspace: () => Promise<Workspace | null>
  readonly openWorkspaceByPath: (workspaceRoot: string) => Promise<Workspace>
  readonly openWorkspaceInNewWindow?: () => Promise<boolean>
  readonly listDirectory: (directoryPath: string) => Promise<readonly TreeNode[]>
  readonly readMarkdownFile: (
    filePath: string,
    workspaceRoot: string
  ) => Promise<FileContents>
  readonly listDocumentHistory?: (
    filePath: string,
    workspaceRoot: string
  ) => Promise<readonly DocumentHistoryVersion[]>
  readonly listDeletedDocumentHistory?: (
    workspaceRoot: string
  ) => Promise<readonly DeletedDocumentHistoryEntry[]>
  readonly readDocumentHistoryVersion?: (
    versionId: string,
    workspaceRoot: string
  ) => Promise<DocumentHistoryPreview>
  readonly restoreDocumentHistoryVersion?: (
    versionId: string,
    workspaceRoot: string
  ) => Promise<FileContents>
  readonly restoreDeletedDocumentHistoryVersion?: (
    versionId: string,
    workspaceRoot: string
  ) => Promise<FileContents>
  readonly searchWorkspaceMarkdown?: (
    query: string,
    workspaceRoot: string
  ) => Promise<WorkspaceSearchResult>
  readonly writeMarkdownFile: (
    filePath: string,
    contents: string,
    workspaceRoot: string
  ) => Promise<FileContents>
  readonly saveImageAsset: (
    markdownFilePath: string,
    fileName: string,
    mimeType: string,
    contents: ArrayBuffer,
    workspaceRoot: string
  ) => Promise<ImageAsset>
  readonly createMarkdownFile: (
    filePath: string,
    workspaceRoot: string
  ) => Promise<FileContents>
  readonly createFolder: (folderPath: string, workspaceRoot: string) => Promise<void>
  readonly renameEntry: (
    oldPath: string,
    newPath: string,
    workspaceRoot: string
  ) => Promise<RenamedEntry>
  readonly deleteEntry: (entryPath: string, workspaceRoot: string) => Promise<void>
}
