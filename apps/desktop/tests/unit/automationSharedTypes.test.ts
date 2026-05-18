import { describe, expect, test } from 'vitest'

import { AUTOMATION_CHANNELS } from '../../src/main/ipc/channels'
import {
  isAutomationCommand,
  type AgentCliCapabilityReport,
  type AutomationCommand,
  type AutomationProjection
} from '../../src/shared/automation'

describe('automation shared IPC contract', () => {
  test('defines stable Automation channels', () => {
    expect(AUTOMATION_CHANNELS).toEqual({
      archiveFlow: 'automation:archive-flow',
      applyGlobalFlowToWorkspace: 'automation:apply-global-flow-to-workspace',
      cancelRun: 'automation:cancel-run',
      createExecutorDraft: 'automation:create-executor-draft',
      createFlowDraft: 'automation:create-flow-draft',
      createFlowFromTemplate: 'automation:create-flow-from-template',
      deleteFlow: 'automation:delete-flow',
      getExplorerAutomationProjection:
        'automation:get-explorer-automation-projection',
      getProjection: 'automation:get-projection',
      listCapabilityReports: 'automation:list-capability-reports',
      listReports: 'automation:list-reports',
      listTemplates: 'automation:list-templates',
      loadFlowDefinition: 'automation:load-flow-definition',
      openAutomationManagementTarget: 'automation:open-management-target',
      openNativeSession: 'automation:open-native-session',
      refreshSkillCatalog: 'automation:refresh-skill-catalog',
      removeAppliedGlobalFlowFromWorkspace:
        'automation:remove-applied-global-flow-from-workspace',
      renameFlow: 'automation:rename-flow',
      restoreFlow: 'automation:restore-flow',
      resumeRun: 'automation:resume-run',
      saveFlowDefinition: 'automation:save-flow-definition',
      setFlowLifecycle: 'automation:set-flow-lifecycle',
      startRun: 'automation:start-run',
      submitDecision: 'automation:submit-decision',
      updateFilters: 'automation:update-filters',
      validateTemplateInput: 'automation:validate-template-input'
    })
  })

  test('accepts discriminated Automation commands with required identifiers', () => {
    expect(isAutomationCommand({ taskId: 'task-1', type: 'start-run' })).toBe(
      true
    )
    expect(
      isAutomationCommand({
        decisionId: 'decision-1',
        response: 'Approved',
        type: 'submit-decision'
      })
    ).toBe(true)
    expect(isAutomationCommand({ taskId: 'task-1', type: 'unknown' })).toBe(
      false
    )
    expect(isAutomationCommand({ type: 'start-run' })).toBe(false)
    expect(isAutomationCommand(null)).toBe(false)
  })

  test('keeps projections and capability reports IPC-safe', () => {
    const command = {
      executorId: 'implementation',
      taskDataId: 'task-data-a',
      taskDataSnapshotId: 'task-data-snapshot-a',
      taskId: 'workspace-flow:workspace:.mde/docs/tasks/ready.md',
      type: 'start-run'
    } satisfies AutomationCommand
    const capabilityReport = {
      capabilities: {
        resumeSession: true,
        streamingEvents: true,
        structuredToolCalls: false
      },
      checkedAt: '2026-05-10T07:24:00.000Z',
      detected: true,
      engine: 'codex'
    } satisfies AgentCliCapabilityReport
    const projection = {
      buckets: {
        done: [],
        needsMe: [],
        ready: [
          {
            automationFlowId: 'workspace-flow',
            bucket: 'ready',
            eligibleExecutors: [
              {
                displayName: 'Implementation',
                executorId: 'implementation',
                executorSnapshotId: 'executor-snapshot-1',
                type: 'markdown'
              }
            ],
            engine: 'codex',
            primaryExecutor: {
              displayName: 'Implementation',
              executorId: 'implementation',
              executorSnapshotId: 'executor-snapshot-1',
              type: 'markdown'
            },
            sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
            sourceType: 'workspace-markdown',
            taskDataId: 'task-data-1',
            taskDataSnapshotId: 'task-data-snapshot-1',
            taskId: command.taskId,
            title: 'READY Ship automation work'
          }
        ],
        running: []
      },
      decisions: [],
      diagnostics: [],
      filters: {
        archivedVisible: false,
        bucket: 'ready',
        flowIds: ['workspace-flow'],
        flowOwnerKeys: ['workspace:/workspace:flow:workspace-flow'],
        scopeIds: ['workspace:/workspace'],
        workspaceIds: ['/workspace', 'mde:no-workspace']
      },
      flows: [
        {
          automationFlowId: 'workspace-flow',
          lifecycle: 'enabled',
          name: 'Workspace Flow',
          scope: 'workspace',
          sourceTypes: ['workspace-markdown'],
          status: 'formal',
          taskCount: 1,
          workspaceId: '/workspace'
        }
      ],
      generatedAt: '2026-05-10T07:24:00.000Z',
      reports: [],
      runs: [],
      tasks: [
        {
          automationFlowId: 'workspace-flow',
          bucket: 'ready',
          engine: capabilityReport.engine,
          primaryExecutor: {
            displayName: 'Implementation',
            executorId: 'implementation',
            type: 'markdown'
          },
          sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
          sourceType: 'workspace-markdown',
          taskDataId: 'task-data-1',
          taskDataSnapshotId: 'task-data-snapshot-1',
          taskId: command.taskId,
          title: 'READY Ship automation work'
        }
      ]
    } satisfies AutomationProjection

    expect(projection.tasks[0]?.taskId).toBe(command.taskId)
    expect(capabilityReport.capabilities.resumeSession).toBe(true)
  })
})
