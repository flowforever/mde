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

export interface EditorApi {
  readonly consumeLaunchPath: () => Promise<string | null>
  readonly onLaunchPath: (callback: (resourcePath: string) => void) => () => void
  readonly openFile: () => Promise<Workspace | null>
  readonly openFileByPath: (filePath: string) => Promise<Workspace>
  readonly openPath: (resourcePath: string) => Promise<Workspace>
  readonly openWorkspace: () => Promise<Workspace | null>
  readonly openWorkspaceByPath: (workspaceRoot: string) => Promise<Workspace>
  readonly listDirectory: (directoryPath: string) => Promise<readonly TreeNode[]>
  readonly readMarkdownFile: (
    filePath: string,
    workspaceRoot: string
  ) => Promise<FileContents>
  readonly writeMarkdownFile: (
    filePath: string,
    contents: string,
    workspaceRoot: string
  ) => Promise<FileContents>
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
