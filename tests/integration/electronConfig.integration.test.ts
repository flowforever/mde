import { basename, normalize, sep } from 'node:path'
import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { createPreloadPath, createWindowOptions } from '../../src/main/index'

describe('Electron window config', () => {
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
