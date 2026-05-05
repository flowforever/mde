import { access, readdir, readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T

const pathExists = async (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false)

const readDirectoryEntries = async (path: string): Promise<readonly string[]> =>
  readdir(path).catch(() => [])

interface PackageManifest {
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly scripts?: Record<string, string>
}

describe('monorepo package ownership', () => {
  it('keeps root package scripts as workspace orchestration entries', async () => {
    const packageJson = await readJson<PackageManifest>('package.json')

    expect(packageJson.scripts?.build).toBe('pnpm --filter @mde/desktop build')
    expect(packageJson.scripts?.dev).toBe('pnpm --filter @mde/desktop dev')
    expect(packageJson.scripts?.start).toBe('pnpm --filter @mde/desktop start')
    expect(Object.values(packageJson.scripts ?? {}).join('\n')).not.toMatch(
      /\belectron-vite\b|\belectron-builder\b|\bnpm link\b/u
    )
  })

  it('moves desktop runtime ownership into the desktop workspace package', async () => {
    const rootPackageJson = await readJson<PackageManifest>('package.json')
    const desktopPackageJson = await readJson<PackageManifest>(
      'apps/desktop/package.json'
    )

    expect(Object.keys(rootPackageJson.dependencies ?? {}).sort()).toEqual([])
    expect(desktopPackageJson.dependencies?.['@mde/editor-core']).toBe(
      'workspace:*'
    )
    expect(desktopPackageJson.dependencies?.['@mde/editor-host']).toBe(
      'workspace:*'
    )
    expect(desktopPackageJson.dependencies?.['@mde/editor-react']).toBe(
      'workspace:*'
    )
    expect(typeof desktopPackageJson.dependencies?.['electron-updater']).toBe(
      'string'
    )
    expect(typeof desktopPackageJson.dependencies?.react).toBe('string')
    expect(typeof desktopPackageJson.dependencies?.['react-dom']).toBe('string')
  })

  it('gives each shared editor package local verification scripts', async () => {
    const packagePaths = [
      'packages/editor-core/package.json',
      'packages/editor-host/package.json',
      'packages/editor-react/package.json'
    ]

    for (const packagePath of packagePaths) {
      const packageJson = await readJson<PackageManifest>(packagePath)

      expect(typeof packageJson.scripts?.build).toBe('string')
      expect(typeof packageJson.scripts?.lint).toBe('string')
      expect(typeof packageJson.scripts?.test).toBe('string')
      expect(typeof packageJson.scripts?.typecheck).toBe('string')
    }
  })

  it('uses pnpm-lock.yaml as the only committed package manager lockfile', async () => {
    await expect(pathExists('pnpm-lock.yaml')).resolves.toBe(true)
    await expect(pathExists('package-lock.json')).resolves.toBe(false)
  })

  it('keeps desktop-specific config under apps/desktop', async () => {
    const electronViteConfig = await readFile(
      'apps/desktop/electron.vite.config.ts',
      'utf8'
    )
    const playwrightConfig = await readFile(
      'apps/desktop/playwright.config.ts',
      'utf8'
    )

    await expect(pathExists('apps/desktop/electron.vite.config.ts')).resolves.toBe(
      true
    )
    await expect(pathExists('apps/desktop/playwright.config.ts')).resolves.toBe(
      true
    )
    await expect(pathExists('apps/desktop/vitest.config.ts')).resolves.toBe(true)
    await expect(pathExists('electron.vite.config.ts')).resolves.toBe(false)
    expect(playwrightConfig).toContain("testDir: './tests/e2e'")
    expect(playwrightConfig).not.toContain("testDir: 'apps/desktop/tests/e2e'")
    expect(electronViteConfig).toContain('internalWorkspacePackages')
    expect(electronViteConfig).toContain("'@mde/editor-core'")
    expect(electronViteConfig).toContain(
      'externalizeDepsPlugin({ exclude: internalWorkspacePackages })'
    )
  })

  it('keeps root tests limited to shared fixtures and ambient types', async () => {
    await expect(readDirectoryEntries('tests')).resolves.toEqual([
      'fixtures',
      'types'
    ])
  })

  it('documents pnpm workspace and monorepo ownership in AGENTS.md', async () => {
    const instructions = await readFile('AGENTS.md', 'utf8')

    expect(instructions).toContain('apps/desktop')
    expect(instructions).toContain('packages/editor-core')
    expect(instructions).toContain('packages/editor-host')
    expect(instructions).toContain('packages/editor-react')
    expect(instructions).toContain('pnpm run lint')
    expect(instructions).toContain('pnpm-lock.yaml')
    expect(instructions).toContain('apps/desktop/src/renderer/src/componentIds.ts')
    expect(instructions).not.toContain('* `npm run lint`')
    expect(instructions).not.toContain(
      'Update both `package.json` and `package-lock.json`'
    )
    expect(instructions).not.toContain(
      'Maintain component names and ids through `src/renderer'
    )
  })
})
