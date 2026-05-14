import { describe, expect, it, vi } from 'vitest'

import type {
  AgentChatResumeSessionRequest,
  AgentChatRuntime,
  AgentChatSendMessageRequest,
  AgentChatStopSessionRequest
} from '@mde/agent-chat'
import type { AutomationFlow } from '@mde/automation-flow'

import { createAgentChatAutomationAdapter } from '../../src/main/services/automation/agentChatAutomationAdapter'

const flow: AutomationFlow = {
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  id: 'flow-a',
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'manual',
    onBlocked: 'pause-automation-flow',
    onEmpty: 'wait'
  },
  match: {},
  name: 'Flow A',
  pickOrder: [],
  priority: 0,
  reportPattern: '',
  scope: 'workspace',
  sections: {
    acceptanceStandard: '',
    executionStandard: '',
    pickRules: '',
    reportPattern: '',
    verificationExpectations: ''
  },
  sourceTypes: ['adapter-discovered'],
  status: 'formal'
}

describe('createAgentChatAutomationAdapter', () => {
  it('probes Codex availability through AgentChatRuntime', async () => {
    const runtime = {
      getAvailability: vi.fn(() =>
        Promise.resolve({ available: true, engineId: 'codex' })
      )
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(
      adapter.probe({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({
      detected: true,
      engine: 'codex',
      verdict: 'full'
    })
    expect(runtime.getAvailability).toHaveBeenCalledWith({
      selectedEngineId: 'codex',
      workspaceRoot: '/workspace'
    })
  })

  it('does not probe Agent Chat through an arbitrary cwd without a workspace', async () => {
    const runtime = {
      getAvailability: vi.fn(() =>
        Promise.resolve({ available: true, engineId: 'codex' })
      )
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(adapter.probe({})).resolves.toMatchObject({
      authenticated: false,
      detected: false,
      diagnostics: [
        {
          code: 'workspaceRequired'
        }
      ],
      verdict: 'unsupported',
      workspaceSupported: false
    })
    expect(runtime.getAvailability).not.toHaveBeenCalled()
  })

  it('preserves Codex authentication-required diagnostics from Agent Chat availability', async () => {
    const runtime = {
      getAvailability: vi.fn(() =>
        Promise.resolve({
          available: false,
          diagnostic: {
            code: 'authentication-required' as const,
            message: 'Sign in to Codex.',
            recoverable: true
          },
          engineId: 'codex',
          reason: 'authentication-required' as const
        })
      )
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(
      adapter.probe({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({
      authenticated: false,
      detected: true,
      diagnostics: [
        {
          code: 'authentication-required',
          messageKey: 'automationAdapter.diagnostics.authentication-required'
        }
      ],
      verdict: 'unsupported'
    })
  })

  it('preserves protocol-unsupported diagnostics without reporting authentication failure', async () => {
    const runtime = {
      getAvailability: vi.fn(() =>
        Promise.resolve({
          available: false,
          diagnostic: {
            code: 'protocol-unsupported' as const,
            message: 'Codex does not expose the sustained protocol.',
            recoverable: false
          },
          engineId: 'codex',
          reason: 'protocol-unsupported' as const
        })
      )
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(
      adapter.probe({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({
      authenticated: true,
      detected: true,
      diagnostics: [
        {
          code: 'protocol-unsupported',
          messageKey: 'automationAdapter.diagnostics.protocol-unsupported'
        }
      ],
      verdict: 'unsupported',
      workspaceSupported: true
    })
  })

  it('starts automation turns as automation-center Agent Chat sessions', async () => {
    const unsubscribe = vi.fn()
    let listener: Parameters<AgentChatRuntime['subscribe']>[1] | undefined
    const sendMessage = vi.fn<AgentChatRuntime['sendMessage']>(() => {
      listener?.({
        session: {
          createdAt: '2026-05-13T00:00:00.000Z',
          engineId: 'codex',
          host: 'automation-center',
          nativeSessionId: 'native-1',
          permissionMode: 'max-permission',
          sessionId: 'session-1',
          sessionPurpose: 'automation-task',
          state: 'active',
          updatedAt: '2026-05-13T00:00:00.000Z',
          workspaceRoot: '/workspace'
        },
        type: 'session-started'
      })
      listener?.({
        message: {
          attachments: [],
          content: JSON.stringify({
            discoveredTaskSources: [
              {
                sourceItemId: 'adapter:ready',
                sourceType: 'adapter-discovered',
                title: 'READY from Codex'
              }
            ]
          }),
          createdAt: '2026-05-13T00:00:00.000Z',
          messageId: 'assistant-1',
          role: 'assistant',
          sessionId: 'session-1'
        },
        type: 'assistant-message-completed'
      })

      return Promise.resolve()
    })
    const subscribe = vi.fn<AgentChatRuntime['subscribe']>(
      (_sessionId, nextListener) => {
        listener = nextListener
        return unsubscribe
      }
    )
    const runtime = {
      createDraftSession: vi.fn(() =>
        Promise.resolve({
          createdAt: '2026-05-13T00:00:00.000Z',
          engineId: 'codex',
          host: 'automation-center',
          permissionMode: 'max-permission',
          sessionId: 'session-1',
          sessionPurpose: 'automation-task',
          state: 'draft',
          updatedAt: '2026-05-13T00:00:00.000Z',
          workspaceRoot: '/workspace'
        })
      ),
      sendMessage,
      subscribe
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    const result = await adapter.startRun({
      automationFlow: flow,
      automationFlowSnapshotId: 'snapshot-1',
      preferredAdapterSessionId: 'preferred-session',
      promptBundle: 'Find tasks',
      runId: 'run-1',
      runKind: 'discovery',
      workspaceRoot: '/workspace'
    })

    expect(runtime.createDraftSession).toHaveBeenCalledWith({
      engineId: 'codex',
      host: 'automation-center',
      sessionPurpose: 'automation-task',
      workspaceRoot: '/workspace'
    })
    const sendMessageRequest: AgentChatSendMessageRequest =
      sendMessage.mock.calls[0][0]
    expect(sendMessageRequest).toMatchObject({
      content: 'Find tasks',
      sessionId: 'session-1',
      workspaceRoot: '/workspace'
    })
    expect(sendMessageRequest.contextManifest).toMatchObject({
      sessionPurpose: 'automation-task',
      workspaceRoot: '/workspace'
    })
    expect(result.adapterSessionId).toBe('native-1')
    expect(result.events).toContainEqual(
      expect.objectContaining({
        sources: [
          expect.objectContaining({
            automationFlowId: 'flow-a',
            sourceItemId: 'adapter:ready',
            title: 'READY from Codex'
          })
        ],
        type: 'discovered-task-sources'
      })
    )
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('resumes automation turns through the existing Agent Chat session', async () => {
    const unsubscribe = vi.fn()
    let listener: Parameters<AgentChatRuntime['subscribe']>[1] | undefined
    const resumeSession = vi.fn<AgentChatRuntime['resumeSession']>(() => {
      listener?.({
        message: {
          attachments: [],
          content: JSON.stringify({
            finalReport: {
              outcome: 'succeeded',
              summary: 'Applied approved change',
              title: 'READY from Codex'
            }
          }),
          createdAt: '2026-05-13T00:00:00.000Z',
          messageId: 'assistant-2',
          role: 'assistant',
          sessionId: 'session-1'
        },
        type: 'assistant-message-completed'
      })

      return Promise.resolve({
        createdAt: '2026-05-13T00:00:00.000Z',
        engineId: 'codex',
        host: 'automation-center',
        permissionMode: 'max-permission',
        sessionId: 'session-1',
        sessionPurpose: 'automation-task',
        state: 'active',
        updatedAt: '2026-05-13T00:00:00.000Z',
        workspaceRoot: '/workspace'
      })
    })
    const subscribe = vi.fn<AgentChatRuntime['subscribe']>(
      (_sessionId, nextListener) => {
        listener = nextListener
        return unsubscribe
      }
    )
    const runtime = {
      listSessions: vi.fn(() =>
        Promise.resolve([
          {
            createdAt: '2026-05-13T00:00:00.000Z',
            engineId: 'codex',
            host: 'automation-center',
            nativeSessionId: 'native-1',
            permissionMode: 'max-permission',
            sessionId: 'session-1',
            sessionPurpose: 'automation-task',
            state: 'active',
            updatedAt: '2026-05-13T00:00:00.000Z',
            workspaceRoot: '/workspace'
          }
        ])
      ),
      resumeSession,
      subscribe
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    const result = await adapter.resumeRun({
      adapterSessionId: 'native-1',
      promptBundle: 'Approved. Continue.',
      runId: 'run-1',
      workspaceRoot: '/workspace'
    })

    const resumeSessionRequest: AgentChatResumeSessionRequest =
      resumeSession.mock.calls[0][0]
    expect(resumeSessionRequest).toMatchObject({
      content: 'Approved. Continue.',
      nativeSessionId: 'native-1',
      sessionId: 'session-1',
      workspaceRoot: '/workspace'
    })
    expect(resumeSessionRequest.contextManifest).toMatchObject({
      sessionPurpose: 'automation-task',
      workspaceRoot: '/workspace'
    })
    expect(result.adapterSessionId).toBe('native-1')
    expect(result.events).toContainEqual(
      expect.objectContaining({
        outcome: 'succeeded',
        summary: 'Applied approved change',
        title: 'READY from Codex',
        type: 'final-report'
      })
    )
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('cancels automation runs by stopping the resolved Agent Chat session', async () => {
    const stopSession = vi.fn<AgentChatRuntime['stopSession']>(() =>
      Promise.resolve()
    )
    const runtime = {
      listSessions: vi.fn(() =>
        Promise.resolve([
          {
            createdAt: '2026-05-13T00:00:00.000Z',
            engineId: 'codex',
            host: 'automation-center',
            nativeSessionId: 'native-1',
            permissionMode: 'max-permission',
            sessionId: 'session-1',
            sessionPurpose: 'automation-task',
            state: 'active',
            updatedAt: '2026-05-13T00:00:00.000Z',
            workspaceRoot: '/workspace'
          }
        ])
      ),
      stopSession
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(
      adapter.cancelRun({
        adapterSessionId: 'native-1',
        runId: 'run-1',
        workspaceRoot: '/workspace'
      })
    ).resolves.toEqual({ accepted: true })

    const stopRequest: AgentChatStopSessionRequest = stopSession.mock.calls[0][0]
    expect(stopRequest).toEqual({
      sessionId: 'session-1',
      workspaceRoot: '/workspace'
    })
  })

  it('rejects cancellation when the automation run has no Agent Chat session', async () => {
    const runtime = {
      listSessions: vi.fn(),
      stopSession: vi.fn()
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(
      adapter.cancelRun({
        runId: 'run-1',
        workspaceRoot: '/workspace'
      })
    ).resolves.toMatchObject({
      accepted: false,
      diagnostic: {
        code: 'nativeSessionUnavailable'
      }
    })
    expect(runtime.stopSession).not.toHaveBeenCalled()
  })

  it('rejects no-workspace start and resume calls before creating Agent Chat sessions', async () => {
    const runtime = {
      createDraftSession: vi.fn(),
      listSessions: vi.fn(),
      resumeSession: vi.fn(),
      sendMessage: vi.fn(),
      subscribe: vi.fn(() => vi.fn())
    } as unknown as AgentChatRuntime
    const adapter = createAgentChatAutomationAdapter({ runtime })

    await expect(
      adapter.startRun({
        automationFlow: flow,
        automationFlowSnapshotId: 'snapshot-1',
        preferredAdapterSessionId: 'preferred-session',
        promptBundle: 'Find tasks',
        runId: 'run-1',
        runKind: 'discovery'
      })
    ).rejects.toThrow(/open workspace/i)
    await expect(
      adapter.resumeRun({
        adapterSessionId: 'session-1',
        promptBundle: 'Approved. Continue.',
        runId: 'run-1'
      })
    ).rejects.toThrow(/open workspace/i)
    expect(runtime.createDraftSession).not.toHaveBeenCalled()
    expect(runtime.resumeSession).not.toHaveBeenCalled()
  })
})
