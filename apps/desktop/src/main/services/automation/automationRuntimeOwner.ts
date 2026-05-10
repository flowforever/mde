import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { AutomationRuntimeOwnerLease } from '../../../shared/automationRuntime'

interface AutomationRuntimeOwnerOptions {
  readonly appDataPath: string
  readonly heartbeatIntervalMs?: number
  readonly isProcessRunning?: (processId: number) => boolean
  readonly now?: () => Date
  readonly ownerId?: string
  readonly processId?: number
  readonly staleAfterMs?: number
}

export interface AutomationRuntimeOwnerAcquireResult {
  readonly claimedStaleOwner: boolean
  readonly lease: AutomationRuntimeOwnerLease
}

export interface AutomationRuntimeOwner {
  readonly acquire: () => Promise<AutomationRuntimeOwnerAcquireResult>
  readonly getLeasePath: () => string
  readonly refreshHeartbeat: () => Promise<AutomationRuntimeOwnerLease>
  readonly release: () => Promise<void>
  readonly startHeartbeat: () => void
  readonly stopHeartbeat: () => void
}

const DEFAULT_STALE_AFTER_MS = 60_000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000

const isProcessRunningByDefault = (processId: number): boolean => {
  try {
    process.kill(processId, 0)
    return true
  } catch {
    return false
  }
}

const readLease = async (
  leasePath: string
): Promise<AutomationRuntimeOwnerLease | null> => {
  try {
    return JSON.parse(await readFile(leasePath, 'utf8')) as AutomationRuntimeOwnerLease
  } catch {
    return null
  }
}

const writeLease = async (
  leasePath: string,
  lease: AutomationRuntimeOwnerLease
): Promise<void> => {
  await mkdir(dirname(leasePath), { recursive: true })
  await writeFile(leasePath, `${JSON.stringify(lease, null, 2)}\n`, 'utf8')
}

const isLeaseStale = (
  lease: AutomationRuntimeOwnerLease,
  isProcessRunning: (processId: number) => boolean,
  now: Date,
  staleAfterMs: number
): boolean =>
  !isProcessRunning(lease.processId) ||
  now.getTime() - new Date(lease.heartbeatAt).getTime() > staleAfterMs

export const createAutomationRuntimeOwner = ({
  appDataPath,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  isProcessRunning = isProcessRunningByDefault,
  now = () => new Date(),
  ownerId = `owner-${process.pid}-${Date.now()}`,
  processId = process.pid,
  staleAfterMs = DEFAULT_STALE_AFTER_MS
}: AutomationRuntimeOwnerOptions): AutomationRuntimeOwner => {
  const leasePath = join(appDataPath, 'automation', 'runtime-owner.json')
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let currentLease: AutomationRuntimeOwnerLease | null = null

  const createLease = (startedAt: string): AutomationRuntimeOwnerLease =>
    Object.freeze({
      appDataPath,
      heartbeatAt: now().toISOString(),
      ownerId,
      processId,
      schemaVersion: 1,
      startedAt
    })

  const refreshHeartbeat = async (): Promise<AutomationRuntimeOwnerLease> => {
    const startedAt = currentLease?.startedAt ?? now().toISOString()
    const lease = createLease(startedAt)

    await writeLease(leasePath, lease)
    currentLease = lease

    return lease
  }

  const owner: AutomationRuntimeOwner = {
    async acquire() {
      const existingLease = await readLease(leasePath)
      const timestamp = now()

      if (
        existingLease !== null &&
        existingLease.ownerId !== ownerId &&
        !isLeaseStale(existingLease, isProcessRunning, timestamp, staleAfterMs)
      ) {
        throw new Error('Automation runtime is already owned by another active process.')
      }

      const lease = createLease(timestamp.toISOString())

      await writeLease(leasePath, lease)
      currentLease = lease

      return Object.freeze({
        claimedStaleOwner:
          existingLease !== null && existingLease.ownerId !== ownerId,
        lease
      })
    },
    getLeasePath: () => leasePath,
    refreshHeartbeat,
    async release() {
      owner.stopHeartbeat()
      currentLease = null
      await rm(leasePath, { force: true })
    },
    startHeartbeat() {
      if (heartbeatTimer !== null) {
        return
      }

      heartbeatTimer = setInterval(() => {
        void refreshHeartbeat().catch(() => undefined)
      }, heartbeatIntervalMs)
      heartbeatTimer.unref?.()
    },
    stopHeartbeat() {
      if (heartbeatTimer === null) {
        return
      }

      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  return Object.freeze(owner)
}
