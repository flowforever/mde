import { access, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const desktopEditorRoot = join(process.cwd(), 'apps/desktop/src/renderer/src/editor')
const removedShimPath = join(desktopEditorRoot, 'flowchartMarkdown.ts')

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

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-core flowcharts package consumption', () => {
  it('keeps desktop editor code on the editor-core flowcharts package instead of the local shim', async () => {
    const files = await readTypeScriptFiles(desktopEditorRoot)
    const shimConsumers: string[] = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      if (/from ['"]\.\/flowchartMarkdown['"]/u.test(contents)) {
        shimConsumers.push(relative(process.cwd(), file))
      }
    }

    expect(shimConsumers).toEqual([])
    expect(await pathExists(removedShimPath)).toBe(false)
  })
})
