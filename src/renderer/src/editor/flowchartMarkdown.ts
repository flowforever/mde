export interface MermaidBlock {
  readonly index: number
  readonly source: string
}

const mermaidFencePattern =
  /(^|\n)(`{3,}|~{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)\n\2[ \t]*(?=\n|$)/gi

export const extractMermaidBlocks = (markdown: string): readonly MermaidBlock[] => {
  const blocks: MermaidBlock[] = []
  let match: RegExpExecArray | null

  mermaidFencePattern.lastIndex = 0
  while ((match = mermaidFencePattern.exec(markdown)) !== null) {
    blocks.push({
      index: blocks.length,
      source: match[3]
    })
  }

  return Object.freeze(blocks)
}

export const replaceMermaidBlockSource = (
  markdown: string,
  blockIndex: number,
  source: string
): string => {
  let currentBlockIndex = 0

  mermaidFencePattern.lastIndex = 0

  return markdown.replace(
    mermaidFencePattern,
    (match, linePrefix: string, fence: string) => {
      if (currentBlockIndex !== blockIndex) {
        currentBlockIndex += 1
        return match
      }

      currentBlockIndex += 1

      return `${linePrefix}${fence}mermaid\n${source}\n${fence}`
    }
  )
}

export const replaceMermaidBlocksFromSource = (
  targetMarkdown: string,
  sourceMarkdown: string
): string => {
  const sourceBlocks = extractMermaidBlocks(sourceMarkdown)

  return sourceBlocks.reduce(
    (currentMarkdown, block) =>
      replaceMermaidBlockSource(currentMarkdown, block.index, block.source),
    targetMarkdown
  )
}
