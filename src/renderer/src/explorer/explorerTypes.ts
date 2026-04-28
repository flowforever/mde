export interface ExplorerTreeProps {
  readonly selectedEntryPath: string | null
  readonly selectedFilePath: string | null
  readonly onSelectEntry: (entryPath: string) => void
  readonly onSelectFile: (filePath: string) => void
}
