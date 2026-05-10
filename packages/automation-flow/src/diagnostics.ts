import type { AutomationFlowDiagnostic } from './types'

export const AUTOMATION_FLOW_DIAGNOSTIC_CODES = Object.freeze({
  defaultEngineNotAllowed: 'automationFlow.defaultEngineNotAllowed',
  invalidField: 'automationFlow.invalidField',
  invalidFrontmatter: 'automationFlow.invalidFrontmatter',
  missingFrontmatter: 'automationFlow.missingFrontmatter',
  missingRequiredField: 'automationFlow.missingRequiredField',
  missingRequiredSection: 'automationFlow.missingRequiredSection',
  ownershipTie: 'automationFlow.ownershipTie',
  templateMissingRequiredInput: 'automationFlow.templateMissingRequiredInput'
})

export const createAutomationFlowDiagnostic = (
  diagnostic: AutomationFlowDiagnostic
): AutomationFlowDiagnostic => Object.freeze({ ...diagnostic })

export const createMissingRequiredFieldDiagnostic = (
  missingField: string,
  sourceFile?: string,
  technicalMessage?: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.missingRequiredField,
    messageKey: 'automationFlow.diagnostics.missingRequiredField',
    missingField,
    severity: 'error',
    sourceFile,
    technicalMessage
  })

export const createInvalidFieldDiagnostic = (
  missingField: string,
  sourceFile?: string,
  technicalMessage?: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.invalidField,
    messageKey: 'automationFlow.diagnostics.invalidField',
    missingField,
    severity: 'error',
    sourceFile,
    technicalMessage
  })

export const createMissingRequiredSectionDiagnostic = (
  sectionName: string,
  sourceFile?: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.missingRequiredSection,
    messageKey: 'automationFlow.diagnostics.missingRequiredSection',
    sectionName,
    severity: 'error',
    sourceFile
  })

export const createInvalidFrontmatterDiagnostic = (
  sourceFile?: string,
  technicalMessage?: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.invalidFrontmatter,
    messageKey: 'automationFlow.diagnostics.invalidFrontmatter',
    severity: 'error',
    sourceFile,
    technicalMessage
  })

export const createMissingFrontmatterDiagnostic = (
  sourceFile?: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.missingFrontmatter,
    messageKey: 'automationFlow.diagnostics.missingFrontmatter',
    severity: 'error',
    sourceFile
  })

export const createDefaultEngineNotAllowedDiagnostic = (
  defaultEngine: string,
  sourceFile?: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.defaultEngineNotAllowed,
    messageKey: 'automationFlow.diagnostics.defaultEngineNotAllowed',
    missingField: 'defaultEngine',
    severity: 'error',
    sourceFile,
    technicalMessage: `defaultEngine "${defaultEngine}" must be listed in allowedEngines.`
  })

export const createAutomationFlowOwnershipTieDiagnostic = (
  sourceFile: string | undefined,
  automationFlowIds: readonly string[]
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.ownershipTie,
    messageKey: 'automationFlow.diagnostics.ownershipTie',
    severity: 'warning',
    sourceFile,
    technicalMessage: `Multiple automation-flows have equal ownership priority: ${automationFlowIds.join(', ')}.`
  })

export const createTemplateMissingRequiredInputDiagnostic = (
  missingField: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: AUTOMATION_FLOW_DIAGNOSTIC_CODES.templateMissingRequiredInput,
    messageKey: 'automationFlow.diagnostics.templateMissingRequiredInput',
    missingField,
    severity: 'error'
  })
