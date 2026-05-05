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

describe('editor-react component id contract', () => {
  it('keeps editor components on the package component id contract instead of desktop component ids', async () => {
    const files = await readTypeScriptFiles(desktopEditorRoot)
    const desktopComponentIdConsumers: string[] = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      if (/from ['"][^'"]*componentIds['"]/u.test(contents)) {
        desktopComponentIdConsumers.push(relative(process.cwd(), file))
      }
    }

    const packageIndex = await readFile(
      join(process.cwd(), 'packages/editor-react/src/index.ts'),
      'utf8'
    )

    expect(desktopComponentIdConsumers).toEqual([])
    expect(packageIndex).toContain('EDITOR_COMPONENT_IDS')
  })
})
