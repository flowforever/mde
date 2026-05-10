import { describe, expect, it } from 'vitest'

import {
  createAutomationSchedulerKey,
  createAutomationSchedulerOwner
} from '../../src/main/services/automation/automationSchedulerOwner'

const schedulerIdentity = {
  automationFlowId: 'flow-a',
  profileId: 'profile-a',
  workspaceScope: 'workspace:/repo'
}

describe('automationSchedulerOwner', () => {
  it('creates one active scheduler lease per flow runtime key', () => {
    const owner = createAutomationSchedulerOwner()
    const firstLease = owner.acquire(schedulerIdentity, 'owner-a')
    const duplicateLease = owner.acquire(schedulerIdentity, 'owner-b')

    expect(createAutomationSchedulerKey(schedulerIdentity)).toBe(
      'profile-a::workspace:/repo::flow-a'
    )
    expect(duplicateLease).toBe(firstLease)

    owner.release(firstLease)

    expect(owner.acquire(schedulerIdentity, 'owner-b')).toMatchObject({
      ownerId: 'owner-b'
    })
  })

  it('collapses duplicate scheduler ticks into one run attempt', async () => {
    const owner = createAutomationSchedulerOwner()
    let attempts = 0
    const startAttempt = () =>
      owner.runWithLease(schedulerIdentity, 'owner-a', async () => {
        attempts += 1
        await Promise.resolve()

        return 'run-a'
      })

    await expect(Promise.all([startAttempt(), startAttempt()])).resolves.toEqual([
      'run-a',
      'run-a'
    ])
    expect(attempts).toBe(1)
  })
})
