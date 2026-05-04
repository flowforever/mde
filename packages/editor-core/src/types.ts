import type {
  MarkdownFrontmatterBlock,
  ParsedMarkdownFrontmatter
} from './frontmatter'

export interface MarkdownSourceDocument extends ParsedMarkdownFrontmatter {
  readonly rawMarkdown: string
}

export interface MermaidBlockReference {
  readonly index: number
  readonly source: string
}

export type MarkdownAssetReferenceKind =
  | 'portable-markdown-path'
  | 'external-url'
  | 'host-display-url'

export interface MarkdownAssetReference {
  readonly altText: string
  readonly kind: MarkdownAssetReferenceKind
  readonly rawTarget: string
}

export type EditorLinkTarget =
  | { readonly kind: 'external-url'; readonly url: string }
  | { readonly kind: 'workspace-markdown'; readonly path: string }
  | { readonly kind: 'host-local-resource'; readonly href: string }
  | { readonly anchor: string; readonly kind: 'anchor' }
  | { readonly kind: 'unsupported'; readonly reason: string }

export interface MarkdownLinkReference {
  readonly href: string
  readonly target: EditorLinkTarget
}

export interface MarkdownSemanticDocument {
  readonly source: MarkdownSourceDocument
  readonly mermaidBlocks: readonly MermaidBlockReference[]
  readonly assetReferences: readonly MarkdownAssetReference[]
  readonly linkReferences: readonly MarkdownLinkReference[]
}

export type { MarkdownFrontmatterBlock }
