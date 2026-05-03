import { randomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { dirname, extname, join, posix, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  FileContents,
  ImageAsset,
  ImageAssetInput,
  RenamedEntry,
  WorkspaceSearchResult
} from '../../shared/workspace'
import {
  findTextSearchMatches,
  normalizeSearchQuery
} from '../../shared/search'
import { splitMarkdownFrontmatter } from '../../shared/frontmatter'
import {
  createDocumentHistoryService,
  type DocumentHistoryService
} from './documentHistoryService'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

const ignoredEntryNames = new Set([
  '.DS_Store',
  '.git',
  'dist',
  'node_modules',
  'out',
  'release'
])

export interface MarkdownFileService {
  readonly readMarkdownFile: (
    workspacePath: string,
    filePath: string
  ) => Promise<FileContents>
  readonly writeMarkdownFile: (
    workspacePath: string,
    filePath: string,
    contents: string
  ) => Promise<FileContents>
  readonly saveImageAsset: (
    workspacePath: string,
    asset: ImageAssetInput
  ) => Promise<ImageAsset>
  readonly searchMarkdownFiles: (
    workspacePath: string,
    query: string
  ) => Promise<WorkspaceSearchResult>
  readonly createMarkdownFile: (
    workspacePath: string,
    filePath: string,
    contents?: string
  ) => Promise<FileContents>
  readonly createFolder: (workspacePath: string, folderPath: string) => Promise<void>
  readonly renameEntry: (
    workspacePath: string,
    oldPath: string,
    newPath: string
  ) => Promise<RenamedEntry>
  readonly deleteEntry: (workspacePath: string, entryPath: string) => Promise<void>
}

interface MarkdownFileServiceOptions {
  readonly documentHistoryService?: DocumentHistoryService
  readonly moveEntryToTrash?: (entryPath: string) => Promise<void>
}

const MAX_SEARCH_FILE_RESULTS = 50
const MAX_SEARCH_MATCHES_PER_FILE = 3
const LOCAL_IMAGE_ASSET_PATTERN =
  /!\[[^\]]*\]\((\.mde\/assets\/[^)\s]+)(?:[^)]*)\)/g
const LOCAL_IMAGE_ASSET_PREFIX = '.mde/assets/'

const isMarkdownPath = (filePath: string): boolean =>
  extname(filePath).toLowerCase() === '.md'

const supportedImageMimeTypes = new Map([
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
])

const supportedImageExtensions = new Set(supportedImageMimeTypes.values())

const isErrorWithCode = (
  error: unknown,
  code: string
): error is NodeJS.ErrnoException =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === code

const assertNonEmptyWorkspacePath = (entryPath: string): void => {
  if (entryPath.trim().length === 0 || entryPath === '.') {
    throw new Error('Workspace path is required')
  }
}

const assertMarkdownPath = (filePath: string): void => {
  assertNonEmptyWorkspacePath(filePath)

  if (!isMarkdownPath(filePath)) {
    throw new Error('Only Markdown files can be opened')
  }
}

const assertPathDoesNotExist = async (targetPath: string): Promise<void> => {
  try {
    await lstat(targetPath)
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return
    }

    throw error
  }

  throw new Error('Path already exists')
}

const assertSupportedEntryName = (entryName: string): void => {
  if (ignoredEntryNames.has(entryName)) {
    throw new Error('Unsupported workspace entry')
  }
}

const assertSupportedWorkspacePath = (entryPath: string): void => {
  assertNonEmptyWorkspacePath(entryPath)
  entryPath
    .split(/[\\/]/)
    .filter((segment) => segment.length > 0)
    .forEach(assertSupportedEntryName)
}

const assertSupportedMarkdownFileStats = (
  fileStats: Awaited<ReturnType<typeof stat>>
): void => {
  if (!fileStats.isFile()) {
    throw new Error('Markdown path must be a file')
  }

  if (fileStats.nlink > 1) {
    throw new Error('Hard-linked Markdown files are unsupported')
  }
}

const getSupportedImageExtension = ({
  fileName,
  mimeType
}: Pick<ImageAssetInput, 'fileName' | 'mimeType'>): string => {
  const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim()

  if (normalizedMimeType.length > 0 && !normalizedMimeType.startsWith('image/')) {
    throw new Error('Only image clipboard content can be saved')
  }

  const mimeExtension = supportedImageMimeTypes.get(normalizedMimeType)

  if (mimeExtension) {
    return mimeExtension
  }

  const fileExtension = extname(fileName).toLowerCase()

  if (supportedImageExtensions.has(fileExtension)) {
    return fileExtension
  }

  throw new Error('Unsupported image type')
}

const toBuffer = (contents: ImageAssetInput['contents']): Buffer =>
  contents instanceof Uint8Array
    ? Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength)
    : Buffer.from(contents)

const createImageAssetFileName = (fileExtension: string): string =>
  `image-${Date.now()}-${randomUUID().slice(0, 8)}${fileExtension}`

const getParentWorkspacePath = (filePath: string): string => {
  const normalizedPath = filePath.replaceAll('\\', '/')
  const separatorIndex = normalizedPath.lastIndexOf('/')

  return separatorIndex === -1 ? '' : normalizedPath.slice(0, separatorIndex)
}

const joinWorkspacePath = (...segments: readonly string[]): string =>
  segments
    .filter((segment) => segment.length > 0)
    .join('/')

const isSupportedImageAssetPath = (entryPath: string): boolean =>
  supportedImageExtensions.has(extname(entryPath).toLowerCase())

const normalizeAssetStoragePath = (relativeAssetPath: string): string | null => {
  if (!relativeAssetPath.startsWith(LOCAL_IMAGE_ASSET_PREFIX)) {
    return null
  }

  const assetStoragePath = relativeAssetPath
    .slice(LOCAL_IMAGE_ASSET_PREFIX.length)
    .replaceAll('\\', '/')
  const pathSegments = assetStoragePath
    .split('/')
    .filter((segment) => segment.length > 0)

  if (
    pathSegments.length === 0 ||
    pathSegments.length !== assetStoragePath.split('/').length ||
    pathSegments.some((segment) => segment === '.' || segment === '..') ||
    !isSupportedImageAssetPath(assetStoragePath)
  ) {
    return null
  }

  return pathSegments.join('/')
}

const collectLocalImageAssetStoragePaths = (
  contents: string
): readonly string[] => {
  const assetStoragePaths = new Set<string>()

  for (const match of contents.matchAll(LOCAL_IMAGE_ASSET_PATTERN)) {
    const assetStoragePath = normalizeAssetStoragePath(match[1])

    if (assetStoragePath) {
      assetStoragePaths.add(assetStoragePath)
    }
  }

  return Array.from(assetStoragePaths)
}

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await lstat(targetPath)
    return true
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return false
    }

    return true
  }
}

const collectAssetCandidates = async (
  workspacePath: string,
  assetStoragePaths: readonly string[]
): Promise<ReadonlyMap<string, readonly string[]>> => {
  const candidatesByAssetPath = new Map(
    assetStoragePaths.map((assetStoragePath) => [assetStoragePath, [] as string[]])
  )

  const collectFromMdeDirectory = async (mdeDirectoryPath: string): Promise<void> => {
    const mdeStats = await lstat(mdeDirectoryPath).catch(() => null)

    if (!mdeStats || mdeStats.isSymbolicLink() || !mdeStats.isDirectory()) {
      return
    }

    await Promise.all(
      assetStoragePaths.map(async (assetStoragePath) => {
        const candidatePath = join(
          mdeDirectoryPath,
          'assets',
          ...assetStoragePath.split('/')
        )
        const candidateStats = await lstat(candidatePath).catch(() => null)

        if (
          candidateStats?.isFile() &&
          !candidateStats.isSymbolicLink() &&
          isSupportedImageAssetPath(candidatePath)
        ) {
          candidatesByAssetPath.get(assetStoragePath)?.push(candidatePath)
        }
      })
    )
  }

  const visitDirectory = async (directoryPath: string): Promise<void> => {
    const entries = await readdir(directoryPath, { withFileTypes: true }).catch(
      () => []
    )

    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(directoryPath, entry.name)

        if (entry.name === '.mde') {
          await collectFromMdeDirectory(entryPath)
          return
        }

        if (ignoredEntryNames.has(entry.name) || !entry.isDirectory()) {
          return
        }

        if (entry.isSymbolicLink()) {
          return
        }

        await visitDirectory(entryPath)
      })
    )
  }

  await visitDirectory(workspacePath)

  return candidatesByAssetPath
}

const repairMissingImageAssets = async (
  workspacePath: string,
  filePath: string,
  contents: string
): Promise<number> => {
  const assetStoragePaths = collectLocalImageAssetStoragePaths(contents)

  if (assetStoragePaths.length === 0) {
    return 0
  }

  const markdownDirectoryPath = getParentWorkspacePath(filePath)
  const missingAssetTargets: {
    readonly assetStoragePath: string
    readonly workspaceAssetPath: string
  }[] = []

  for (const assetStoragePath of assetStoragePaths) {
    const workspaceAssetPath = joinWorkspacePath(
      markdownDirectoryPath,
      LOCAL_IMAGE_ASSET_PREFIX,
      assetStoragePath
    )
    const absoluteAssetPath = resolveWorkspacePath(workspacePath, workspaceAssetPath)

    if (!(await pathExists(absoluteAssetPath))) {
      missingAssetTargets.push({
        assetStoragePath,
        workspaceAssetPath
      })
    }
  }

  if (missingAssetTargets.length === 0) {
    return 0
  }

  const candidatesByAssetPath = await collectAssetCandidates(
    workspacePath,
    Array.from(
      new Set(
        missingAssetTargets.map(({ assetStoragePath }) => assetStoragePath)
      )
    )
  )
  let repairedCount = 0

  for (const { assetStoragePath, workspaceAssetPath } of missingAssetTargets) {
    const candidates = candidatesByAssetPath.get(assetStoragePath) ?? []

    if (candidates.length !== 1) {
      continue
    }

    try {
      const absoluteTargetPath = await prepareMutableNewPath(
        workspacePath,
        workspaceAssetPath
      )

      await copyFile(candidates[0], absoluteTargetPath, fsConstants.COPYFILE_EXCL)
      repairedCount += 1
    } catch (error) {
      if (!isErrorWithCode(error, 'EEXIST')) {
        continue
      }
    }
  }

  return repairedCount
}

const createSearchPreview = (
  contents: string,
  match: ReturnType<typeof findTextSearchMatches>[number]
): string => {
  const lineStartIndex = contents.lastIndexOf('\n', match.startOffset - 1) + 1
  const nextLineBreakIndex = contents.indexOf('\n', match.startOffset)
  const lineEndIndex =
    nextLineBreakIndex === -1 ? contents.length : nextLineBreakIndex

  return contents.slice(lineStartIndex, lineEndIndex).trim()
}

const compareWorkspacePaths = (leftPath: string, rightPath: string): number => {
  const leftDepth = leftPath.split('/').length
  const rightDepth = rightPath.split('/').length

  return leftDepth - rightDepth || leftPath.localeCompare(rightPath)
}

const assertNoSymlinkPathComponents = async (
  workspacePath: string,
  targetPath: string,
  options: { readonly allowMissing: boolean }
): Promise<string> => {
  assertSupportedWorkspacePath(targetPath)

  const realWorkspacePath = await realpath(workspacePath)
  const absoluteTargetPath = resolveWorkspacePath(realWorkspacePath, targetPath)
  const relativeTargetPath = relative(realWorkspacePath, absoluteTargetPath)
  const pathSegments =
    relativeTargetPath === ''
      ? []
      : relativeTargetPath.split(sep).filter((segment) => segment.length > 0)
  let currentPath = realWorkspacePath

  for (const segment of pathSegments) {
    assertSupportedEntryName(segment)
    currentPath = join(currentPath, segment)

    try {
      const linkStats = await lstat(currentPath)

      if (linkStats.isSymbolicLink()) {
        throw new Error('Symlink paths are unsupported for file changes')
      }
    } catch (error) {
      if (isErrorWithCode(error, 'ENOENT') && options.allowMissing) {
        break
      }

      throw error
    }
  }

  return absoluteTargetPath
}

const resolveExistingMarkdownFile = async (
  workspacePath: string,
  filePath: string
): Promise<string> => {
  assertSupportedWorkspacePath(filePath)

  const absoluteFilePath = resolveWorkspacePath(workspacePath, filePath)

  if (!isMarkdownPath(filePath)) {
    throw new Error('Only Markdown files can be opened')
  }

  const realWorkspacePath = await realpath(workspacePath)
  const realFilePath = await realpath(absoluteFilePath)

  assertPathInsideWorkspace(realWorkspacePath, realFilePath)

  if (!isMarkdownPath(realFilePath)) {
    throw new Error('Only Markdown files can be opened')
  }

  const fileStats = await stat(realFilePath)

  assertSupportedMarkdownFileStats(fileStats)

  return realFilePath
}

const resolveMutableMarkdownFile = async (
  workspacePath: string,
  filePath: string
): Promise<string> => {
  assertMarkdownPath(filePath)

  const absoluteFilePath = await assertNoSymlinkPathComponents(
    workspacePath,
    filePath,
    { allowMissing: false }
  )
  const fileStats = await stat(absoluteFilePath)

  assertSupportedMarkdownFileStats(fileStats)

  return absoluteFilePath
}

const assertManageableDirectoryContents = async (
  directoryPath: string
): Promise<void> => {
  const entries = await readdir(directoryPath, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      assertSupportedEntryName(entry.name)

      const entryPath = join(directoryPath, entry.name)
      const entryStats = await lstat(entryPath)

      if (entryStats.isSymbolicLink()) {
        throw new Error('Symlink paths are unsupported for file changes')
      }

      if (entryStats.isDirectory()) {
        await assertManageableDirectoryContents(entryPath)
        return
      }

      if (
        entryStats.isFile() &&
        (isMarkdownPath(entry.name) || isSupportedImageAssetPath(entry.name))
      ) {
        assertSupportedMarkdownFileStats(await stat(entryPath))
        return
      }

      throw new Error('Unsupported workspace entry')
    })
  )
}

interface MutableEntry {
  readonly absolutePath: string
  readonly type: 'directory' | 'file'
}

const resolveMutableEntry = async (
  workspacePath: string,
  entryPath: string
): Promise<MutableEntry> => {
  const absoluteEntryPath = await assertNoSymlinkPathComponents(
    workspacePath,
    entryPath,
    { allowMissing: false }
  )
  const entryStats = await lstat(absoluteEntryPath)

  if (entryStats.isSymbolicLink()) {
    throw new Error('Symlink paths are unsupported for file changes')
  }

  if (entryStats.isFile()) {
    assertMarkdownPath(entryPath)
    assertSupportedMarkdownFileStats(await stat(absoluteEntryPath))

    return {
      absolutePath: absoluteEntryPath,
      type: 'file'
    }
  }

  if (entryStats.isDirectory()) {
    await assertManageableDirectoryContents(absoluteEntryPath)

    return {
      absolutePath: absoluteEntryPath,
      type: 'directory'
    }
  }

  throw new Error('Unsupported workspace entry')
}

const isPathAtOrInside = (entryPath: string, targetPath: string): boolean =>
  targetPath === entryPath || targetPath.startsWith(`${entryPath}/`)

const replacePathPrefix = (
  targetPath: string,
  oldPath: string,
  newPath: string
): string =>
  targetPath === oldPath
    ? newPath
    : `${newPath}/${targetPath.slice(oldPath.length + 1)}`

const collectMarkdownEntryPaths = async (
  entry: MutableEntry,
  workspaceEntryPath: string
): Promise<readonly string[]> => {
  if (entry.type === 'file') {
    return [workspaceEntryPath]
  }

  const collectDirectory = async (
    absoluteDirectoryPath: string,
    directoryPath: string
  ): Promise<readonly string[]> => {
    const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true })
    const nestedPaths = await Promise.all(
      entries.map(async (childEntry): Promise<readonly string[]> => {
        const childWorkspacePath = joinWorkspacePath(directoryPath, childEntry.name)
        const childAbsolutePath = join(absoluteDirectoryPath, childEntry.name)

        if (childEntry.isDirectory()) {
          return collectDirectory(childAbsolutePath, childWorkspacePath)
        }

        return childEntry.isFile() && isMarkdownPath(childEntry.name)
          ? [childWorkspacePath]
          : []
      })
    )

    return nestedPaths.flat()
  }

  return collectDirectory(entry.absolutePath, workspaceEntryPath)
}

const prepareMutableNewPath = async (
  workspacePath: string,
  targetPath: string
): Promise<string> => {
  const absoluteTargetPath = await assertNoSymlinkPathComponents(
    workspacePath,
    targetPath,
    { allowMissing: true }
  )
  const absoluteParentPath = dirname(absoluteTargetPath)

  await mkdir(absoluteParentPath, { recursive: true })
  await assertNoSymlinkPathComponents(workspacePath, targetPath, {
    allowMissing: true
  })

  return absoluteTargetPath
}

export const createMarkdownFileService = ({
  documentHistoryService = createDocumentHistoryService(),
  moveEntryToTrash = async (entryPath) => {
    await rm(entryPath, {
      force: false,
      recursive: true
    })
  }
}: MarkdownFileServiceOptions = {}): MarkdownFileService => ({
  async readMarkdownFile(workspacePath, filePath) {
    const realFilePath = await resolveExistingMarkdownFile(workspacePath, filePath)
    const contents = await readFile(realFilePath, 'utf8')
    const repairedImageAssetCount = await repairMissingImageAssets(
      workspacePath,
      filePath,
      contents
    )

    return Object.freeze({
      contents,
      path: filePath,
      ...(repairedImageAssetCount > 0 ? { repairedImageAssetCount } : {})
    })
  },
  async searchMarkdownFiles(workspacePath, query) {
    const normalizedQuery = normalizeSearchQuery(query)

    if (normalizedQuery.length === 0) {
      return Object.freeze({
        limited: false,
        query: normalizedQuery,
        results: []
      })
    }

    const collectMarkdownPaths = async (
      directoryPath: string
    ): Promise<readonly string[]> => {
      const absoluteDirectoryPath = resolveWorkspacePath(workspacePath, directoryPath)
      const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true })
      const nestedPaths = await Promise.all(
        entries.map(async (entry): Promise<readonly string[]> => {
          if (ignoredEntryNames.has(entry.name) || entry.name === '.mde') {
            return []
          }

          const entryPath = joinWorkspacePath(directoryPath, entry.name)

          if (entry.isDirectory()) {
            return collectMarkdownPaths(entryPath)
          }

          if (entry.isFile() && isMarkdownPath(entry.name)) {
            return [entryPath]
          }

          return []
        })
      )

      return nestedPaths.flat()
    }

    const results: WorkspaceSearchResult['results'][number][] = []
    const markdownPaths = Array.from(await collectMarkdownPaths('')).sort(
      compareWorkspacePaths
    )
    let limited = false

    for (const markdownPath of markdownPaths) {
      if (results.length >= MAX_SEARCH_FILE_RESULTS) {
        limited = true
        break
      }

      const realFilePath = await resolveExistingMarkdownFile(
        workspacePath,
        markdownPath
      )
      const contents = await readFile(realFilePath, 'utf8')
      const parsedMarkdown = splitMarkdownFrontmatter(contents)
      const matches = findTextSearchMatches(contents, normalizedQuery)

      if (matches.length === 0) {
        continue
      }

      results.push({
        matches: matches.slice(0, MAX_SEARCH_MATCHES_PER_FILE).map((match) => ({
          columnNumber: match.columnNumber,
          kind:
            parsedMarkdown.frontmatter &&
            match.startOffset < parsedMarkdown.bodyStartOffset
              ? 'metadata'
              : 'body',
          lineNumber: match.lineNumber,
          preview: createSearchPreview(contents, match)
        })),
        path: markdownPath
      })
    }

    return Object.freeze({
      limited,
      query: normalizedQuery,
      results: Object.freeze(results)
    })
  },
  async writeMarkdownFile(workspacePath, filePath, contents) {
    const absoluteFilePath = await resolveMutableMarkdownFile(workspacePath, filePath)

    await documentHistoryService.captureSnapshot({
      event: 'manual-save',
      filePath,
      workspacePath
    })
    await writeFile(absoluteFilePath, contents, 'utf8')

    return Object.freeze({
      contents,
      path: filePath
    })
  },
  async saveImageAsset(workspacePath, asset) {
    const absoluteMarkdownFilePath = await resolveMutableMarkdownFile(
      workspacePath,
      asset.markdownFilePath
    )
    const fileExtension = getSupportedImageExtension(asset)
    const assetFileName = createImageAssetFileName(fileExtension)
    const markdownPath = posix.join('.mde', 'assets', assetFileName)
    const markdownDirectoryPath = getParentWorkspacePath(asset.markdownFilePath)
    const workspaceAssetPath = joinWorkspacePath(
      markdownDirectoryPath,
      markdownPath
    )
    const absoluteAssetPath = await prepareMutableNewPath(
      workspacePath,
      workspaceAssetPath
    )

    assertPathInsideWorkspace(dirname(absoluteMarkdownFilePath), absoluteAssetPath)
    await assertPathDoesNotExist(absoluteAssetPath)
    await writeFile(absoluteAssetPath, toBuffer(asset.contents), {
      flag: 'wx'
    })

    return Object.freeze({
      fileUrl: pathToFileURL(absoluteAssetPath).href,
      markdownPath
    })
  },
  async createMarkdownFile(workspacePath, filePath, contents = '') {
    assertMarkdownPath(filePath)

    const absoluteFilePath = await prepareMutableNewPath(workspacePath, filePath)

    await assertPathDoesNotExist(absoluteFilePath)
    await writeFile(absoluteFilePath, contents, {
      encoding: 'utf8',
      flag: 'wx'
    })

    return Object.freeze({
      contents,
      path: filePath
    })
  },
  async createFolder(workspacePath, folderPath) {
    const absoluteFolderPath = await prepareMutableNewPath(workspacePath, folderPath)

    await assertPathDoesNotExist(absoluteFolderPath)
    await mkdir(absoluteFolderPath, { recursive: true })
    await assertNoSymlinkPathComponents(workspacePath, folderPath, {
      allowMissing: false
    })
  },
  async renameEntry(workspacePath, oldPath, newPath) {
    assertNonEmptyWorkspacePath(oldPath)
    assertNonEmptyWorkspacePath(newPath)

    const oldEntry = await resolveMutableEntry(workspacePath, oldPath)

    if (oldEntry.type === 'file') {
      assertMarkdownPath(newPath)
    }

    const absoluteNewPath = await prepareMutableNewPath(workspacePath, newPath)

    await assertPathDoesNotExist(absoluteNewPath)
    await Promise.all(
      (
        await collectMarkdownEntryPaths(oldEntry, oldPath)
      ).map((markdownPath) =>
        documentHistoryService.captureSnapshot({
          event: 'rename',
          filePath: markdownPath,
          nextPath: isPathAtOrInside(oldPath, markdownPath)
            ? replacePathPrefix(markdownPath, oldPath, newPath)
            : newPath,
          workspacePath
        })
      )
    )
    await rename(oldEntry.absolutePath, absoluteNewPath)

    return Object.freeze({
      path: newPath
    })
  },
  async deleteEntry(workspacePath, entryPath) {
    assertNonEmptyWorkspacePath(entryPath)

    const entry = await resolveMutableEntry(workspacePath, entryPath)

    await Promise.all(
      (
        await collectMarkdownEntryPaths(entry, entryPath)
      ).map((markdownPath) =>
        documentHistoryService.captureSnapshot({
          event: 'delete',
          filePath: markdownPath,
          workspacePath
        })
      )
    )
    await moveEntryToTrash(entry.absolutePath)
  }
})
