import type { AutomationRuntime } from './automationRuntime'
import type { AutomationRuntimeOwner } from './automationRuntimeOwner'
import type { AutomationStore } from './automationStore'

interface AutomationRuntimeCoordinatorOptions {
  readonly owner: AutomationRuntimeOwner
  readonly runtime: AutomationRuntime
  readonly store: AutomationStore
}

export interface AutomationRuntimeCoordinator extends AutomationRuntime {
  readonly prepareForShutdown: () => Promise<void>
  readonly start: () => Promise<void>
}

export const createAutomationRuntimeCoordinator = ({
  owner,
  runtime,
  store
}: AutomationRuntimeCoordinatorOptions): AutomationRuntimeCoordinator => {
  let startPromise: Promise<void> | null = null
  let stopping = false

  const start = async (): Promise<void> => {
    if (startPromise !== null) {
      return startPromise
    }

    startPromise = (async () => {
      await store.initialize()
      await owner.acquire()
      await store.recoverInterruptedRuns()
      owner.startHeartbeat()
    })()

    return startPromise
  }

  const ensureStarted = async (): Promise<void> => {
    if (stopping) {
      throw new Error('Automation runtime is stopping.')
    }

    await start()
  }

  const coordinator: AutomationRuntimeCoordinator = {
    async cancelRun(runId) {
      await ensureStarted()

      return runtime.cancelRun(runId)
    },
    async completeRun(input) {
      await ensureStarted()

      return runtime.completeRun(input)
    },
    derivePhaseProgress: runtime.derivePhaseProgress,
    async getRunActions(input) {
      await ensureStarted()

      return runtime.getRunActions(input)
    },
    async openNativeSession(runId) {
      await ensureStarted()

      return runtime.openNativeSession(runId)
    },
    async prepareForShutdown() {
      stopping = true
      owner.stopHeartbeat()
      await owner.release()
    },
    async resumeRun(input) {
      await ensureStarted()

      return runtime.resumeRun(input)
    },
    start,
    async startRun(input) {
      await ensureStarted()

      return runtime.startRun(input)
    },
    async startDiscoveryRun(input) {
      await ensureStarted()

      return runtime.startDiscoveryRun(input)
    }
  }

  return Object.freeze(coordinator)
}
