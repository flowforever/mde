import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('window workspace session restore integration', () => {
  it('keeps App startup wired to per-window session state before global active workspace state', async () => {
    const appSource = await readFile(
      resolve('apps/desktop/src/renderer/src/app/App.tsx'),
      'utf8'
    )

    expect(appSource).toMatch(
      /readWindowWorkspaceSession\(\s*globalThis\.sessionStorage,?\s*\)/u
    )
    expect(appSource).toContain(
      'writeWindowWorkspaceSession(globalThis.sessionStorage'
    )
    expect(appSource.indexOf('readWindowWorkspaceSession')).toBeLessThan(
      appSource.indexOf('readActiveWorkspace(globalThis.localStorage)')
    )
  })
})
