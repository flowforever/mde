import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, normalize, sep } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  E2E_WINDOW_MODE_ENV,
  STARTUP_DIAGNOSTICS_GLOBAL_KEY,
  configureRuntimeIdentity,
  createPreloadPath,
  createMoveEntryToTrash,
  createWindowOptions
} from '../../src/main/index'

describe('Electron window config', () => {
  it('uses MDE-prefixed runtime diagnostics names', () => {
    expect(CAPTURE_STARTUP_DIAGNOSTICS_ENV).toBe(
      'MDE_CAPTURE_STARTUP_DIAGNOSTICS'
    )
    expect(DISABLE_SINGLE_INSTANCE_ENV).toBe('MDE_DISABLE_SINGLE_INSTANCE')
    expect(E2E_USER_DATA_PATH_ENV).toBe('MDE_E2E_USER_DATA_PATH')
    expect(E2E_WINDOW_MODE_ENV).toBe('MDE_E2E_WINDOW_MODE')
    expect(STARTUP_DIAGNOSTICS_GLOBAL_KEY).toBe('__mdeStartupDiagnostics')
  })

  it('keeps renderer isolated from Node.js', () => {
    const options = createWindowOptions('/tmp/preload.js')

    expect(options.show).toBe(false)
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

  it('uses system Trash in production and deterministic removal in E2E', async () => {
    const shell = {
      trashItem: vi.fn().mockResolvedValue(undefined)
    }

    await createMoveEntryToTrash(shell, {})('/workspace/old.md')

    expect(shell.trashItem).toHaveBeenCalledWith('/workspace/old.md')

    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-trash-'))
    const filePath = join(workspacePath, 'old.md')
    const e2eShell = {
      trashItem: vi.fn().mockResolvedValue(undefined)
    }

    try {
      await writeFile(filePath, '# Old')
      await createMoveEntryToTrash(e2eShell, {
        [E2E_USER_DATA_PATH_ENV]: '/tmp/mde-e2e-user-data'
      })(filePath)

      expect(e2eShell.trashItem).not.toHaveBeenCalled()
      await expect(stat(filePath)).rejects.toMatchObject({
        code: 'ENOENT'
      })
    } finally {
      await rm(workspacePath, { force: true, recursive: true })
    }
  })
})

describe('Release automation config', () => {
  const readPngDimensions = (contents: Buffer): {
    readonly height: number
    readonly width: number
  } => {
    expect(contents.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )

    return {
      height: contents.readUInt32BE(20),
      width: contents.readUInt32BE(16)
    }
  }

  const readIcoImageSizes = (contents: Buffer): readonly number[] => {
    expect(contents.readUInt16LE(0)).toBe(0)
    expect(contents.readUInt16LE(2)).toBe(1)

    const imageCount = contents.readUInt16LE(4)
    let directoryOffset = 6
    let sizes: readonly number[] = []

    for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
      const width = contents[directoryOffset] === 0 ? 256 : contents[directoryOffset]
      const height =
        contents[directoryOffset + 1] === 0 ? 256 : contents[directoryOffset + 1]
      const imageByteLength = contents.readUInt32LE(directoryOffset + 8)
      const imageOffset = contents.readUInt32LE(directoryOffset + 12)

      expect(width).toBe(height)
      expect(imageOffset + imageByteLength).toBeLessThanOrEqual(contents.byteLength)
      sizes = [...sizes, width]
      directoryOffset += 16
    }

    return sizes
  }

  it('publishes electron-builder artifacts to the GitHub releases feed', async () => {
    const desktopPackageJson = JSON.parse(
      await readFile('apps/desktop/package.json', 'utf8')
    ) as {
      scripts?: Record<string, string>
    }
    const electronBuilderConfig = JSON.parse(
      await readFile('apps/desktop/electron-builder.json', 'utf8')
    ) as {
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

    expect(electronBuilderConfig.publish).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: 'flowforever',
          provider: 'github',
          releaseType: 'release',
          repo: 'mde'
        })
      ])
    )
    expect(desktopPackageJson.scripts?.['release:github']).toBe(
      'pnpm run release:github:mac'
    )
    expect(desktopPackageJson.scripts?.['release:github:mac']).toContain(
      '--publish always'
    )
    expect(desktopPackageJson.scripts?.['release:github:mac']).toContain('--x64')
    expect(desktopPackageJson.scripts?.['release:github:mac']).toContain('--arm64')
    expect(desktopPackageJson.scripts?.['release:github:win']).toContain(
      '--publish always'
    )
    expect(desktopPackageJson.scripts?.['release:github:win']).toContain(
      '--win nsis'
    )
    expect(desktopPackageJson.scripts?.['dist:win']).toContain('--win nsis')
    expect(desktopPackageJson.scripts?.['dist:mac']).toContain('--x64')
    expect(desktopPackageJson.scripts?.['dist:mac']).toContain('--arm64')
    expect(electronBuilderConfig.artifactName).toContain('${arch}')
    expect(electronBuilderConfig.mac).toEqual(
      expect.objectContaining({
        entitlements: '../../build/entitlements.mac.plist',
        entitlementsInherit: '../../build/entitlements.mac.inherit.plist',
        hardenedRuntime: true
      })
    )
    expect(electronBuilderConfig.mac?.notarize).toBeUndefined()
    expect(electronBuilderConfig.linux).toBeUndefined()
  })

  it('uses committed MDE app icon assets for packaged releases', async () => {
    const rootPackageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts?: Record<string, string>
    }
    const electronBuilderConfig = JSON.parse(
      await readFile('apps/desktop/electron-builder.json', 'utf8')
    ) as {
      icon?: string
      mac?: {
        icon?: string
      }
      win?: {
        icon?: string
      }
    }
    const svg = await readFile('build/icon.svg', 'utf8')
    const png = await readFile('build/icon.png')
    const icns = await readFile('build/icon.icns')
    const ico = await readFile('build/icon.ico')

    expect(rootPackageJson.scripts?.['icons:generate']).toBe(
      'node scripts/generate-app-icons.mjs'
    )
    expect(electronBuilderConfig.icon).toBe('../../build/icon')
    expect(electronBuilderConfig.mac?.icon).toBe('../../build/icon.icns')
    expect(electronBuilderConfig.win?.icon).toBe('../../build/icon.ico')
    expect(svg).toContain('MDE App Icon - Split Editor')
    expect(readPngDimensions(png)).toEqual({ height: 1024, width: 1024 })
    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns')
    expect(icns.readUInt32BE(4)).toBe(icns.byteLength)
    expect(readIcoImageSizes(ico)).toEqual(
      expect.arrayContaining([16, 24, 32, 48, 64, 128, 256])
    )
  })

  it('builds and publishes release artifacts when a version tag is pushed', async () => {
    const workflow = await readFile('.github/workflows/release.yml', 'utf8')

    expect(workflow).toContain('tags:')
    expect(workflow).toContain('v*')
    expect(workflow).toContain('contents: write')
    expect(workflow).toContain('corepack enable')
    expect(workflow).toContain('pnpm install --frozen-lockfile')
    expect(workflow).toContain('gh release create')
    expect(workflow).toContain(
      'notes_file=".github/release-notes/$GITHUB_REF_NAME.md"'
    )
    expect(workflow).toContain('--notes-file "$notes_file"')
    expect(workflow).toContain('Restore release notes')
    expect(workflow).toContain('git for-each-ref')
    expect(workflow).toContain('gh release edit')
    expect(workflow).toContain('pnpm run release:github:mac')
    expect(workflow).toContain('pnpm run release:github:win')
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
    const html = await readFile('apps/desktop/src/renderer/index.html', 'utf8')

    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain("script-src 'self'")
    expect(html).toContain("style-src 'self' 'unsafe-inline'")
    expect(html).toContain("img-src 'self' data: file:")
    expect(html).toContain("object-src 'none'")
  })
})
