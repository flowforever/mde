import type { AutomationFlow, ParsedAutomationFlow } from '@mde/automation-flow'

interface AutomationFlowOwnerIdentityInput {
  readonly automationFlow: AutomationFlow | ParsedAutomationFlow
  readonly workspaceRoot?: string
}

interface StoredAutomationFlowOwnerIdentityInput {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly workspaceRoot?: string
}

const normalizeIdentityPart = (value: string): string =>
  encodeURIComponent(value.trim()).replace(/%2F/giu, '/')

export const createAutomationFlowOwnerKey = ({
  automationFlow,
  workspaceRoot
}: AutomationFlowOwnerIdentityInput): string => {
  const sourceFile =
    'sourceFile' in automationFlow ? automationFlow.sourceFile : undefined
  const ownerScope =
    automationFlow.scope === 'user'
      ? `user:${sourceFile ?? ''}`
      : `workspace:${workspaceRoot ?? ''}:${sourceFile ?? ''}`

  return [
    'automation-flow',
    normalizeIdentityPart(automationFlow.id),
    normalizeIdentityPart(ownerScope)
  ].join(':')
}

export const getStoredAutomationFlowOwnerKey = ({
  automationFlowId,
  automationFlowOwnerKey,
  workspaceRoot
}: StoredAutomationFlowOwnerIdentityInput): string =>
  automationFlowOwnerKey ??
  [
    'automation-flow',
    normalizeIdentityPart(automationFlowId),
    normalizeIdentityPart(`workspace:${workspaceRoot ?? ''}:`)
  ].join(':')
