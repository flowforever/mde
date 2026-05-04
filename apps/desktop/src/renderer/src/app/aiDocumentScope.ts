export const createAiDocumentKey = (
  workspaceRoot: string,
  filePath: string,
): string => `${workspaceRoot}\u0000${filePath}`;

export const resolveCurrentAiDocumentKey = ({
  loadedFilePath,
  selectedFilePath,
  workspaceRoot,
}: {
  readonly loadedFilePath?: string | null;
  readonly selectedFilePath?: string | null;
  readonly workspaceRoot?: string | null;
}): string | null => {
  const currentFilePath = loadedFilePath ?? selectedFilePath;

  return workspaceRoot && currentFilePath
    ? createAiDocumentKey(workspaceRoot, currentFilePath)
    : null;
};
