export interface MarkdownBlockEditorAdapter<Blocks> {
  readonly tryParseMarkdownToBlocks: (markdown: string) => Blocks | Promise<Blocks>
  readonly blocksToMarkdownLossy: (blocks?: Blocks) => string | Promise<string>
}

interface MarkdownAssetContext {
  readonly markdownFilePath: string
  readonly workspaceRoot: string
}

const localImageAssetPattern =
  /!\[([^\]]*)\]\((\.mde\/assets\/[^)\s]+)([^)]*)\)/g
const fileImageAssetPattern = /!\[([^\]]*)\]\((file:\/\/[^)\s]+)([^)]*)\)/g

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

export const prepareMarkdownForEditor = (
  markdown: string,
  context: MarkdownAssetContext
): string =>
  markdown.replace(
    localImageAssetPattern,
    (_match, altText: string, relativeAssetPath: string, suffix: string) =>
      `![${altText}](${encodeFilePath(
        getAssetAbsolutePath(context, relativeAssetPath)
      )}${suffix})`
  )

export const prepareMarkdownForStorage = (
  markdown: string,
  context: MarkdownAssetContext
): string => {
  const markdownDirectoryPath = getMarkdownDirectoryAbsolutePath(context)

  return markdown.replace(
    fileImageAssetPattern,
    (match, altText: string, fileUrl: string, suffix: string) => {
      const filePath = decodeFileUrlPath(fileUrl)

      if (!filePath) {
        return match
      }

      const normalizedFilePath = normalizeWorkspacePath(filePath)
      const pathPrefix = `${markdownDirectoryPath}/`

      if (!normalizedFilePath.startsWith(pathPrefix)) {
        return match
      }

      const relativePath = normalizedFilePath.slice(pathPrefix.length)

      if (!relativePath.startsWith('.mde/assets/')) {
        return match
      }

      return `![${altText}](${relativePath}${suffix})`
    }
  )
}

export const importMarkdownToBlocks = async <Blocks>(
  editor: MarkdownBlockEditorAdapter<Blocks>,
  markdown: string
): Promise<Blocks> => editor.tryParseMarkdownToBlocks(markdown)

export const exportBlocksToMarkdown = async <Blocks>(
  editor: MarkdownBlockEditorAdapter<Blocks>,
  blocks?: Blocks
): Promise<string> => editor.blocksToMarkdownLossy(blocks)
