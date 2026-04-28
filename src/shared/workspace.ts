import type { TreeNode } from './fileTree'

export interface Workspace {
  readonly name: string
  readonly rootPath: string
  readonly tree: readonly TreeNode[]
}

export interface FileContents {
  readonly path: string
  readonly contents: string
}

export interface RenamedEntry {
  readonly path: string
}

export interface EditorApi {
  readonly openWorkspace: () => Promise<Workspace | null>
  readonly listDirectory: (directoryPath: string) => Promise<readonly TreeNode[]>
  readonly readMarkdownFile: (filePath: string) => Promise<FileContents>
  readonly writeMarkdownFile: (
    filePath: string,
    contents: string
  ) => Promise<FileContents>
  readonly createMarkdownFile: (filePath: string) => Promise<FileContents>
  readonly createFolder: (folderPath: string) => Promise<void>
  readonly renameEntry: (oldPath: string, newPath: string) => Promise<RenamedEntry>
  readonly deleteEntry: (entryPath: string) => Promise<void>
}
