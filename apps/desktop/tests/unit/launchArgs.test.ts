import { describe, expect, it } from 'vitest'

import { getLaunchPathFromArgv } from '../../src/main/launchArgs'

describe('launch args', () => {
  it('returns null when no path is provided', () => {
    expect(getLaunchPathFromArgv(['/Applications/MDE.app/Contents/MacOS/MDE']))
      .toBeNull()
  })

  it('resolves the first non-option path argument', () => {
    expect(
      getLaunchPathFromArgv(
        ['/Applications/MDE.app/Contents/MacOS/MDE', 'notes'],
        '/Users/user'
      )
    ).toBe('/Users/user/notes')
  })

  it('ignores Electron and test harness arguments before the launch path', () => {
    expect(
      getLaunchPathFromArgv(
        [
          '/Applications/Electron.app/Contents/MacOS/Electron',
          '/repo/out/main/index.js',
          '--inspect=9229',
          '/Users/user/notes/README.md'
        ],
        '/repo'
      )
    ).toBe('/Users/user/notes/README.md')
  })

  it('ignores a relative compiled main entry before the launch path', () => {
    expect(
      getLaunchPathFromArgv(
        [
          '/Applications/Electron.app/Contents/MacOS/Electron',
          'out/main/index.js',
          '/Users/user/notes'
        ],
        '/repo'
      )
    ).toBe('/Users/user/notes')
  })
})
