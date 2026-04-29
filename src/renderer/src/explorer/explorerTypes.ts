import type { TreeNode } from '../../../shared/fileTree'

export interface ExplorerContextMenuRequest {
  readonly clientX: number
  readonly clientY: number
  readonly entry: TreeNode
}

export interface ExplorerTreeProps {
  readonly selectedEntryPath: string | null
  readonly selectedFilePath: string | null
  readonly onOpenEntryMenu?: (request: ExplorerContextMenuRequest) => void
  readonly onSelectEntry: (entryPath: string) => void
  readonly onSelectFile: (filePath: string) => void
}
