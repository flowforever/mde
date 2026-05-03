import { access, mkdtemp, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ensureMdeCliRegistered } from '../../src/main/services/cliRegistrationService'

describe('cli registration integration', () => {
  it('writes an executable mde command into a writable PATH directory', async () => {
    const binPath = await mkdtemp(join(tmpdir(), 'mde-cli-integration-'))
    const result = await ensureMdeCliRegistered({
      app: {
        getPath: (name) => (name === 'exe' ? '/Applications/MDE.app/Contents/MacOS/MDE' : tmpdir()),
        isPackaged: true
      },
      commonCommandDirectories: [],
      env: { PATH: binPath },
      platform: 'darwin'
    })
    const commandPath = join(binPath, 'mde')

    expect(result).toEqual({
      path: commandPath,
      status: 'registered'
    })
    await expect(access(commandPath, constants.X_OK)).resolves.toBeUndefined()
    await expect(readFile(commandPath, 'utf8')).resolves.toContain(
      'open -na "/Applications/MDE.app" --args "${resolved_args[@]}"'
    )
  })
})
