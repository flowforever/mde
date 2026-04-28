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
import { dirname, extname } from 'node:path'

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

  if (!fileStats.isFile()) {
    throw new Error('Markdown path must be a file')
  }

  return realFilePath
}

const ensureCreatableParent = async (
  workspacePath: string,
  targetPath: string
): Promise<string> => {
  assertNonEmptyWorkspacePath(targetPath)

  const absoluteTargetPath = resolveWorkspacePath(workspacePath, targetPath)
  const absoluteParentPath = dirname(absoluteTargetPath)
  const realWorkspacePath = await realpath(workspacePath)
  let existingAncestorPath = absoluteParentPath

  while (true) {
    try {
      const realAncestorPath = await realpath(existingAncestorPath)
      const ancestorStats = await stat(realAncestorPath)

      assertPathInsideWorkspace(realWorkspacePath, realAncestorPath)

      if (!ancestorStats.isDirectory()) {
        throw new Error('Parent path must be a directory')
      }

      break
    } catch (error) {
      if (isErrorWithCode(error, 'ENOENT')) {
        const nextAncestorPath = dirname(existingAncestorPath)

        if (nextAncestorPath === existingAncestorPath) {
          throw error
        }

        existingAncestorPath = nextAncestorPath
        continue
      }

      throw error
    }
  }

  await mkdir(absoluteParentPath, { recursive: true })

  const realParentPath = await realpath(absoluteParentPath)

  assertPathInsideWorkspace(realWorkspacePath, realParentPath)

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
    const realFilePath = await resolveExistingMarkdownFile(workspacePath, filePath)

    await writeFile(realFilePath, contents, 'utf8')

    return Object.freeze({
      contents,
      path: filePath
    })
  },
  async createMarkdownFile(workspacePath, filePath, contents = '') {
    assertMarkdownPath(filePath)

    const absoluteFilePath = await ensureCreatableParent(workspacePath, filePath)

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
    const absoluteFolderPath = await ensureCreatableParent(workspacePath, folderPath)

    await assertPathDoesNotExist(absoluteFolderPath)
    await mkdir(absoluteFolderPath, { recursive: true })

    const realWorkspacePath = await realpath(workspacePath)
    const realFolderPath = await realpath(absoluteFolderPath)

    assertPathInsideWorkspace(realWorkspacePath, realFolderPath)
  },
  async renameEntry(workspacePath, oldPath, newPath) {
    assertNonEmptyWorkspacePath(oldPath)
    assertNonEmptyWorkspacePath(newPath)

    const absoluteOldPath = resolveWorkspacePath(workspacePath, oldPath)
    const realWorkspacePath = await realpath(workspacePath)
    const realOldPath = await realpath(absoluteOldPath)

    assertPathInsideWorkspace(realWorkspacePath, realOldPath)

    const oldStats = await stat(realOldPath)

    if (oldStats.isFile() && !isMarkdownPath(newPath)) {
      throw new Error('Only Markdown files can be renamed')
    }

    const absoluteNewPath = await ensureCreatableParent(workspacePath, newPath)

    await assertPathDoesNotExist(absoluteNewPath)
    await rename(absoluteOldPath, absoluteNewPath)

    return Object.freeze({
      path: newPath
    })
  },
  async deleteEntry(workspacePath, entryPath) {
    assertNonEmptyWorkspacePath(entryPath)

    const absoluteEntryPath = resolveWorkspacePath(workspacePath, entryPath)
    const realWorkspacePath = await realpath(workspacePath)
    const realEntryPath = await realpath(absoluteEntryPath)

    assertPathInsideWorkspace(realWorkspacePath, realEntryPath)

    await rm(absoluteEntryPath, {
      force: false,
      recursive: true
    })
  }
})
