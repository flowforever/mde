import { describe, expect, it, vi } from 'vitest'

import { AUTOMATION_CHANNELS } from '../../src/main/ipc/channels'
import { createAutomationApi } from '../../src/preload/automationApi'

describe('automation preload integration', () => {
  it('exposes a narrow Automation API over typed IPC channels', async () => {
    const invoke = vi.fn((channel: string, ...args: unknown[]) =>
      Promise.resolve({ channel, args })
    )
    const automationApi = createAutomationApi({ invoke })

    await automationApi.getProjection({ workspaceRoot: '/workspace' })
    await automationApi.getExplorerAutomationProjection({
      workspaceRoot: '/workspace'
    })
    await automationApi.listCapabilityReports({ workspaceRoot: '/workspace' })
    await automationApi.listTemplates()
    await automationApi.validateTemplateInput({
      defaultEngine: 'codex',
      flowId: 'flow-a',
      scope: 'workspace',
      templateId: 'local-dev-task'
    })
    await automationApi.createFlowFromTemplate({
      defaultEngine: 'codex',
      flowId: 'flow-a',
      scope: 'workspace',
      templateId: 'local-dev-task'
    })
    await automationApi.createFlowDraft({
      displayName: 'Flow A',
      flowId: 'flow-a',
      workspaceRoot: '/workspace'
    })
    await automationApi.createExecutorDraft({
      displayName: 'Implementation',
      executorId: 'implementation',
      flowId: 'flow-a',
      workspaceRoot: '/workspace'
    })
    await automationApi.renameFlow({
      filePath: '/workspace/.mde/automation-flows/flow-a.md',
      name: 'Renamed Flow'
    })
    await automationApi.deleteFlow({
      filePath: '/workspace/.mde/automation-flows/flow-a.md'
    })
    await automationApi.applyGlobalFlowToWorkspace({
      flowId: 'global-flow',
      workspaceRoot: '/workspace'
    })
    await automationApi.removeAppliedGlobalFlowFromWorkspace({
      flowId: 'global-flow',
      workspaceRoot: '/workspace'
    })
    await automationApi.openAutomationManagementTarget({
      target: 'workspace',
      workspaceRoot: '/workspace'
    })
    await automationApi.refreshSkillCatalog()
    await automationApi.loadFlowDefinition({ filePath: '/workspace/flow.md' })
    await automationApi.saveFlowDefinition({
      filePath: '/workspace/flow.md',
      markdown: '# Flow'
    })
    await automationApi.startRun({
      executorId: 'implementation',
      taskDataId: 'task-data-a',
      taskDataSnapshotId: 'task-data-snapshot-a',
      taskId: 'task-a'
    })
    await automationApi.submitDecision({
      decisionId: 'decision-a',
      response: 'approved'
    })
    await automationApi.openNativeSession({ runId: 'run-a' })

    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      AUTOMATION_CHANNELS.getProjection,
      AUTOMATION_CHANNELS.getExplorerAutomationProjection,
      AUTOMATION_CHANNELS.listCapabilityReports,
      AUTOMATION_CHANNELS.listTemplates,
      AUTOMATION_CHANNELS.validateTemplateInput,
      AUTOMATION_CHANNELS.createFlowFromTemplate,
      AUTOMATION_CHANNELS.createFlowDraft,
      AUTOMATION_CHANNELS.createExecutorDraft,
      AUTOMATION_CHANNELS.renameFlow,
      AUTOMATION_CHANNELS.deleteFlow,
      AUTOMATION_CHANNELS.applyGlobalFlowToWorkspace,
      AUTOMATION_CHANNELS.removeAppliedGlobalFlowFromWorkspace,
      AUTOMATION_CHANNELS.openAutomationManagementTarget,
      AUTOMATION_CHANNELS.refreshSkillCatalog,
      AUTOMATION_CHANNELS.loadFlowDefinition,
      AUTOMATION_CHANNELS.saveFlowDefinition,
      AUTOMATION_CHANNELS.startRun,
      AUTOMATION_CHANNELS.submitDecision,
      AUTOMATION_CHANNELS.openNativeSession
    ])
    expect(Object.keys(automationApi).sort()).toEqual([
      'applyGlobalFlowToWorkspace',
      'archiveFlow',
      'cancelRun',
      'createExecutorDraft',
      'createFlowDraft',
      'createFlowFromTemplate',
      'deleteFlow',
      'getExplorerAutomationProjection',
      'getProjection',
      'listCapabilityReports',
      'listReports',
      'listTemplates',
      'loadFlowDefinition',
      'openAutomationManagementTarget',
      'openNativeSession',
      'refreshSkillCatalog',
      'removeAppliedGlobalFlowFromWorkspace',
      'renameFlow',
      'restoreFlow',
      'resumeRun',
      'saveFlowDefinition',
      'setFlowLifecycle',
      'startRun',
      'submitDecision',
      'updateFilters',
      'validateTemplateInput'
    ])
  })
})
