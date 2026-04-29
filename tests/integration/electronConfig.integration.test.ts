import { basename, normalize, sep } from 'node:path'
import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  STARTUP_DIAGNOSTICS_GLOBAL_KEY,
  createPreloadPath,
  createWindowOptions
} from '../../src/main/index'

describe('Electron window config', () => {
  it('uses MDE-prefixed runtime diagnostics names', () => {
    expect(CAPTURE_STARTUP_DIAGNOSTICS_ENV).toBe(
      'MDE_CAPTURE_STARTUP_DIAGNOSTICS'
    )
    expect(DISABLE_SINGLE_INSTANCE_ENV).toBe('MDE_DISABLE_SINGLE_INSTANCE')
    expect(STARTUP_DIAGNOSTICS_GLOBAL_KEY).toBe('__mdeStartupDiagnostics')
  })

  it('keeps renderer isolated from Node.js', () => {
    const options = createWindowOptions('/tmp/preload.js')

    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
    expect(options.webPreferences?.preload).toBe('/tmp/preload.js')
    expect(options.webPreferences?.sandbox).toBe(true)
  })

  it('points at the electron-vite preload bundle emitted by build', () => {
    const preloadPath = normalize(createPreloadPath('/app/out/main'))
    const pathSegments = preloadPath.split(sep)

    expect(basename(preloadPath)).toBe('index.mjs')
    expect(pathSegments).toContain('out')
    expect(pathSegments).toContain('preload')
    expect(pathSegments).not.toContain('main')
  })
})

describe('Release automation config', () => {
  it('publishes electron-builder artifacts to the GitHub releases feed', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      build?: {
        artifactName?: string
        publish?: {
          owner?: string
          provider?: string
          releaseType?: string
          repo?: string
        }[]
      }
      scripts?: Record<string, string>
    }

    expect(packageJson.build?.publish).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: 'flowforever',
          provider: 'github',
          releaseType: 'release',
          repo: 'mde'
        })
      ])
    )
    expect(packageJson.scripts?.['release:github']).toContain('--publish always')
    expect(packageJson.scripts?.['release:github']).toContain('--x64')
    expect(packageJson.scripts?.['release:github']).toContain('--arm64')
    expect(packageJson.scripts?.['dist:mac']).toContain('--x64')
    expect(packageJson.scripts?.['dist:mac']).toContain('--arm64')
    expect(packageJson.build?.artifactName).toContain('${arch}')
  })

  it('builds and publishes release artifacts when a version tag is pushed', async () => {
    const workflow = await readFile('.github/workflows/release.yml', 'utf8')

    expect(workflow).toContain('tags:')
    expect(workflow).toContain('v*')
    expect(workflow).toContain('contents: write')
    expect(workflow).toContain('npm ci')
    expect(workflow).toContain('gh release create')
    expect(workflow).toContain('--generate-notes')
    expect(workflow).toContain('npm run release:github')
  })

  it('configures generated release notes with user-facing categories', async () => {
    const releaseNotesConfig = await readFile('.github/release.yml', 'utf8')

    expect(releaseNotesConfig).toContain('changelog:')
    expect(releaseNotesConfig).toContain('Breaking Changes')
    expect(releaseNotesConfig).toContain('Features')
    expect(releaseNotesConfig).toContain('Bug Fixes')
    expect(releaseNotesConfig).toContain('Maintenance')
    expect(releaseNotesConfig).toContain('"*"')
  })
})

describe('Renderer security policy', () => {
  it('declares a restrictive content security policy', async () => {
    const html = await readFile('src/renderer/index.html', 'utf8')

    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain("script-src 'self'")
    expect(html).toContain("style-src 'self' 'unsafe-inline'")
    expect(html).toContain("object-src 'none'")
  })
})
