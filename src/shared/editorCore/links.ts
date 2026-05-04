import type { TreeNode } from '../fileTree'
import type { EditorLinkTarget, MarkdownLinkReference } from './types'

const markdownLinkPattern = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:[^)]*)\)/g

export interface MarkdownPathSuggestion {
  readonly path: string
  readonly relativePath: string
}

export const normalizeWorkspacePath = (filePath: string): string =>
  filePath.replace(/\\/g, '/').replace(/^\/+/u, '').replace(/\/+$/u, '')

export const normalizeNativePath = (filePath: string): string =>
  filePath.replace(/\\/g, '/').replace(/\/+$/u, '')

export const getPathWithoutHashOrQuery = (href: string): string => {
  const hashIndex = href.indexOf('#')
  const queryIndex = href.indexOf('?')
  const cutoffIndexes = [hashIndex, queryIndex].filter((index) => index >= 0)
  const cutoffIndex =
    cutoffIndexes.length > 0 ? Math.min(...cutoffIndexes) : href.length

  return href.slice(0, cutoffIndex).trim()
}

export const getParentPath = (filePath: string): string => {
  const normalizedPath = normalizeWorkspacePath(filePath)
  const separatorIndex = normalizedPath.lastIndexOf('/')

  return separatorIndex === -1 ? '' : normalizedPath.slice(0, separatorIndex)
}

export const getFileName = (filePath: string): string => {
  const normalizedPath = normalizeWorkspacePath(filePath)
  const separatorIndex = normalizedPath.lastIndexOf('/')

  return separatorIndex === -1
    ? normalizedPath
    : normalizedPath.slice(separatorIndex + 1)
}

const splitWorkspacePath = (filePath: string): readonly string[] =>
  normalizeWorkspacePath(filePath)
    .split('/')
    .filter((segment) => segment.length > 0)

export const isMarkdownPath = (filePath: string): boolean =>
  getPathWithoutHashOrQuery(filePath).toLocaleLowerCase().endsWith('.md')

export const isHttpUrl = (href: string): boolean => {
  try {
    const url = new URL(href)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const isFileUrl = (href: string): boolean => {
  try {
    return new URL(href).protocol === 'file:'
  } catch {
    return false
  }
}

export const isAbsoluteNativePath = (filePath: string): boolean =>
  filePath.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(filePath)

export const decodeHrefPath = (href: string): string => {
  try {
    return decodeURIComponent(href)
  } catch {
    return href
  }
}

export const normalizeWorkspaceLinkPath = (
  currentFilePath: string,
  href: string
): string | null => {
  const targetPath = decodeHrefPath(getPathWithoutHashOrQuery(href))

  if (
    targetPath.length === 0 ||
    targetPath.startsWith('#') ||
    isAbsoluteNativePath(targetPath)
  ) {
    return null
  }

  const segments = [...splitWorkspacePath(getParentPath(currentFilePath))]

  for (const segment of targetPath.replace(/\\/g, '/').split('/')) {
    if (segment.length === 0 || segment === '.') {
      continue
    }

    if (segment === '..') {
      if (segments.length === 0) {
        return null
      }

      segments.pop()
      continue
    }

    segments.push(segment)
  }

  const normalizedPath = segments.join('/')

  return isMarkdownPath(normalizedPath) ? normalizedPath : null
}

export const collectMarkdownFilePaths = (
  nodes: readonly TreeNode[]
): readonly string[] =>
  nodes.flatMap((node) => {
    if (node.type === 'directory') {
      return collectMarkdownFilePaths(node.children)
    }

    return isMarkdownPath(node.path) ? [node.path] : []
  })

export const createRelativeMarkdownLink = (
  currentFilePath: string,
  targetFilePath: string
): string => {
  const currentDirectorySegments = splitWorkspacePath(
    getParentPath(currentFilePath)
  )
  const targetSegments = splitWorkspacePath(targetFilePath)
  const targetDirectorySegments = targetSegments.slice(0, -1)
  const targetFileName = targetSegments.at(-1) ?? getFileName(targetFilePath)
  let commonSegmentCount = 0

  while (
    commonSegmentCount < currentDirectorySegments.length &&
    commonSegmentCount < targetDirectorySegments.length &&
    currentDirectorySegments[commonSegmentCount] ===
      targetDirectorySegments[commonSegmentCount]
  ) {
    commonSegmentCount += 1
  }

  const parentSegments = currentDirectorySegments
    .slice(commonSegmentCount)
    .map(() => '..')
  const childSegments = targetDirectorySegments.slice(commonSegmentCount)
  const relativeSegments = [...parentSegments, ...childSegments, targetFileName]

  return relativeSegments.join('/')
}

const queryMatchesPath = (query: string, filePath: string): boolean => {
  const queryParts = query
    .trim()
    .toLocaleLowerCase()
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (queryParts.length === 0) {
    return true
  }

  const pathParts = filePath.toLocaleLowerCase().split('/')
  let pathIndex = 0

  for (const queryPart of queryParts) {
    const matchingIndex = pathParts.findIndex(
      (pathPart, index) => index >= pathIndex && pathPart.includes(queryPart)
    )

    if (matchingIndex === -1) {
      return false
    }

    pathIndex = matchingIndex + 1
  }

  return true
}

export const createMarkdownPathSuggestions = (
  query: string,
  paths: readonly string[],
  options: { readonly currentFilePath: string }
): readonly MarkdownPathSuggestion[] =>
  paths
    .filter((filePath) => queryMatchesPath(query, filePath))
    .map((filePath) => ({
      path: filePath,
      relativePath: createRelativeMarkdownLink(
        options.currentFilePath,
        filePath
      )
    }))
    .sort((leftSuggestion, rightSuggestion) => {
      const lowerQuery = query.trim().toLocaleLowerCase()
      const leftName = getFileName(leftSuggestion.path).toLocaleLowerCase()
      const rightName = getFileName(rightSuggestion.path).toLocaleLowerCase()
      const leftStartsWithQuery =
        lowerQuery.length > 0 && leftName.startsWith(lowerQuery)
      const rightStartsWithQuery =
        lowerQuery.length > 0 && rightName.startsWith(lowerQuery)

      if (leftStartsWithQuery !== rightStartsWithQuery) {
        return leftStartsWithQuery ? -1 : 1
      }

      return leftSuggestion.path.localeCompare(rightSuggestion.path, undefined, {
        sensitivity: 'base'
      })
    })
    .slice(0, 20)

export const isDangerousLinkHref = (href: string): boolean =>
  /^javascript:/iu.test(href.trim())

export const isSupportedMarkdownLinkHref = (href: string): boolean => {
  const normalizedHref = href.trim()

  if (normalizedHref.length === 0 || isDangerousLinkHref(normalizedHref)) {
    return false
  }

  return (
    isHttpUrl(normalizedHref) ||
    isFileUrl(normalizedHref) ||
    isMarkdownPath(normalizedHref)
  )
}

export const resolveMarkdownLinkTarget = ({
  currentFilePath,
  href
}: {
  readonly currentFilePath: string
  readonly href: string
}): EditorLinkTarget => {
  const normalizedHref = href.trim()

  if (normalizedHref.length === 0) {
    return { kind: 'unsupported', reason: 'empty' }
  }

  if (isDangerousLinkHref(normalizedHref)) {
    return { kind: 'unsupported', reason: 'dangerous-url' }
  }

  if (normalizedHref.startsWith('#')) {
    return {
      anchor: normalizedHref.slice(1),
      kind: 'anchor'
    }
  }

  if (isHttpUrl(normalizedHref)) {
    return {
      kind: 'external-url',
      url: normalizedHref
    }
  }

  const relativeWorkspacePath = normalizeWorkspaceLinkPath(
    currentFilePath,
    normalizedHref
  )

  if (relativeWorkspacePath) {
    return {
      kind: 'workspace-markdown',
      path: relativeWorkspacePath
    }
  }

  if (isFileUrl(normalizedHref) || isAbsoluteNativePath(normalizedHref)) {
    return {
      href: normalizedHref,
      kind: 'host-local-resource'
    }
  }

  return {
    kind: 'unsupported',
    reason: 'unsupported-target'
  }
}

export const collectMarkdownLinkReferences = (
  markdown: string,
  options: { readonly currentFilePath: string }
): readonly MarkdownLinkReference[] => {
  const references: MarkdownLinkReference[] = []
  let match: RegExpExecArray | null

  markdownLinkPattern.lastIndex = 0
  while ((match = markdownLinkPattern.exec(markdown)) !== null) {
    const href = match[1]

    references.push(
      Object.freeze({
        href,
        target: resolveMarkdownLinkTarget({
          currentFilePath: options.currentFilePath,
          href
        })
      })
    )
  }

  return Object.freeze(references)
}
