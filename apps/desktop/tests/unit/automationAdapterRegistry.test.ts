import { describe, expect, it } from 'vitest'

import {
  createAutomationAdapterRegistry,
  REQUIRED_RUN_CAPABILITIES
} from '../../src/main/services/automation/automationAdapterRegistry'
import {
  createFakeAgentCliAdapter,
  createMissingAgentCliAdapter
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

  it('blocks run start when required capabilities are unavailable', async () => {
    const registry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        capabilities: {
          mdeRuntimeTools: false
        },
        commandPath: '/usr/local/bin/codex',
        engine: 'codex'
      })
    ])

    await expect(registry.assertCanStartRun('codex', {})).rejects.toThrow(
      /required adapter capabilities/i
    )
  })
})
