interface EditorDocumentBlock {
  readonly id: string
}

interface EditorHydrationTransaction {
  readonly setMeta: (key: string, value: unknown) => unknown
}

export interface EditorHydrationAdapter<Block> {
  readonly document: readonly EditorDocumentBlock[]
  readonly replaceBlocks: (
    blocksToRemove: string[],
    blocksToInsert: Block[]
  ) => unknown
  readonly transact: (
    callback: (transaction: EditorHydrationTransaction) => unknown
  ) => unknown
}

export const shouldImportMarkdownIntoEditor = ({
  hasLocalChanges,
  lastSerializedEditorMarkdown,
  markdown
}: {
  readonly hasLocalChanges: boolean
  readonly lastSerializedEditorMarkdown: string | null
  readonly markdown: string
}): boolean => {
  if (hasLocalChanges) {
    return false
  }

  return lastSerializedEditorMarkdown !== markdown
}

export const replaceEditorDocumentWithoutUndoHistory = <Block>(
  editor: EditorHydrationAdapter<Block>,
  blocks: Block[]
): void => {
  editor.transact((transaction) => {
    transaction.setMeta('addToHistory', false)
    editor.replaceBlocks(
      editor.document.map((block) => block.id),
      blocks
    )
  })
}
