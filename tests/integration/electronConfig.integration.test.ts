import { basename, normalize, sep } from 'node:path'
import { readFile } from 'node:fs/promises'

import { describe, expect, it, vi } from 'vitest'

import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  STARTUP_DIAGNOSTICS_GLOBAL_KEY,
  configureRuntimeIdentity,
  createPreloadPath,
  createWindowOptions
} from '../../src/main/index'

describe('Electron window config', () => {
  it('uses MDE-prefixed runtime diagnostics names', () => {
    expect(CAPTURE_STARTUP_DIAGNOSTICS_ENV).toBe(
      'MDE_CAPTURE_STARTUP_DIAGNOSTICS'
    )
    expect(DISABLE_SINGLE_INSTANCE_ENV).toBe('MDE_DISABLE_SINGLE_INSTANCE')
    expect(E2E_USER_DATA_PATH_ENV).toBe('MDE_E2E_USER_DATA_PATH')
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

  it('separates development identity from the packaged MDE app', () => {
    const app = {
      getPath: vi.fn(() => '/Users/test/Library/Application Support/MDE'),
      isPackaged: false,
      setName: vi.fn(),
      setPath: vi.fn()
    }

    configureRuntimeIdentity(app)

    expect(app.setName).toHaveBeenCalledWith('MDE Dev')
    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      '/Users/test/Library/Application Support/MDE Dev'
    )
  })

  it('uses an isolated development user data path for each E2E launch', () => {
    const previousE2eUserDataPath = process.env[E2E_USER_DATA_PATH_ENV]

    process.env[E2E_USER_DATA_PATH_ENV] = '/tmp/mde-e2e-user-data'

    try {
      const app = {
        getPath: vi.fn(() => '/Users/test/Library/Application Support/MDE'),
        isPackaged: false,
        setName: vi.fn(),
        setPath: vi.fn()
      }

      configureRuntimeIdentity(app)

      expect(app.setName).toHaveBeenCalledWith('MDE Dev')
      expect(app.setPath).toHaveBeenCalledWith(
        'userData',
        '/tmp/mde-e2e-user-data'
      )
    } finally {
      if (previousE2eUserDataPath === undefined) {
        delete process.env[E2E_USER_DATA_PATH_ENV]
      } else {
        process.env[E2E_USER_DATA_PATH_ENV] = previousE2eUserDataPath
      }
    }
  })

  it('keeps packaged release identity unchanged', () => {
    const app = {
      getPath: vi.fn(() => '/Users/test/Library/Application Support/MDE'),
      isPackaged: true,
      setName: vi.fn(),
      setPath: vi.fn()
    }

    configureRuntimeIdentity(app)

    expect(app.setName).not.toHaveBeenCalled()
    expect(app.setPath).not.toHaveBeenCalled()
  })
})

describe('Release automation config', () => {
  it('publishes electron-builder artifacts to the GitHub releases feed', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      build?: {
        artifactName?: string
        linux?: unknown
        mac?: {
          entitlements?: string
          entitlementsInherit?: string
          hardenedRuntime?: boolean
          notarize?: boolean
        }
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
    expect(packageJson.scripts?.['release:github']).toBe(
      'npm run release:github:mac'
    )
    expect(packageJson.scripts?.['release:github:mac']).toContain(
      '--publish always'
    )
    expect(packageJson.scripts?.['release:github:mac']).toContain('--x64')
    expect(packageJson.scripts?.['release:github:mac']).toContain('--arm64')
    expect(packageJson.scripts?.['release:github:win']).toContain(
      '--publish always'
    )
    expect(packageJson.scripts?.['release:github:win']).toContain('--win nsis')
    expect(packageJson.scripts?.['dist:win']).toContain('--win nsis')
    expect(packageJson.scripts?.['dist:mac']).toContain('--x64')
    expect(packageJson.scripts?.['dist:mac']).toContain('--arm64')
    expect(packageJson.build?.artifactName).toContain('${arch}')
    expect(packageJson.build?.mac).toEqual(
      expect.objectContaining({
        entitlements: 'build/entitlements.mac.plist',
        entitlementsInherit: 'build/entitlements.mac.inherit.plist',
        hardenedRuntime: true
      })
    )
    expect(packageJson.build?.mac?.notarize).toBeUndefined()
    expect(packageJson.build?.linux).toBeUndefined()
  })

  it('builds and publishes release artifacts when a version tag is pushed', async () => {
    const workflow = await readFile('.github/workflows/release.yml', 'utf8')

    expect(workflow).toContain('tags:')
    expect(workflow).toContain('v*')
    expect(workflow).toContain('contents: write')
    expect(workflow).toContain('npm ci')
    expect(workflow).toContain('gh release create')
    expect(workflow).toContain(
      'notes_file=".github/release-notes/$GITHUB_REF_NAME.md"'
    )
    expect(workflow).toContain('--notes-file "$notes_file"')
    expect(workflow).toContain('Restore release notes')
    expect(workflow).toContain('git for-each-ref')
    expect(workflow).toContain('gh release edit')
    expect(workflow).toContain('npm run release:github:mac')
    expect(workflow).toContain('npm run release:github:win')
    expect(workflow).toContain(
      'Prepare optional macOS signing and notarization credentials'
    )
    expect(workflow).toContain('Build and publish Windows release')
    expect(workflow).toContain('CSC_LINK')
    expect(workflow).toContain('CSC_KEY_PASSWORD')
    expect(workflow).toContain('APPLE_API_KEY_P8_BASE64')
    expect(workflow).toContain('APPLE_API_KEY=$key_path')
    expect(workflow).toContain('APPLE_API_KEY_ID')
    expect(workflow).toContain('APPLE_API_ISSUER')
    expect(workflow).toContain('CSC_IDENTITY_AUTO_DISCOVERY=false')
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

  it('syncs curated release notes back to existing GitHub releases', async () => {
    const workflow = await readFile(
      '.github/workflows/release-notes-sync.yml',
      'utf8'
    )
    const notes = await readFile('.github/release-notes/v1.1.1.md', 'utf8')

    expect(workflow).toContain('.github/release-notes/*.md')
    expect(workflow).toContain('gh release edit')
    expect(workflow).toContain('--notes-file')
    expect(notes).toContain('Fixed installed release builds')
    expect(notes).toContain('macOS Intel')
  })
})

describe('Renderer security policy', () => {
  it('declares a restrictive content security policy', async () => {
    const html = await readFile('src/renderer/index.html', 'utf8')

    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain("script-src 'self'")
    expect(html).toContain("style-src 'self' 'unsafe-inline'")
    expect(html).toContain("img-src 'self' data: file:")
    expect(html).toContain("object-src 'none'")
  })
})
