import type { MarkdownAssetReference } from './types'

const markdownImagePattern = /!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g

const isExternalUrl = (target: string): boolean => {
  try {
    const url = new URL(target)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isHostDisplayUrl = (target: string): boolean => {
  try {
    const url = new URL(target)

    return url.protocol !== 'http:' && url.protocol !== 'https:'
  } catch {
    return false
  }
}

export const classifyMarkdownAssetReference = (
  rawTarget: string
): MarkdownAssetReference['kind'] => {
  if (isExternalUrl(rawTarget)) {
    return 'external-url'
  }

  return isHostDisplayUrl(rawTarget)
    ? 'host-display-url'
    : 'portable-markdown-path'
}

export const collectMarkdownAssetReferences = (
  markdown: string
): readonly MarkdownAssetReference[] => {
  const references: MarkdownAssetReference[] = []
  let match: RegExpExecArray | null

  markdownImagePattern.lastIndex = 0
  while ((match = markdownImagePattern.exec(markdown)) !== null) {
    const rawTarget = match[2]

    references.push(
      Object.freeze({
        altText: match[1],
        kind: classifyMarkdownAssetReference(rawTarget),
        rawTarget
      })
    )
  }

  return Object.freeze(references)
}

export type MarkdownAssetTargetResolver = (
  reference: MarkdownAssetReference
) => string | null

export interface MarkdownAssetResolver {
  readonly toEditorUrl: MarkdownAssetTargetResolver
  readonly toStoragePath: MarkdownAssetTargetResolver
}

export const rewriteMarkdownImageTargets = (
  markdown: string,
  resolveTarget: MarkdownAssetTargetResolver
): string =>
  markdown.replace(
    markdownImagePattern,
    (match, altText: string, rawTarget: string, suffix: string) => {
      const nextTarget = resolveTarget({
        altText,
        kind: classifyMarkdownAssetReference(rawTarget),
        rawTarget
      })

      return nextTarget === null
        ? match
        : `![${altText}](${nextTarget}${suffix})`
    }
  )
