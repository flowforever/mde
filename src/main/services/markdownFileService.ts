import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'

import type { FileContents } from '../../shared/workspace'
import { resolveWorkspacePath } from './pathSafety'

export interface MarkdownFileService {
  readonly readMarkdownFile: (
    workspacePath: string,
    filePath: string
  ) => Promise<FileContents>
}

const isMarkdownPath = (filePath: string): boolean =>
  extname(filePath).toLowerCase() === '.md'

export const createMarkdownFileService = (): MarkdownFileService => ({
  async readMarkdownFile(workspacePath, filePath) {
    const absoluteFilePath = resolveWorkspacePath(workspacePath, filePath)

    if (!isMarkdownPath(filePath)) {
      throw new Error('Only Markdown files can be opened')
    }

    const fileStats = await stat(absoluteFilePath)

    if (!fileStats.isFile()) {
      throw new Error('Markdown path must be a file')
    }

    return Object.freeze({
      contents: await readFile(absoluteFilePath, 'utf8'),
      path: filePath
    })
  }
})
