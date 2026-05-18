import { describe, expect, it } from 'vitest'

import {
  createAppliedGlobalFlowOwnerKey,
  createGlobalFlowOwnerKey,
  createWorkspaceFlowOwnerKey,
  getStoredAutomationFlowOwnerKey
} from '../../src/main/services/automation/automationFlowOwnerIdentity'

describe('automationFlowOwnerIdentity', () => {
  it('creates explicit owner keys for workspace, global, and applied global flows', () => {
    expect(
      createWorkspaceFlowOwnerKey({ flowId: 'flow-a', workspaceId: '/repo' })
    ).toBe('workspace:%2Frepo:flow:flow-a')
    expect(createGlobalFlowOwnerKey({ flowId: 'flow-a' })).toBe(
      'global:flow:flow-a'
    )
    expect(
      createAppliedGlobalFlowOwnerKey({
        flowId: 'flow-a',
        workspaceId: '/repo'
      })
    ).toBe('workspace:%2Frepo:applied-global:flow-a')
  })

  it('preserves stored owner keys for legacy run compatibility', () => {
    expect(
      getStoredAutomationFlowOwnerKey({
        automationFlowId: 'flow-a',
        automationFlowOwnerKey: 'legacy-owner',
        workspaceRoot: '/repo'
      })
    ).toBe('legacy-owner')
  })
})
