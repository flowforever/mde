import { describe, expect, it } from 'vitest'

import {
  AutomationAdapterCapabilityError,
  createAutomationAdapterRegistry,
  REQUIRED_RUN_CAPABILITIES
} from '../../src/main/services/automation/automationAdapterRegistry'
import {
  createFakeAgentCliAdapter,
  createMissingAgentCliAdapter,
  type AgentCliAdapter
} from '../../src/main/services/automation/agentCliAdapters'

describe('automationAdapterRegistry', () => {
  it('returns full capability verdicts for full-featured fake adapters', async () => {
    const registry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        commandPath: '/usr/local/bin/codex',
        engine: 'codex',
        version: '1.0.0'
      })
    ])

    const report = await registry.probe('codex', {
      workspaceRoot: '/workspace'
    })

    expect(report).toMatchObject({
      authenticated: true,
      commandPath: '/usr/local/bin/codex',
      diagnostics: [],
      engine: 'codex',
      verdict: 'full',
      version: '1.0.0',
      workspaceSupported: true
    })
    expect(REQUIRED_RUN_CAPABILITIES.every((key) => report.capabilities[key])).toBe(
      true
    )
  })

  it('returns setup diagnostics for missing or limited adapters', async () => {
    const limitedRegistry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        capabilities: {
          mdeRuntimeTools: false,
          structuredEventStream: false
        },
        commandPath: '/usr/local/bin/claude',
        engine: 'claude-code'
      })
    ])
    const missingRegistry = createAutomationAdapterRegistry([
      createMissingAgentCliAdapter('codex')
    ])
    const limitedReport = await limitedRegistry.probe('claude-code', {})
    const missingReport = await missingRegistry.probe('codex', {})

    expect(limitedReport.verdict).toBe('limited')
    expect(limitedReport.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'automationAdapter.missingRequiredCapability',
          messageKey: 'automationAdapter.diagnostics.missingRequiredCapability'
        })
      ])
    )
    expect(missingReport).toMatchObject({
      detected: false,
      diagnostics: [
        {
          code: 'automationAdapter.missingExecutable',
          messageKey: 'automationAdapter.diagnostics.missingExecutable'
        }
      ],
      verdict: 'unsupported'
    })
  })

  it('blocks run start with structured diagnostics when required capabilities are unavailable', async () => {
    const registry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        capabilities: {
          mdeRuntimeTools: false
        },
        commandPath: '/usr/local/bin/codex',
        engine: 'codex'
      })
    ])

    await expect(registry.assertCanStartRun('codex', {})).rejects.toMatchObject({
      diagnostics: [
        expect.objectContaining({
          code: 'automationAdapter.missingRequiredCapability'
        })
      ],
      missingRequiredCapabilities: ['mdeRuntimeTools'],
      reason: 'missing-required-capability'
    })
  })

  it('blocks run start with an authentication-required diagnostic when adapter authentication is unavailable', async () => {
    const registry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        authenticated: false,
        commandPath: '/usr/local/bin/codex',
        engine: 'codex'
      })
    ])

    try {
      await registry.assertCanStartRun('codex', { workspaceRoot: '/workspace' })
      throw new Error('Expected assertCanStartRun to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(AutomationAdapterCapabilityError)
      expect(error).toMatchObject({
        diagnostics: [
          {
            code: 'automationAdapter.authenticationRequired',
            messageKey: 'automationAdapter.diagnostics.authenticationRequired'
          }
        ],
        reason: 'authentication-required',
        report: {
          authenticated: false,
          engine: 'codex',
          verdict: 'unsupported'
        }
      })
    }
  })

  it('does not collapse protocol-unsupported adapters into authentication-required', async () => {
    const fullFakeAdapter = createFakeAgentCliAdapter({
      commandPath: '/usr/local/bin/codex',
      engine: 'codex'
    })
    const adapter: AgentCliAdapter = Object.freeze({
      ...fullFakeAdapter,
      probe: async () =>
        Object.freeze({
          authenticated: true,
          capabilities: Object.freeze(
            Object.fromEntries(
              Object.keys((await fullFakeAdapter.probe({})).capabilities).map(
                (key) => [key, false]
              )
            ) as Record<keyof Awaited<ReturnType<typeof fullFakeAdapter.probe>>['capabilities'], boolean>
          ),
          checkedAt: new Date(0).toISOString(),
          detected: true,
          diagnostics: Object.freeze([
            {
              code: 'protocol-unsupported',
              diagnosticId: 'agent-chat-automation:protocol-unsupported',
              message: 'Codex protocol is unsupported.',
              messageKey: 'automationAdapter.diagnostics.protocol-unsupported',
              severity: 'error' as const,
              technicalMessage: 'Codex protocol is unsupported.'
            }
          ]),
          engine: 'codex',
          verdict: 'unsupported',
          workspaceSupported: true
        })
    })
    const registry = createAutomationAdapterRegistry([adapter])

    await expect(
      registry.assertCanStartRun('codex', { workspaceRoot: '/workspace' })
    ).rejects.toMatchObject({
      diagnostics: [
        {
          code: 'protocol-unsupported'
        }
      ],
      reason: 'missing-required-capability'
    })
  })
})
