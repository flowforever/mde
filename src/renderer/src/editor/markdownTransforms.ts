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
export const MARKDOWN_BLANK_LINE_MARKER = '\u200b'

const isBlankLine = (line: string): boolean => line.trim().length === 0

const isBlankLineMarker = (line: string): boolean =>
  line.trim() === MARKDOWN_BLANK_LINE_MARKER

const isFenceBoundary = (line: string): boolean =>
  /^ {0,3}(```|~~~)/.test(line)

const replaceBlankLineRunsOutsideFences = (
  markdown: string,
  replaceRun: (lines: readonly string[]) => readonly string[]
): string => {
  const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n'
  const lines = markdown.split(/\r?\n/)
  const nextLines: string[] = []
  let isInFence = false
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (isFenceBoundary(line)) {
      isInFence = !isInFence
      nextLines.push(line)
      index += 1
      continue
    }

    if (isInFence || !isBlankLine(line)) {
      nextLines.push(line)
      index += 1
      continue
    }

    const run: string[] = []

    while (index < lines.length && isBlankLine(lines[index])) {
      run.push(lines[index])
      index += 1
    }

    nextLines.push(...replaceRun(run))
  }

  return nextLines.join(lineEnding)
}

const restoreBlankLineMarkersOutsideFences = (markdown: string): string => {
  const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n'
  const lines = markdown.split(/\r?\n/)
  const nextLines: string[] = []
  let isInFence = false
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (isFenceBoundary(line)) {
      isInFence = !isInFence
      nextLines.push(line)
      index += 1
      continue
    }

    if (isInFence || (!isBlankLine(line) && !isBlankLineMarker(line))) {
      nextLines.push(line)
      index += 1
      continue
    }

    const run: string[] = []

    while (
      index < lines.length &&
      (isBlankLine(lines[index]) || isBlankLineMarker(lines[index]))
    ) {
      run.push(lines[index])
      index += 1
    }

    const markerCount = run.filter(isBlankLineMarker).length

    nextLines.push(
      ...(markerCount > 0 ? Array.from({ length: markerCount + 1 }, () => '') : run)
    )
  }

  return nextLines.join(lineEnding)
}

const prepareBlankLinesForEditor = (markdown: string): string =>
  replaceBlankLineRunsOutsideFences(markdown, (lines) => {
    if (lines.length <= 1) {
      return lines
    }

    return [
      '',
      ...Array.from({ length: lines.length - 1 }, () => [
        MARKDOWN_BLANK_LINE_MARKER,
        ''
      ]).flat()
    ]
  })

const isEmptyParagraphContent = (content: unknown): boolean =>
  content === undefined ||
  content === '' ||
  (Array.isArray(content) && content.length === 0)

const withBlankLineMarkersForEmptyParagraphs = (blocks: unknown): unknown => {
  if (!Array.isArray(blocks)) {
    return blocks
  }

  const blockItems = blocks as readonly unknown[]
  let changed = false
  const nextBlocks = blockItems.map((block): unknown => {
    if (!block || typeof block !== 'object') {
      return block
    }

    const blockRecord = block as {
      readonly children?: unknown
      readonly content?: unknown
      readonly type?: unknown
    }
    const nextChildren = Array.isArray(blockRecord.children)
      ? withBlankLineMarkersForEmptyParagraphs(blockRecord.children)
      : blockRecord.children
    const childrenChanged = nextChildren !== blockRecord.children
    const shouldMarkAsBlankLine =
      blockRecord.type === 'paragraph' &&
      isEmptyParagraphContent(blockRecord.content)

    if (!childrenChanged && !shouldMarkAsBlankLine) {
      return block
    }

    changed = true

    return {
      ...blockRecord,
      children: nextChildren,
      ...(shouldMarkAsBlankLine
        ? {
            content: [
              {
                styles: {},
                text: MARKDOWN_BLANK_LINE_MARKER,
                type: 'text'
              }
            ]
          }
        : {})
    }
  })

  return changed ? nextBlocks : blocks
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

export const prepareMarkdownForEditor = (
  markdown: string,
  context: MarkdownAssetContext
): string =>
  prepareBlankLinesForEditor(
    markdown.replace(
      localImageAssetPattern,
      (_match, altText: string, relativeAssetPath: string, suffix: string) =>
        `![${altText}](${encodeFilePath(
          getAssetAbsolutePath(context, relativeAssetPath)
        )}${suffix})`
    )
  )

export const prepareMarkdownForStorage = (
  markdown: string,
  context: MarkdownAssetContext
): string => {
  const markdownDirectoryPath = getMarkdownDirectoryAbsolutePath(context)
  const markdownWithRestoredBlankLines =
    restoreBlankLineMarkersOutsideFences(markdown)

  return markdownWithRestoredBlankLines.replace(
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
): Promise<string> =>
  editor.blocksToMarkdownLossy(
    blocks === undefined
      ? blocks
      : (withBlankLineMarkersForEmptyParagraphs(blocks) as Blocks)
  )
