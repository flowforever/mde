import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const desktopEditorRoot = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor'
)

const readTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        return readTypeScriptFiles(path)
      }

      return entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : []
    })
  )

  return nestedFiles.flat()
}

describe('editor-host file tree contract', () => {
  it('keeps editor modules on the host package file tree type instead of the desktop shared shim', async () => {
    const files = await readTypeScriptFiles(desktopEditorRoot)
    const desktopFileTreeConsumers: string[] = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      if (/from ['"][^'"]*shared\/fileTree['"]/u.test(contents)) {
        desktopFileTreeConsumers.push(relative(process.cwd(), file))
      }
    }

    expect(desktopFileTreeConsumers).toEqual([])
  })
})
