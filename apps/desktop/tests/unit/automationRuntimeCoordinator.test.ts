import { describe, expect, it, vi } from 'vitest'

import type { AutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationRuntimeCoordinator } from '../../src/main/services/automation/automationRuntimeCoordinator'
import type { AutomationRuntimeOwner } from '../../src/main/services/automation/automationRuntimeOwner'
import type { AutomationStore } from '../../src/main/services/automation/automationStore'

const createRuntime = (): AutomationRuntime =>
  Object.freeze({
    cancelRun: vi.fn(),
    completeRun: vi.fn(),
    derivePhaseProgress: vi.fn(),
    getRunActions: vi.fn(),
    openNativeSession: vi.fn(),
    resumeRun: vi.fn(),
    startDiscoveryRun: vi.fn(),
    startRun: vi.fn()
  })

const createOwner = (): AutomationRuntimeOwner =>
  ({
    acquire: vi.fn(() =>
      Promise.resolve({
        claimedStaleOwner: false,
        lease: {
          appDataPath: '/tmp/profile',
          heartbeatAt: '2026-05-10T08:00:00.000Z',
          ownerId: 'owner-a',
          processId: 123,
          schemaVersion: 1,
          startedAt: '2026-05-10T08:00:00.000Z'
        }
      })
    ),
    getLeasePath: vi.fn(),
    refreshHeartbeat: vi.fn(),
    release: vi.fn(() => Promise.resolve()),
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn()
  }) as unknown as AutomationRuntimeOwner

const createStore = (): AutomationStore =>
  ({
    initialize: vi.fn(() => Promise.resolve()),
    recoverInterruptedRuns: vi.fn(() => Promise.resolve())
  }) as unknown as AutomationStore

describe('automationRuntimeCoordinator', () => {
  it('starts the runtime once, owns recovery, and releases on shutdown', async () => {
    const owner = createOwner()
    const runtime = createRuntime()
    const store = createStore()
    const coordinator = createAutomationRuntimeCoordinator({
      owner,
      runtime,
      store
    })

    await Promise.all([coordinator.start(), coordinator.start()])
    await coordinator.prepareForShutdown()

    expect(store.initialize).toHaveBeenCalledTimes(1)
    expect(owner.acquire).toHaveBeenCalledTimes(1)
    expect(store.recoverInterruptedRuns).toHaveBeenCalledTimes(1)
    expect(owner.startHeartbeat).toHaveBeenCalledTimes(1)
    expect(owner.stopHeartbeat).toHaveBeenCalledTimes(1)
    expect(owner.release).toHaveBeenCalledTimes(1)
  })
})
