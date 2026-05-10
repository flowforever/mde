import { describe, expect, test } from 'vitest'

import { parseAutomationFlowMarkdown } from '@mde/automation-flow'

const publicApiMarkdown = `---
id: public-api-flow
name: Public API Flow
status: formal
scope: workspace
sourceTypes:
  - workspace-markdown
loopPolicy:
  mode: manual
allowedEngines:
  - codex
defaultEngine: codex
reportPattern: Markdown summary.
---

# Public API Flow

## Pick Rules

Pick READY task files.

## Execution Standard

Keep implementation scoped.

## Acceptance Standard

The parsed flow is available through the public package export.

## Verification Expectations

Run package integration tests.

## Report Pattern

List verification evidence.
`

describe('automation-flow public parser contract', () => {
  test('parses through the package export without renderer globals', () => {
    expect('window' in globalThis).toBe(false)

    const result = parseAutomationFlowMarkdown(publicApiMarkdown)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.automationFlow).toMatchObject({
      defaultEngine: 'codex',
      id: 'public-api-flow',
      scope: 'workspace'
    })
  })
})
