export interface MarkdownSaveCandidate {
  readonly currentMarkdown: string
  readonly lastSerializedEditorMarkdown: string | null
  readonly latestDraftMarkdown: string
  readonly serializedMarkdown: string
}

export const chooseMarkdownContentsToSave = ({
  currentMarkdown,
  lastSerializedEditorMarkdown,
  latestDraftMarkdown,
  serializedMarkdown
}: MarkdownSaveCandidate): string => {
  const shouldPreserveNonEmptyDraft =
    serializedMarkdown.trim().length === 0 &&
    latestDraftMarkdown.trim().length > 0 &&
    currentMarkdown.trim().length > 0 &&
    lastSerializedEditorMarkdown === latestDraftMarkdown

  return shouldPreserveNonEmptyDraft ||
    (serializedMarkdown === currentMarkdown &&
      latestDraftMarkdown !== currentMarkdown)
    ? latestDraftMarkdown
    : serializedMarkdown
}

export const shouldRetryUnchangedSave = ({
  contentsToSave,
  currentMarkdown,
  preserveLocalChangesWhenUnchanged,
  retryUnchangedCount
}: {
  readonly contentsToSave: string
  readonly currentMarkdown: string
  readonly preserveLocalChangesWhenUnchanged?: boolean
  readonly retryUnchangedCount?: number
}): boolean =>
  contentsToSave === currentMarkdown &&
  preserveLocalChangesWhenUnchanged === true &&
  (retryUnchangedCount ?? 0) > 0

export const shouldClearLocalChangesAfterUnchangedSave = ({
  preserveLocalChangesWhenUnchanged
}: {
  readonly preserveLocalChangesWhenUnchanged?: boolean
}): boolean => preserveLocalChangesWhenUnchanged !== true
