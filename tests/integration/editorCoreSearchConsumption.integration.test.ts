import { access, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const desktopSourceRoot = join(process.cwd(), 'apps/desktop/src')
const removedShimPaths = [
  join(process.cwd(), 'apps/desktop/src/shared/search.ts'),
  join(process.cwd(), 'apps/desktop/src/renderer/src/search/editorSearch.ts')
]

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

describe('editor-core search package consumption', () => {
  it('keeps desktop code on the editor-core search package instead of local search shims', async () => {
    const files = await readTypeScriptFiles(desktopSourceRoot)
    const shimConsumers: string[] = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      if (
        /from ['"][^'"]*(?:shared\/search|search\/editorSearch|\.\/editorSearch|\.\.\/search\/editorSearch)['"]/u.test(
          contents
        )
      ) {
        shimConsumers.push(relative(process.cwd(), file))
      }
    }

    const existingShims = (
      await Promise.all(
        removedShimPaths.map(async (shimPath) => ({
          exists: await pathExists(shimPath),
          path: relative(process.cwd(), shimPath)
        }))
      )
    )
      .filter((shimPath) => shimPath.exists)
      .map((shimPath) => shimPath.path)

    expect(shimConsumers).toEqual([])
    expect(existingShims).toEqual([])
  })
})
