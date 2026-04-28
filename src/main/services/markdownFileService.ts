import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { dirname, extname, join, relative, sep } from 'node:path'

import type { FileContents, RenamedEntry } from '../../shared/workspace'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

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

const isMarkdownPath = (filePath: string): boolean =>
  extname(filePath).toLowerCase() === '.md'

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

const assertNoSymlinkPathComponents = async (
  workspacePath: string,
  targetPath: string,
  options: { readonly allowMissing: boolean }
): Promise<string> => {
  assertNonEmptyWorkspacePath(targetPath)

  const realWorkspacePath = await realpath(workspacePath)
  const absoluteTargetPath = resolveWorkspacePath(realWorkspacePath, targetPath)
  const relativeTargetPath = relative(realWorkspacePath, absoluteTargetPath)
  const pathSegments =
    relativeTargetPath === ''
      ? []
      : relativeTargetPath.split(sep).filter((segment) => segment.length > 0)
  let currentPath = realWorkspacePath

  for (const segment of pathSegments) {
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
  assertNonEmptyWorkspacePath(filePath)

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

export const createMarkdownFileService = (): MarkdownFileService => ({
  async readMarkdownFile(workspacePath, filePath) {
    const realFilePath = await resolveExistingMarkdownFile(workspacePath, filePath)

    return Object.freeze({
      contents: await readFile(realFilePath, 'utf8'),
      path: filePath
    })
  },
  async writeMarkdownFile(workspacePath, filePath, contents) {
    const absoluteFilePath = await resolveMutableMarkdownFile(workspacePath, filePath)

    await writeFile(absoluteFilePath, contents, 'utf8')

    return Object.freeze({
      contents,
      path: filePath
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

    const absoluteOldPath = await assertNoSymlinkPathComponents(
      workspacePath,
      oldPath,
      { allowMissing: false }
    )
    const oldStats = await stat(absoluteOldPath)

    if (oldStats.isFile() && !isMarkdownPath(newPath)) {
      throw new Error('Only Markdown files can be renamed')
    }

    const absoluteNewPath = await prepareMutableNewPath(workspacePath, newPath)

    await assertPathDoesNotExist(absoluteNewPath)
    await rename(absoluteOldPath, absoluteNewPath)

    return Object.freeze({
      path: newPath
    })
  },
  async deleteEntry(workspacePath, entryPath) {
    assertNonEmptyWorkspacePath(entryPath)

    const absoluteEntryPath = await assertNoSymlinkPathComponents(
      workspacePath,
      entryPath,
      { allowMissing: false }
    )

    await rm(absoluteEntryPath, {
      force: false,
      recursive: true
    })
  }
})
