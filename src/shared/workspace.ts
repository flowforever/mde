import type { TreeNode } from './fileTree'

export interface Workspace {
  readonly filePath?: string
  readonly name: string
  readonly openedFilePath?: string
  readonly rootPath: string
  readonly tree: readonly TreeNode[]
  readonly type?: 'file' | 'workspace'
}

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
  readonly consumeLaunchPath: () => Promise<string | null>
  readonly onLaunchPath: (callback: (resourcePath: string) => void) => () => void
  readonly openFile: () => Promise<Workspace | null>
  readonly openFileByPath: (filePath: string) => Promise<Workspace>
  readonly openFileInNewWindow?: () => Promise<boolean>
  readonly openPath: (resourcePath: string) => Promise<Workspace>
  readonly openPathInNewWindow?: (resourcePath: string) => Promise<void>
  readonly openWorkspace: () => Promise<Workspace | null>
  readonly openWorkspaceByPath: (workspaceRoot: string) => Promise<Workspace>
  readonly openWorkspaceInNewWindow?: () => Promise<boolean>
  readonly listDirectory: (directoryPath: string) => Promise<readonly TreeNode[]>
  readonly readMarkdownFile: (
    filePath: string,
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
