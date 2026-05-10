import { describe, expect, test } from 'vitest'

import { parseAutomationFlowMarkdown } from './parser'

const validAutomationFlowMarkdown = `---
id: local-dev-task
name: Local Dev Task
status: formal
scope: workspace
sourceTypes:
  - workspace-markdown
priority: 5
match:
  taskPathGlobs:
    - .mde/docs/tasks/**/*.md
  titleIncludes:
    - READY
loopPolicy:
  mode: continuous
  intervalMinutes: 15
  maxActiveRuns: 1
  onEmpty: wait
  onBlocked: skip-and-continue
allowedEngines:
  - codex
  - claude-code
defaultEngine: codex
reportPattern: Concise Markdown summary with verification evidence.
---

# Local Dev Task Flow

## Pick Rules

Pick ready local Markdown task files.

## Execution Standard

Follow the task plan and keep changes scoped.

## Acceptance Standard

The requested behavior is implemented without unrelated changes.

## Verification Expectations

Run package tests and root typecheck.

## Report Pattern

List changed files and verification outcomes.
`

describe('parseAutomationFlowMarkdown', () => {
  test('parses YAML frontmatter and required Markdown sections', () => {
    const result = parseAutomationFlowMarkdown(validAutomationFlowMarkdown, {
      sourceFile: '/workspace/.mde/automation-flows/local-dev-task.md'
    })

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])

    if (!result.ok) {
      return
    }

    expect(result.automationFlow).toMatchObject({
      allowedEngines: ['codex', 'claude-code'],
      defaultEngine: 'codex',
      id: 'local-dev-task',
      lifecycle: 'enabled',
      name: 'Local Dev Task',
      priority: 5,
      scope: 'workspace',
      sourceFile: '/workspace/.mde/automation-flows/local-dev-task.md',
      sourceTypes: ['workspace-markdown'],
      status: 'formal'
    })
    expect(result.automationFlow.sections).toMatchObject({
      acceptanceStandard: 'The requested behavior is implemented without unrelated changes.',
      executionStandard: 'Follow the task plan and keep changes scoped.',
      pickRules: 'Pick ready local Markdown task files.',
      reportPattern: 'List changed files and verification outcomes.',
      verificationExpectations: 'Run package tests and root typecheck.'
    })
  })

  test('returns structured diagnostics when required frontmatter is missing', () => {
    const result = parseAutomationFlowMarkdown(
      validAutomationFlowMarkdown.replace('\ndefaultEngine: codex', '')
    )

    expect(result).toMatchObject({
      ok: false
    })
    expect(result.diagnostics[0]?.messageKey).toEqual(expect.any(String))
    expect(result.diagnostics[0]).toMatchObject({
      code: 'automationFlow.missingRequiredField',
      missingField: 'defaultEngine',
      severity: 'error'
    })
  })

  test('returns invalid field diagnostics when frontmatter has the wrong type', () => {
    const result = parseAutomationFlowMarkdown(
      validAutomationFlowMarkdown.replace('\npriority: 5', '\npriority: high')
    )

    expect(result).toMatchObject({
      ok: false
    })
    expect(result.diagnostics[0]?.messageKey).toEqual(expect.any(String))
    expect(result.diagnostics[0]).toMatchObject({
      code: 'automationFlow.invalidField',
      missingField: 'priority',
      severity: 'error'
    })
  })

  test('returns invalid field diagnostics when frontmatter array entries have the wrong type', () => {
    const result = parseAutomationFlowMarkdown(
      validAutomationFlowMarkdown.replace('  - claude-code', '  - 1')
    )

    expect(result).toMatchObject({
      ok: false
    })
    expect(result.diagnostics[0]?.messageKey).toEqual(expect.any(String))
    expect(result.diagnostics[0]).toMatchObject({
      code: 'automationFlow.invalidField',
      missingField: 'allowedEngines.1',
      severity: 'error'
    })
  })

  test('returns structured diagnostics when a required section is missing', () => {
    const result = parseAutomationFlowMarkdown(
      validAutomationFlowMarkdown.replace(
        '\n## Verification Expectations\n\nRun package tests and root typecheck.\n',
        '\n'
      )
    )

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.messageKey).toEqual(expect.any(String))
    expect(result.diagnostics[0]).toMatchObject({
      code: 'automationFlow.missingRequiredSection',
      sectionName: 'Verification Expectations',
      severity: 'error'
    })
  })

  test('returns structured diagnostics instead of throwing for invalid YAML', () => {
    const result = parseAutomationFlowMarkdown(`---
id: invalid
allowedEngines: [codex
---

## Pick Rules

Pick.

## Execution Standard

Execute.

## Acceptance Standard

Accept.

## Verification Expectations

Verify.

## Report Pattern

Report.
`)

    expect(result.diagnostics[0]?.messageKey).toEqual(expect.any(String))
    expect(result).toMatchObject({
      diagnostics: [
        {
          code: 'automationFlow.invalidFrontmatter',
          severity: 'error'
        }
      ],
      ok: false
    })
  })
})
