import { describe, expect, it } from 'vitest'

import {
  AUTOMATION_NO_WORKSPACE_ID,
  normalizeAutomationProjectionFilters
} from '../../src/main/services/automation/automationProjectionFilters'
import type { AutomationFlowRow } from '../../src/shared/automation'

const flows: readonly AutomationFlowRow[] = [
  {
    automationFlowId: 'workspace-flow',
    automationFlowOwnerKey: 'workspace:%2Fworkspace:flow:workspace-flow',
    lifecycle: 'enabled',
    name: 'Workspace flow',
    scope: 'workspace',
    sourceTypes: ['workspace-markdown'],
    status: 'formal',
    taskCount: 1,
    workspaceId: '/workspace'
  },
  {
    automationFlowId: 'user-flow',
    automationFlowOwnerKey: 'global:flow:user-flow',
    lifecycle: 'enabled',
    name: 'User flow',
    scope: 'user',
    sourceTypes: ['user-prompt'],
    status: 'formal',
    taskCount: 0,
    workspaceId: AUTOMATION_NO_WORKSPACE_ID
  }
]

describe('normalizeAutomationProjectionFilters', () => {
  it('defaults first open to Ready scoped to the current workspace', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        flows
      })
    ).toEqual({
      archivedVisible: false,
      bucket: 'ready',
      flowOwnerKeys: [],
      scopeIds: ['workspace:/workspace']
    })
  })

  it('drops stale scope and flow filters', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        filters: {
          bucket: 'done',
          flowOwnerKeys: [
            'missing-flow',
            'workspace:%2Fworkspace:flow:workspace-flow',
            'global:flow:user-flow'
          ],
          scopeIds: ['workspace:/workspace', 'workspace:/stale']
        },
        flows
      })
    ).toEqual({
      archivedVisible: false,
      bucket: 'done',
      flowOwnerKeys: ['workspace:%2Fworkspace:flow:workspace-flow'],
      scopeIds: ['workspace:/workspace']
    })
  })

  it('keeps no scope restriction when all scope filters are stale', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        filters: {
          flowOwnerKeys: ['workspace:%2Fworkspace:flow:workspace-flow'],
          scopeIds: ['workspace:/stale']
        },
        flows
      })
    ).toEqual({
      archivedVisible: false,
      bucket: 'ready',
      flowOwnerKeys: [],
      scopeIds: []
    })
  })

  it('keeps an explicit empty scope selection empty', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        filters: {
          scopeIds: []
        },
        flows
      })
    ).toEqual({
      archivedVisible: false,
      bucket: 'ready',
      flowOwnerKeys: [],
      scopeIds: []
    })
  })
})
