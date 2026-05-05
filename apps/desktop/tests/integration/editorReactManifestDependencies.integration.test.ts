import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const editorReactRoot = join(process.cwd(), 'packages/editor-react')
const editorReactSourceRoot = join(editorReactRoot, 'src')
const packageJsonPath = join(editorReactRoot, 'package.json')
const importSpecifierPattern =
  /(?:from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/gu

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

const getPackageName = (specifier: string): string | null => {
  if (specifier.startsWith('.') || specifier.startsWith('node:')) {
    return null
  }

  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')

    return scope && name ? `${scope}/${name}` : specifier
  }

  return specifier.split('/')[0] ?? specifier
}

describe('editor-react package manifest dependencies', () => {
  it('declares every non-relative runtime package imported by editor-react sources', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      readonly dependencies?: Record<string, string>
      readonly peerDependencies?: Record<string, string>
    }
    const declaredPackages = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {})
    ])
    const sourceFiles = await readTypeScriptFiles(editorReactSourceRoot)
    const importedPackages = new Set<string>()

    for (const file of sourceFiles) {
      const contents = await readFile(file, 'utf8')

      for (const match of contents.matchAll(importSpecifierPattern)) {
        const packageName = getPackageName(match[1] ?? match[2] ?? '')

        if (packageName) {
          importedPackages.add(packageName)
        }
      }
    }

    expect([...importedPackages].sort()).toEqual([
      '@blocknote/core',
      '@blocknote/mantine',
      '@blocknote/react',
      '@mde/editor-core',
      '@mde/editor-host',
      'lucide-react',
      'mermaid',
      'react',
      'react-dom',
      'shiki'
    ])
    expect(
      [...importedPackages].filter((packageName) => !declaredPackages.has(packageName))
    ).toEqual([])
  })
})
