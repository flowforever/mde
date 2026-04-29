import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('mde CLI', () => {
  it('prints the resolved launch command in dry-run mode', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['bin/mde.js', '--dry-run', 'README.md'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MDE_APP_PATH: '/Applications/MDE.app'
        }
      }
    )

    const command = JSON.parse(stdout) as {
      readonly args: readonly string[]
      readonly command: string
    }

    expect(command.command).toBe('open')
    expect(command.args).toEqual([
      '-na',
      '/Applications/MDE.app',
      '--args',
      `${process.cwd()}/README.md`
    ])
  }, 60_000)

  it('supports launching without a path', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['bin/mde.js', '--dry-run'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MDE_APP_PATH: '/Applications/MDE.app'
        }
      }
    )

    const command = JSON.parse(stdout) as {
      readonly args: readonly string[]
      readonly command: string
    }

    expect(command.command).toBe('open')
    expect(command.args).toEqual(['-na', '/Applications/MDE.app'])
  }, 60_000)
})
