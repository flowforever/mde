import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAutomationRuntimeOwner } from '../../src/main/services/automation/automationRuntimeOwner'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationRuntimeOwner', () => {
  it('acquires and refreshes the app-data runtime owner lease', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const owner = createAutomationRuntimeOwner({
      appDataPath,
      now: () => new Date('2026-05-10T08:00:00.000Z'),
      ownerId: 'owner-a',
      processId: 123
    })

    const acquired = await owner.acquire()
    const leaseFile = await readFile(owner.getLeasePath(), 'utf8')

    expect(acquired).toMatchObject({
      claimedStaleOwner: false,
      lease: {
        appDataPath,
        ownerId: 'owner-a',
        processId: 123,
        schemaVersion: 1
      }
    })
    expect(leaseFile).not.toContain('token')
    expect(leaseFile).not.toContain('prompt')
  })

  it('rejects a fresh active owner and claims a stale owner', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const firstOwner = createAutomationRuntimeOwner({
      appDataPath,
      isProcessRunning: () => true,
      now: () => new Date('2026-05-10T08:00:00.000Z'),
      ownerId: 'owner-a',
      processId: 123,
      staleAfterMs: 10_000
    })
    const competingOwner = createAutomationRuntimeOwner({
      appDataPath,
      isProcessRunning: () => true,
      now: () => new Date('2026-05-10T08:00:05.000Z'),
      ownerId: 'owner-b',
      processId: 456,
      staleAfterMs: 10_000
    })
    const staleOwner = createAutomationRuntimeOwner({
      appDataPath,
      isProcessRunning: () => true,
      now: () => new Date('2026-05-10T08:01:00.000Z'),
      ownerId: 'owner-c',
      processId: 789,
      staleAfterMs: 10_000
    })

    await firstOwner.acquire()

    await expect(competingOwner.acquire()).rejects.toThrow(/already owned/i)
    await expect(staleOwner.acquire()).resolves.toMatchObject({
      claimedStaleOwner: true,
      lease: {
        ownerId: 'owner-c'
      }
    })
  })
})
