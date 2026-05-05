import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const desktopSourceRoot = join(process.cwd(), 'apps/desktop/src')
const forbiddenSharedSourceImports =
  /(?:from|import)\s*(?:type\s*)?['"][^'"]*packages\/editor-(?:core|host)\/src/u

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

describe('desktop package consumption', () => {
  it('uses public shared editor package specifiers instead of package source paths', async () => {
    const files = await readTypeScriptFiles(desktopSourceRoot)
    const directSourceConsumers: string[] = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      if (forbiddenSharedSourceImports.test(contents)) {
        directSourceConsumers.push(relative(process.cwd(), file))
      }
    }

    expect(directSourceConsumers).toEqual([])
  })
})
