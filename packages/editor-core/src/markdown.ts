import { splitMarkdownFrontmatter } from './frontmatter'
import { collectMarkdownAssetReferences } from './assets'
import { extractMermaidBlocks } from './flowcharts'
import { collectMarkdownLinkReferences } from './links'
import type {
  MarkdownSemanticDocument,
  MarkdownSourceDocument
} from './types'

export const parseMarkdownSourceDocument = (
  markdown: string
): MarkdownSourceDocument =>
  Object.freeze({
    ...splitMarkdownFrontmatter(markdown),
    rawMarkdown: markdown
  })

export const parseMarkdownSemanticDocument = (
  markdown: string,
  options: { readonly currentFilePath?: string } = {}
): MarkdownSemanticDocument => {
  const source = parseMarkdownSourceDocument(markdown)
  const currentFilePath = options.currentFilePath ?? ''

  return Object.freeze({
    assetReferences: collectMarkdownAssetReferences(source.body),
    linkReferences: collectMarkdownLinkReferences(source.body, {
      currentFilePath
    }),
    mermaidBlocks: extractMermaidBlocks(source.body),
    source
  })
}
