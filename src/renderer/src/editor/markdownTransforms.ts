export interface MarkdownBlockEditorAdapter<Blocks> {
  readonly tryParseMarkdownToBlocks: (markdown: string) => Blocks | Promise<Blocks>
  readonly blocksToMarkdownLossy: (blocks?: Blocks) => string | Promise<string>
}

export const importMarkdownToBlocks = async <Blocks>(
  editor: MarkdownBlockEditorAdapter<Blocks>,
  markdown: string
): Promise<Blocks> => editor.tryParseMarkdownToBlocks(markdown)

export const exportBlocksToMarkdown = async <Blocks>(
  editor: MarkdownBlockEditorAdapter<Blocks>,
  blocks?: Blocks
): Promise<string> => editor.blocksToMarkdownLossy(blocks)
