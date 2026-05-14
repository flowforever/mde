import { describe, expect, it } from 'vitest'

import {
  AUTOMATION_NO_WORKSPACE_ID,
  normalizeAutomationProjectionFilters
} from '../../src/main/services/automation/automationProjectionFilters'
import type { AutomationFlowRow } from '../../src/shared/automation'

const flows: readonly AutomationFlowRow[] = [
  {
    automationFlowId: 'workspace-flow',
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
  it('defaults first open to Ready, current workspace, and no-workspace scope', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        flows
      })
    ).toEqual({
      archivedVisible: false,
      bucket: 'ready',
      flowIds: [],
      workspaceIds: ['/workspace', AUTOMATION_NO_WORKSPACE_ID]
    })
  })

  it('drops stale workspace and flow filters', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        filters: {
          bucket: 'done',
          flowIds: ['missing-flow', 'workspace-flow', 'user-flow'],
          workspaceIds: ['/workspace', '/stale']
        },
        flows
      })
    ).toEqual({
      archivedVisible: false,
      bucket: 'done',
      flowIds: ['workspace-flow'],
      workspaceIds: ['/workspace']
    })
  })

  it('falls back to workspace defaults when all workspace filters are stale', () => {
    expect(
      normalizeAutomationProjectionFilters({
        currentWorkspaceId: '/workspace',
        filters: {
          flowIds: ['workspace-flow'],
          workspaceIds: ['/stale']
        },
        flows
      }).workspaceIds
    ).toEqual(['/workspace', AUTOMATION_NO_WORKSPACE_ID])
  })
})
