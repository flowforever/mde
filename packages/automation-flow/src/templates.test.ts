import { describe, expect, test } from 'vitest'

import { parseAutomationFlowMarkdown } from './parser'
import {
  getBuiltInAutomationFlowTemplate,
  renderAutomationFlowTemplate
} from './templates'

const templateCases = [
  ['local-dev-task', 'Local Dev Task Automation Flow'],
  ['bug-fix', 'Bug Fix Automation Flow'],
  ['requirement-implementation', 'Requirement Implementation Automation Flow'],
  ['research-and-notes', 'Research and Notes Automation Flow'],
  ['manual-approval', 'Manual Approval Automation Flow']
] as const

describe('built-in automation-flow templates', () => {
  test.each(templateCases)(
    'renders parseable Markdown for %s',
    (templateId, expectedName) => {
      const template = getBuiltInAutomationFlowTemplate(templateId)
      const markdown = renderAutomationFlowTemplate(template, {
        defaultEngine: 'codex',
        flowId: `${templateId}-workspace`,
        scope: template.allowedScopes[0]
      })
      const result = parseAutomationFlowMarkdown(markdown, {
        sourceFile: `/workspace/.mde/automation-flows/${templateId}.md`
      })

      expect(template.name).toBe(expectedName)
      expect(result.ok).toBe(true)

      if (!result.ok) {
        return
      }

      expect(result.automationFlow).toMatchObject({
        defaultEngine: 'codex',
        id: `${templateId}-workspace`,
        name: expectedName,
        status: 'formal'
      })
    }
  )

  test('renders manual approval user-scope flows for user prompts', () => {
    const template = getBuiltInAutomationFlowTemplate('manual-approval')
    const markdown = renderAutomationFlowTemplate(template, {
      defaultEngine: 'codex',
      flowId: 'manual-user-approval',
      scope: 'user'
    })
    const result = parseAutomationFlowMarkdown(markdown)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.automationFlow).toMatchObject({
      id: 'manual-user-approval',
      match: {
        promptTags: ['approval']
      },
      pickOrder: [],
      scope: 'user',
      sourceTypes: ['user-prompt']
    })
    expect(result.automationFlow.match.taskPathGlobs).toBeUndefined()
    expect(result.automationFlow.sections.pickRules).toContain('user prompts')
    expect(markdown).not.toContain('workspace Markdown')
    expect(markdown).not.toContain('.mde/docs')
  })
})
