export interface AutomationSchedulerOwnerIdentity {
  readonly automationFlowId: string
  readonly profileId: string
  readonly workspaceScope: string
}

export interface AutomationSchedulerLease {
  readonly key: string
  readonly ownerId: string
}

export interface AutomationSchedulerOwner {
  readonly acquire: (
    identity: AutomationSchedulerOwnerIdentity,
    ownerId: string
  ) => AutomationSchedulerLease
  readonly release: (lease: AutomationSchedulerLease) => void
  readonly runWithLease: <Value>(
    identity: AutomationSchedulerOwnerIdentity,
    ownerId: string,
    task: () => Promise<Value>
  ) => Promise<Value>
}

export const createAutomationSchedulerKey = (
  identity: AutomationSchedulerOwnerIdentity
): string =>
  [identity.profileId, identity.workspaceScope, identity.automationFlowId].join(
    '::'
  )

export const createAutomationSchedulerOwner = (): AutomationSchedulerOwner => {
  const leases = new Map<string, AutomationSchedulerLease>()
  const activeTasks = new Map<string, Promise<unknown>>()

  const owner: AutomationSchedulerOwner = {
    acquire(identity, ownerId) {
      const key = createAutomationSchedulerKey(identity)
      const existingLease = leases.get(key)

      if (existingLease !== undefined) {
        return existingLease
      }

      const lease = Object.freeze({ key, ownerId })

      leases.set(key, lease)

      return lease
    },
    release(lease) {
      const existingLease = leases.get(lease.key)

      if (existingLease?.ownerId === lease.ownerId) {
        leases.delete(lease.key)
      }
    },
    async runWithLease(identity, ownerId, task) {
      const lease = owner.acquire(identity, ownerId)
      const existingTask = activeTasks.get(lease.key)

      if (existingTask !== undefined) {
        return existingTask as Promise<Awaited<ReturnType<typeof task>>>
      }

      const nextTask = task().finally(() => {
        if (activeTasks.get(lease.key) === nextTask) {
          activeTasks.delete(lease.key)
        }
      })

      activeTasks.set(lease.key, nextTask)

      return nextTask
    }
  }

  return Object.freeze(owner)
}
