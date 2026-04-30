import type { TreeNode } from '../../../shared/fileTree'

export interface ExplorerContextMenuRequest {
  readonly clientX: number
  readonly clientY: number
  readonly entry: TreeNode
}

export type ExplorerInlineEditorType = 'create-file' | 'create-folder' | 'rename'

export interface ExplorerInlineEditor {
  readonly targetDirectoryPath: string | null
  readonly targetEntryPath: string | null
  readonly type: ExplorerInlineEditorType
  readonly value: string
}

export interface ExplorerTreeProps {
  readonly expandedDirectoryPaths?: ReadonlySet<string>
  readonly inlineEditor?: ExplorerInlineEditor | null
  readonly locateFilePath?: string | null
  readonly locateFileRequestId?: number
  readonly selectedEntryPath: string | null
  readonly selectedFilePath: string | null
  readonly onDirectoryExpandedChange?: (
    directoryPath: string,
    isExpanded: boolean
  ) => void
  readonly onInlineEditorCancel?: () => void
  readonly onInlineEditorChange?: (value: string) => void
  readonly onInlineEditorSubmit?: () => void
  readonly onOpenEntryMenu?: (request: ExplorerContextMenuRequest) => void
  readonly onSelectEntry: (entryPath: string | null) => void
  readonly onSelectFile: (filePath: string) => void
}
