import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  createMdeCliScript,
  ensureMdeCliRegistered,
  registerMdeCliInBackground
} from '../../src/main/services/cliRegistrationService'

describe('cliRegistrationService', () => {
  it('leaves an existing mde command untouched', async () => {
    const binPath = await mkdtemp(join(tmpdir(), 'mde-cli-existing-'))
    const commandPath = join(binPath, 'mde')

    await writeFile(commandPath, '#!/bin/sh\necho existing\n', { mode: 0o755 })

    const result = await ensureMdeCliRegistered({
      app: {
        getPath: (name) => (name === 'exe' ? '/Applications/MDE.app/Contents/MacOS/MDE' : tmpdir()),
        isPackaged: true
      },
      env: { PATH: binPath },
      platform: 'darwin'
    })

    expect(result).toEqual({
      path: commandPath,
      status: 'already-registered'
    })
    await expect(readFile(commandPath, 'utf8')).resolves.toContain('existing')
  })

  it('registers mde in the first writable command directory without blocking startup', async () => {
    const binPath = await mkdtemp(join(tmpdir(), 'mde-cli-register-'))
    const logger = { warn: vi.fn() }

    const result = await ensureMdeCliRegistered({
      app: {
        getPath: (name) => (name === 'exe' ? '/Applications/MDE.app/Contents/MacOS/MDE' : tmpdir()),
        isPackaged: true
      },
      commonCommandDirectories: [],
      env: { PATH: binPath },
      logger,
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
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('skips registration for unpackaged development launches', async () => {
    const binPath = await mkdtemp(join(tmpdir(), 'mde-cli-dev-'))

    await expect(
      ensureMdeCliRegistered({
        app: {
          getPath: (name) => (name === 'exe' ? '/dev/MDE' : tmpdir()),
          isPackaged: false
        },
        env: { PATH: binPath },
        platform: 'darwin'
      })
    ).resolves.toEqual({
      reason: 'not-packaged',
      status: 'skipped'
    })

    await expect(stat(join(binPath, 'mde'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('schedules registration in the background and reports failures through the logger', async () => {
    const logger = { warn: vi.fn() }
    const registrationError = new Error('permission denied')

    registerMdeCliInBackground({
      app: {
        getPath: (name) => (name === 'exe' ? '/Applications/MDE.app/Contents/MacOS/MDE' : tmpdir()),
        isPackaged: true
      },
      ensureRegistered: () => Promise.reject(registrationError),
      env: {},
      logger,
      platform: 'darwin'
    })

    expect(logger.warn).not.toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        'Unable to register mde command',
        registrationError
      )
    })
  })

  it('builds a macOS shell command that opens the current app bundle', () => {
    expect(
      createMdeCliScript('/Applications/MDE.app/Contents/MacOS/MDE', 'darwin')
    ).toContain('open -na "/Applications/MDE.app" --args "${resolved_args[@]}"')
  })
})
