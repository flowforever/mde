import type { MarkdownAssetResolver } from '@mde/editor-core/assets'
import type { MarkdownAssetReference } from '@mde/editor-core/types'
import { normalizeDesktopMarkdownAssetPath } from '../../../shared/markdownAssets'

export interface MarkdownAssetContext {
  readonly markdownFilePath: string
  readonly workspaceRoot: string
}

const normalizeWorkspacePath = (value: string): string =>
  value.replaceAll('\\', '/').replace(/\/+$/g, '')

const encodeFilePath = (absolutePath: string): string => {
  const normalizedPath = normalizeWorkspacePath(absolutePath)
  const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/')

  return normalizedPath.startsWith('/') ? `file://${encodedPath}` : `file:///${encodedPath}`
}

const decodeFileUrlPath = (fileUrl: string): string | null => {
  try {
    const parsedUrl = new URL(fileUrl)

    if (parsedUrl.protocol !== 'file:') {
      return null
    }

    return decodeURIComponent(parsedUrl.pathname)
  } catch {
    return null
  }
}

const getParentWorkspacePath = (filePath: string): string => {
  const normalizedPath = filePath.replaceAll('\\', '/')
  const separatorIndex = normalizedPath.lastIndexOf('/')

  return separatorIndex === -1 ? '' : normalizedPath.slice(0, separatorIndex)
}

const joinWorkspacePath = (...segments: readonly string[]): string =>
  segments
    .filter((segment) => segment.length > 0)
    .join('/')
    .replaceAll(/\/+/g, '/')

const getMarkdownDirectoryAbsolutePath = ({
  markdownFilePath,
  workspaceRoot
}: MarkdownAssetContext): string =>
  joinWorkspacePath(normalizeWorkspacePath(workspaceRoot), getParentWorkspacePath(markdownFilePath))

const getAssetAbsolutePath = (
  context: MarkdownAssetContext,
  relativeAssetPath: string
): string =>
  joinWorkspacePath(getMarkdownDirectoryAbsolutePath(context), relativeAssetPath)

const getDesktopPortableAssetPath = (
  reference: MarkdownAssetReference
): string | null => {
  if (reference.kind !== 'portable-markdown-path') {
    return null
  }

  return normalizeDesktopMarkdownAssetPath(reference.rawTarget)?.markdownPath ?? null
}

export const createDesktopMarkdownAssetResolver = (
  context: MarkdownAssetContext
): MarkdownAssetResolver => ({
  toEditorUrl: (reference) => {
    const assetPath = getDesktopPortableAssetPath(reference)

    return assetPath
      ? encodeFilePath(getAssetAbsolutePath(context, assetPath))
      : null
  },
  toStoragePath: (reference) => {
    if (reference.kind !== 'host-display-url') {
      return null
    }

    const filePath = decodeFileUrlPath(reference.rawTarget)

    if (!filePath) {
      return null
    }

    const normalizedFilePath = normalizeWorkspacePath(filePath)
    const pathPrefix = `${getMarkdownDirectoryAbsolutePath(context)}/`

    if (!normalizedFilePath.startsWith(pathPrefix)) {
      return null
    }

    const relativePath = normalizedFilePath.slice(pathPrefix.length)

    return normalizeDesktopMarkdownAssetPath(relativePath)?.markdownPath ?? null
  }
})
