import type { MarkdownAssetResolver } from '../../../../../../packages/editor-core/src/assets'
import type { MarkdownAssetReference } from '../../../../../../packages/editor-core/src/types'

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

const isDesktopPortableAssetPath = (reference: MarkdownAssetReference): boolean =>
  reference.kind === 'portable-markdown-path' &&
  reference.rawTarget.startsWith('.mde/assets/')

export const createDesktopMarkdownAssetResolver = (
  context: MarkdownAssetContext
): MarkdownAssetResolver => ({
  toEditorUrl: (reference) =>
    isDesktopPortableAssetPath(reference)
      ? encodeFilePath(getAssetAbsolutePath(context, reference.rawTarget))
      : null,
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

    return relativePath.startsWith('.mde/assets/') ? relativePath : null
  }
})
