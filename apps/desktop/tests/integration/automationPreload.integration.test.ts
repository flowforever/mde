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
    await automationApi.loadFlowDefinition({ filePath: '/workspace/flow.md' })
    await automationApi.saveFlowDefinition({
      filePath: '/workspace/flow.md',
      markdown: '# Flow'
    })
    await automationApi.startRun({ taskId: 'task-a' })
    await automationApi.submitDecision({
      decisionId: 'decision-a',
      response: 'approved'
    })
    await automationApi.openNativeSession({ runId: 'run-a' })

    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      AUTOMATION_CHANNELS.getProjection,
      AUTOMATION_CHANNELS.listCapabilityReports,
      AUTOMATION_CHANNELS.listTemplates,
      AUTOMATION_CHANNELS.validateTemplateInput,
      AUTOMATION_CHANNELS.createFlowFromTemplate,
      AUTOMATION_CHANNELS.loadFlowDefinition,
      AUTOMATION_CHANNELS.saveFlowDefinition,
      AUTOMATION_CHANNELS.startRun,
      AUTOMATION_CHANNELS.submitDecision,
      AUTOMATION_CHANNELS.openNativeSession
    ])
    expect(Object.keys(automationApi).sort()).toEqual([
      'archiveFlow',
      'cancelRun',
      'createFlowFromTemplate',
      'getProjection',
      'listCapabilityReports',
      'listReports',
      'listTemplates',
      'loadFlowDefinition',
      'openNativeSession',
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
