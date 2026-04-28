export interface ExplorerTreeProps {
  readonly selectedFilePath: string | null
  readonly onSelectFile: (filePath: string) => void
}
