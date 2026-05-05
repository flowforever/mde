import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const editorCoreRoot = join(process.cwd(), 'packages/editor-core/src')
const forbiddenPatterns = [
  /from ['"]react['"]/u,
  /from ['"]@blocknote\//u,
  /\bdocument\b/u,
  /\bwindow\b/u,
  /\bHTMLElement\b/u,
  /\bRange\b/u,
  /electron/iu,
  /vscode/iu,
  /chrome\.runtime/u,
  /appLanguage/u,
  /COMPONENT_IDS/u,
  /\.mde\/assets/u,
  /file:\/\//u
]

const readTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        return readTypeScriptFiles(path)
      }

      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
    })
  )

  return nestedFiles.flat()
}

describe('shared editor core boundary', () => {
  it('does not import renderer, DOM, BlockNote, Electron, i18n, or desktop asset policy', async () => {
    const files = await readTypeScriptFiles(editorCoreRoot)

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const contents = await readFile(file, 'utf8')

      for (const pattern of forbiddenPatterns) {
        expect({
          file,
          pattern: String(pattern),
          passes: !pattern.test(contents)
        }).toMatchObject({ passes: true })
      }
    }
  })
})
