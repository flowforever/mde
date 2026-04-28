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

export interface EditorApi {
  readonly openWorkspace: () => Promise<Workspace | null>
  readonly listDirectory: (directoryPath: string) => Promise<readonly TreeNode[]>
  readonly readMarkdownFile: (filePath: string) => Promise<FileContents>
}
