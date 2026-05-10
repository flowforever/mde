import type {
  AutomationFlowConfirmationPolicy,
  AutomationFlowLoopPolicy,
  AutomationFlowMatchRules,
  AutomationFlowScope,
  AutomationFlowSourceType,
  AutomationFlowTemplate,
  AutomationFlowTemplateId,
  AutomationFlowTemplateRenderInputs,
  AutomationFlowTemplateSections,
  AgentEngineId
} from './types'

const workspaceMarkdownSourceTypes = Object.freeze([
  'workspace-markdown'
] as const satisfies readonly AutomationFlowSourceType[])

const userPromptSourceTypes = Object.freeze([
  'user-prompt'
] as const satisfies readonly AutomationFlowSourceType[])

const defaultAllowedEngines = Object.freeze([
  'codex',
  'claude-code'
] as const satisfies readonly AgentEngineId[])

const scopedInputDefinitions = Object.freeze([
  {
    id: 'scope',
    label: 'Scope',
    required: true,
    type: 'scope'
  },
  {
    id: 'defaultEngine',
    label: 'Default engine',
    required: true,
    type: 'engine'
  }
] as const)

const automationControlledConfirmationPolicy: AutomationFlowConfirmationPolicy =
  Object.freeze({
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  })

const manualApprovalConfirmationPolicy: AutomationFlowConfirmationPolicy =
  Object.freeze({
    fileWrites: 'require-user',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  })

const manualLoopPolicy: AutomationFlowLoopPolicy = Object.freeze({
  intervalMinutes: 15,
  maxActiveRuns: 1,
  mode: 'manual',
  onBlocked: 'pause-automation-flow',
  onEmpty: 'wait'
})

const continuousLoopPolicy: AutomationFlowLoopPolicy = Object.freeze({
  intervalMinutes: 15,
  maxActiveRuns: 1,
  mode: 'continuous',
  onBlocked: 'skip-and-continue',
  onEmpty: 'wait'
})

const readyTitleMatch: AutomationFlowMatchRules = Object.freeze({
  titleIncludes: ['READY']
})

const allWorkspaceTaskGlobs = Object.freeze([
  '.mde/docs/bugs/**/*.md',
  '.mde/docs/requirements/**/*.md',
  '.mde/docs/tasks/**/*.md'
] as const)

const createWorkspaceMatch = (
  taskPathGlobs: readonly string[]
): AutomationFlowMatchRules =>
  Object.freeze({
    taskPathGlobs,
    titleIncludes: readyTitleMatch.titleIncludes
  })

const createTemplate = (
  template: AutomationFlowTemplate
): AutomationFlowTemplate => Object.freeze(template)

const builtInTemplates = Object.freeze({
  'bug-fix': createTemplate({
    allowedScopes: ['workspace'],
    defaults: {
      allowedEngines: defaultAllowedEngines,
      confirmationPolicy: automationControlledConfirmationPolicy,
      defaultEngine: 'codex',
      loopPolicy: continuousLoopPolicy,
      match: createWorkspaceMatch(['.mde/docs/bugs/**/*.md']),
      pickOrder: ['.mde/docs/bugs/**/*.md'],
      priority: 60,
      reportPattern: 'bug-fix-verification-summary',
      sourceTypes: workspaceMarkdownSourceTypes
    },
    id: 'bug-fix',
    name: 'Bug Fix Automation Flow',
    requiredInputs: scopedInputDefinitions,
    sections: {
      acceptanceStandard:
        'Fix the documented defect without unrelated behavior changes.',
      executionStandard:
        'Reproduce or reason from the bug note, keep the patch scoped, and preserve unrelated local work.',
      pickRules:
        'Pick READY Markdown bug files under .mde/docs/bugs and skip done or archived paths.',
      reportPattern:
        'Report the root cause, changed files, verification evidence, and any release/user confirmation needed.',
      verificationExpectations:
        'Run focused regression coverage plus the owning package checks before reporting completion.'
    }
  }),
  'local-dev-task': createTemplate({
    allowedScopes: ['workspace'],
    defaults: {
      allowedEngines: defaultAllowedEngines,
      confirmationPolicy: automationControlledConfirmationPolicy,
      defaultEngine: 'codex',
      loopPolicy: manualLoopPolicy,
      match: createWorkspaceMatch(['.mde/docs/tasks/**/*.md']),
      pickOrder: ['.mde/docs/tasks/**/*.md'],
      priority: 40,
      reportPattern: 'local-dev-task-summary',
      sourceTypes: workspaceMarkdownSourceTypes
    },
    id: 'local-dev-task',
    name: 'Local Dev Task Automation Flow',
    requiredInputs: scopedInputDefinitions,
    sections: {
      acceptanceStandard:
        'Complete the requested local development task with no unrelated edits.',
      executionStandard:
        'Read the task, inspect the relevant code, implement conservatively, and preserve dirty work by others.',
      pickRules:
        'Pick READY Markdown task files under .mde/docs/tasks and skip done or archived paths.',
      reportPattern:
        'List changed files, important decisions, and verification outcomes.',
      verificationExpectations:
        'Run the package, app, or root checks that cover the changed surface.'
    }
  }),
  'manual-approval': createTemplate({
    allowedScopes: ['user', 'workspace'],
    defaults: {
      allowedEngines: defaultAllowedEngines,
      confirmationPolicy: manualApprovalConfirmationPolicy,
      defaultEngine: 'codex',
      loopPolicy: manualLoopPolicy,
      match: createWorkspaceMatch(allWorkspaceTaskGlobs),
      pickOrder: allWorkspaceTaskGlobs,
      priority: 80,
      reportPattern: 'manual-approval-summary',
      sourceTypes: workspaceMarkdownSourceTypes
    },
    id: 'manual-approval',
    name: 'Manual Approval Automation Flow',
    requiredInputs: scopedInputDefinitions,
    sections: {
      acceptanceStandard:
        'Proceed only after required approvals are captured and reflected in the report.',
      executionStandard:
        'Pause for user confirmation before file writes, external access, releases, or destructive actions.',
      pickRules:
        'Pick READY high-risk or unclear workspace Markdown tasks from the known .mde/docs queues.',
      reportPattern:
        'Summarize each approval, the resulting action, and verification evidence.',
      verificationExpectations:
        'Verify the approved action and include the approval context in the final report.'
    }
  }),
  'requirement-implementation': createTemplate({
    allowedScopes: ['workspace'],
    defaults: {
      allowedEngines: defaultAllowedEngines,
      confirmationPolicy: automationControlledConfirmationPolicy,
      defaultEngine: 'codex',
      loopPolicy: continuousLoopPolicy,
      match: createWorkspaceMatch(['.mde/docs/requirements/**/*.md']),
      pickOrder: ['.mde/docs/requirements/**/*.md'],
      priority: 50,
      reportPattern: 'requirement-implementation-summary',
      sourceTypes: workspaceMarkdownSourceTypes
    },
    id: 'requirement-implementation',
    name: 'Requirement Implementation Automation Flow',
    requiredInputs: scopedInputDefinitions,
    sections: {
      acceptanceStandard:
        'Implement the requirement against its acceptance criteria and document any user-manual impact.',
      executionStandard:
        'Trace the requirement, update the owning code and tests, and keep public docs aligned when behavior changes.',
      pickRules:
        'Pick READY Markdown requirement files under .mde/docs/requirements and skip done or archived paths.',
      reportPattern:
        'Report implemented behavior, acceptance coverage, manual/doc impact, and verification results.',
      verificationExpectations:
        'Include unit, integration, and E2E expectations for user-visible requirement work.'
    }
  }),
  'research-and-notes': createTemplate({
    allowedScopes: ['user'],
    defaults: {
      allowedEngines: defaultAllowedEngines,
      confirmationPolicy: Object.freeze({
        fileWrites: 'require-user',
        highRisk: 'require-user',
        unclearScope: 'require-user'
      }),
      defaultEngine: 'codex',
      loopPolicy: manualLoopPolicy,
      match: Object.freeze({
        promptTags: ['research', 'notes']
      }),
      pickOrder: [],
      priority: 30,
      reportPattern: 'research-notes-report',
      sourceTypes: userPromptSourceTypes
    },
    id: 'research-and-notes',
    name: 'Research and Notes Automation Flow',
    requiredInputs: scopedInputDefinitions,
    sections: {
      acceptanceStandard:
        'Produce a cited or evidence-backed note without making code changes by default.',
      executionStandard:
        'Research the requested sources, separate facts from inference, and preserve open questions.',
      pickRules:
        'Pick ready user-global prompts tagged research or notes.',
      reportPattern:
        'Save or return a concise note with sources, findings, and follow-up actions.',
      verificationExpectations:
        'Verify source links, command outputs, or local evidence used in the note.'
    }
  })
} as const satisfies Record<AutomationFlowTemplateId, AutomationFlowTemplate>)

const yamlScalar = (value: string | number): string =>
  typeof value === 'number' ? String(value) : JSON.stringify(value)

const renderYamlStringArray = (
  fieldName: string,
  values: readonly string[]
): string => {
  if (values.length === 0) {
    return `${fieldName}: []`
  }

  return [`${fieldName}:`, ...values.map((value) => `  - ${yamlScalar(value)}`)].join(
    '\n'
  )
}

const renderMatchYaml = (match: AutomationFlowMatchRules): string => {
  const lines = ['match:']

  if (match.promptTags !== undefined) {
    lines.push(
      renderYamlStringArray('  promptTags', match.promptTags).replace(
        /\n/gu,
        '\n  '
      )
    )
  }

  if (match.taskPathGlobs !== undefined) {
    lines.push(
      renderYamlStringArray('  taskPathGlobs', match.taskPathGlobs).replace(
        /\n/gu,
        '\n  '
      )
    )
  }

  if (match.titleIncludes !== undefined) {
    lines.push(
      renderYamlStringArray('  titleIncludes', match.titleIncludes).replace(
        /\n/gu,
        '\n  '
      )
    )
  }

  return lines.length === 1 ? 'match: {}' : lines.join('\n')
}

const renderLoopPolicyYaml = (loopPolicy: AutomationFlowLoopPolicy): string =>
  [
    'loopPolicy:',
    `  mode: ${yamlScalar(loopPolicy.mode)}`,
    `  intervalMinutes: ${yamlScalar(loopPolicy.intervalMinutes)}`,
    `  maxActiveRuns: ${yamlScalar(loopPolicy.maxActiveRuns)}`,
    `  onEmpty: ${yamlScalar(loopPolicy.onEmpty)}`,
    `  onBlocked: ${yamlScalar(loopPolicy.onBlocked)}`
  ].join('\n')

const renderConfirmationPolicyYaml = (
  confirmationPolicy: AutomationFlowConfirmationPolicy
): string =>
  [
    'confirmationPolicy:',
    `  highRisk: ${yamlScalar(confirmationPolicy.highRisk)}`,
    `  unclearScope: ${yamlScalar(confirmationPolicy.unclearScope)}`,
    `  fileWrites: ${yamlScalar(confirmationPolicy.fileWrites)}`
  ].join('\n')

const mergeTemplateMatch = (
  templateMatch: AutomationFlowMatchRules,
  inputs: AutomationFlowTemplateRenderInputs
): AutomationFlowMatchRules =>
  Object.freeze({
    promptTags: inputs.promptTags ?? templateMatch.promptTags,
    taskPathGlobs: inputs.taskPathGlobs ?? templateMatch.taskPathGlobs,
    titleIncludes: inputs.titleIncludes ?? templateMatch.titleIncludes
  })

const resolveAllowedEngines = (
  template: AutomationFlowTemplate,
  inputs: AutomationFlowTemplateRenderInputs
): readonly AgentEngineId[] => {
  const allowedEngines = inputs.allowedEngines ?? template.defaults.allowedEngines
  const defaultEngine = inputs.defaultEngine ?? template.defaults.defaultEngine

  return allowedEngines.includes(defaultEngine)
    ? allowedEngines
    : Object.freeze([...allowedEngines, defaultEngine])
}

const assertScopeAllowed = (
  template: AutomationFlowTemplate,
  scope: AutomationFlowScope
): void => {
  if (!template.allowedScopes.includes(scope)) {
    throw new Error(
      `Template "${template.id}" does not support "${scope}" scope.`
    )
  }
}

const resolveTemplateDefaults = (
  template: AutomationFlowTemplate,
  inputs: AutomationFlowTemplateRenderInputs
): AutomationFlowTemplate['defaults'] => {
  if (template.id === 'manual-approval' && inputs.scope === 'user') {
    return Object.freeze({
      ...template.defaults,
      match: Object.freeze({
        promptTags: inputs.promptTags ?? ['approval']
      }),
      pickOrder: [],
      sourceTypes: userPromptSourceTypes
    })
  }

  return template.defaults
}

const resolveTemplateSections = (
  template: AutomationFlowTemplate,
  inputs: AutomationFlowTemplateRenderInputs
): AutomationFlowTemplateSections => {
  if (template.id === 'manual-approval' && inputs.scope === 'user') {
    return Object.freeze({
      ...template.sections,
      pickRules:
        'Pick ready user prompts tagged approval or the configured prompt tags, then pause until approval is explicit.'
    })
  }

  return template.sections
}

const renderSections = (
  templateName: string,
  sections: AutomationFlowTemplateSections
): string =>
  [
    `# ${templateName}`,
    '',
    '## Pick Rules',
    '',
    sections.pickRules,
    '',
    '## Execution Standard',
    '',
    sections.executionStandard,
    '',
    '## Acceptance Standard',
    '',
    sections.acceptanceStandard,
    '',
    '## Verification Expectations',
    '',
    sections.verificationExpectations,
    '',
    '## Report Pattern',
    '',
    sections.reportPattern,
    ''
  ].join('\n')

export const listBuiltInAutomationFlowTemplates =
  (): readonly AutomationFlowTemplate[] =>
    Object.freeze(Object.values(builtInTemplates))

export const getBuiltInAutomationFlowTemplate = (
  templateId: AutomationFlowTemplateId
): AutomationFlowTemplate => builtInTemplates[templateId]

export const renderAutomationFlowTemplate = (
  template: AutomationFlowTemplate,
  inputs: AutomationFlowTemplateRenderInputs
): string => {
  assertScopeAllowed(template, inputs.scope)

  const defaults = resolveTemplateDefaults(template, inputs)
  const templateWithResolvedDefaults = Object.freeze({
    ...template,
    defaults
  })
  const allowedEngines = resolveAllowedEngines(templateWithResolvedDefaults, inputs)
  const defaultEngine = inputs.defaultEngine ?? defaults.defaultEngine
  const flowId = inputs.flowId ?? template.id
  const name = inputs.name ?? template.name
  const match = mergeTemplateMatch(defaults.match, inputs)
  const sections = resolveTemplateSections(template, inputs)

  return [
    '---',
    `id: ${yamlScalar(flowId)}`,
    `name: ${yamlScalar(name)}`,
    'status: formal',
    'lifecycle: enabled',
    `scope: ${yamlScalar(inputs.scope)}`,
    renderYamlStringArray('sourceTypes', defaults.sourceTypes),
    `priority: ${yamlScalar(defaults.priority)}`,
    renderMatchYaml(match),
    renderYamlStringArray('pickOrder', defaults.pickOrder),
    renderLoopPolicyYaml(defaults.loopPolicy),
    renderYamlStringArray('allowedEngines', allowedEngines),
    `defaultEngine: ${yamlScalar(defaultEngine)}`,
    renderConfirmationPolicyYaml(defaults.confirmationPolicy),
    `reportPattern: ${yamlScalar(defaults.reportPattern)}`,
    '---',
    '',
    renderSections(name, sections)
  ].join('\n')
}
