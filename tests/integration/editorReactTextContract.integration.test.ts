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

describe('editor-react text contract', () => {
  it('keeps editor components on the package text contract instead of desktop i18n types', async () => {
    const files = await readTypeScriptFiles(desktopEditorRoot)
    const desktopI18nConsumers: string[] = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      if (/from ['"][^'"]*i18n\/appLanguage['"]/u.test(contents)) {
        desktopI18nConsumers.push(relative(process.cwd(), file))
      }
    }

    const packageIndex = await readFile(
      join(process.cwd(), 'packages/editor-react/src/index.ts'),
      'utf8'
    )

    expect(desktopI18nConsumers).toEqual([])
    expect(packageIndex).toContain('EditorText')
  })
})
