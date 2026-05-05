export type TreeNodeType = 'directory' | 'file'

export interface BaseTreeNode {
  readonly name: string
  readonly path: string
  readonly type: TreeNodeType
}

export interface DirectoryTreeNode extends BaseTreeNode {
  readonly type: 'directory'
  readonly children: readonly TreeNode[]
  readonly isDefaultHidden?: boolean
}

export interface FileTreeNode extends BaseTreeNode {
  readonly type: 'file'
}

export type TreeNode = DirectoryTreeNode | FileTreeNode
