import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'

import { normalizeAutomationExecutorId } from '@mde/automation-flow'

export interface DiscoveredMarkdownExecutorFile {
  readonly content: string
  readonly executorId: string
  readonly fingerprint: string
  readonly path: string
}

const fingerprintMarkdown = (markdown: string): string =>
  createHash('sha256').update(markdown).digest('hex')

export const listMarkdownExecutorFiles = async (input: {
  readonly flowDefinitionPath: string
  readonly flowId: string
}): Promise<readonly DiscoveredMarkdownExecutorFile[]> => {
  const executorRoot = resolve(dirname(input.flowDefinitionPath), input.flowId)

  try {
    const entries = await readdir(executorRoot, { withFileTypes: true })
    const markdownFiles = entries
      .filter(
        (entry) =>
          entry.isFile() && extname(entry.name).toLowerCase() === '.md'
      )
      .map((entry) => join(executorRoot, entry.name))
      .sort()
    const executors = await Promise.all(
      markdownFiles.map(async (path) => {
        const markdown = await readFile(path, 'utf8')
        const extension = extname(path)

        return Object.freeze({
          content: markdown,
          executorId: normalizeAutomationExecutorId(basename(path, extension)),
          fingerprint: fingerprintMarkdown(markdown),
          path
        })
      })
    )

    return Object.freeze(executors)
  } catch {
    return Object.freeze([])
  }
}
