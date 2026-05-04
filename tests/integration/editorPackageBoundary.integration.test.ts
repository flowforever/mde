import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const editorReactSourceRoot = join(process.cwd(), 'packages/editor-react/src')
const editorHostSourceRoot = join(process.cwd(), 'packages/editor-host/src')

const editorReactForbiddenPatterns = [
  /from\s+['"]electron['"]/iu,
  /\b(?:contextBridge|ipcMain|ipcRenderer)\b/u,
  /\bwindow\.editorApi\b/u,
  /from\s+['"]node:/u,
  /from\s+['"](?:fs|path|child_process|os|crypto|url)(?:\/promises)?['"]/u,
  /\bvscode\b/iu,
  /\b(?:chrome|browser)\.runtime\b/u,
  /\b(?:WORKSPACE|FILE|AI)_CHANNELS\b/u,
  /apps\/desktop/u,
  /\.mde\/assets/u,
  /file:\/\//u
] as const

const editorHostForbiddenPatterns = [
  /from\s+['"]react(?:\/[^'"]*)?['"]/u,
  /from\s+['"]@blocknote\//u,
  /\b(?:HTMLElement|Range|MutationObserver)\b/u,
  /\bdocument\.(?:addEventListener|body|create|documentElement|getElement|head|query|removeEventListener)\b/u,
  /\b(?:window|localStorage|navigator)\s*\./u,
  /\bglobalThis\.(?:document|window|localStorage|navigator)\b/u,
  /from\s+['"]electron['"]/iu,
  /\b(?:contextBridge|ipcMain|ipcRenderer)\b/u,
  /from\s+['"]node:/u,
  /from\s+['"](?:fs|path|child_process|os|crypto|url)(?:\/promises)?['"]/u,
  /\bvscode\b/iu,
  /\b(?:chrome|browser)\.runtime\b/u,
  /apps\/desktop/u,
  /\.mde\/assets/u,
  /file:\/\//u
] as const

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

const findViolations = async (
  files: readonly string[],
  patterns: readonly RegExp[]
): Promise<readonly string[]> => {
  const violations: string[] = []

  for (const file of files) {
    const contents = await readFile(file, 'utf8')

    for (const pattern of patterns) {
      if (pattern.test(contents)) {
        violations.push(`${relative(process.cwd(), file)} matches ${String(pattern)}`)
      }
    }
  }

  return violations
}

describe('shared editor package boundaries', () => {
  it('keeps editor-react free of direct desktop and extension host APIs', async () => {
    const files = await readTypeScriptFiles(editorReactSourceRoot)

    expect(files.length).toBeGreaterThan(0)
    await expect(findViolations(files, editorReactForbiddenPatterns)).resolves.toEqual([])
  })

  it('keeps editor-host free of React editor UI and platform host implementations', async () => {
    const files = await readTypeScriptFiles(editorHostSourceRoot)

    expect(files.length).toBeGreaterThan(0)
    await expect(findViolations(files, editorHostForbiddenPatterns)).resolves.toEqual([])
  })
})
