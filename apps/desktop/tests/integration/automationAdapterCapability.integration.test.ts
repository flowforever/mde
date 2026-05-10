import { describe, expect, it } from 'vitest'

import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import { createFakeAgentCliAdapter } from '../../src/main/services/automation/agentCliAdapters'

describe('automation adapter capability integration', () => {
  it('probes fake adapters without executing real Codex or Claude processes', async () => {
    const registry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        authenticated: true,
        commandPath: '/fake/bin/codex',
        engine: 'codex',
        version: '2.0.0',
        workspaceSupported: true
      })
    ])

    const report = await registry.probe('codex', {
      workspaceRoot: '/workspace'
    })

    expect(report).toMatchObject({
      authenticated: true,
      commandPath: '/fake/bin/codex',
      detected: true,
      engine: 'codex',
      verdict: 'full',
      version: '2.0.0',
      workspaceSupported: true
    })
    expect(report.capabilities).toMatchObject({
      automationFlowAuthoring: true,
      autonomyGate: true,
      cancellation: true,
      evidenceCapture: true,
      fileMutation: true,
      mdeRuntimeTools: true,
      nonInteractiveRun: true,
      openNativeSession: true,
      permissionMode: true,
      runScopedRuntimeAuthorization: true,
      schemaConstrainedFinalOutput: true,
      sessionContinuation: true,
      sessionId: true,
      stdoutJsonlFallback: true,
      structuredEventStream: true,
      workingDirectory: true
    })
  })
})
