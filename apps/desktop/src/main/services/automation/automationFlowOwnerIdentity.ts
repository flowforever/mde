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
  encodeURIComponent(value.trim())

export const createWorkspaceFlowOwnerKey = ({
  flowId,
  workspaceId
}: {
  readonly flowId: string
  readonly workspaceId: string
}): string =>
  `workspace:${normalizeIdentityPart(workspaceId)}:flow:${normalizeIdentityPart(flowId)}`

export const createGlobalFlowOwnerKey = ({
  flowId
}: {
  readonly flowId: string
}): string => `global:flow:${normalizeIdentityPart(flowId)}`

export const createAppliedGlobalFlowOwnerKey = ({
  flowId,
  workspaceId
}: {
  readonly flowId: string
  readonly workspaceId: string
}): string =>
  `workspace:${normalizeIdentityPart(workspaceId)}:applied-global:${normalizeIdentityPart(flowId)}`

export const createAutomationFlowOwnerKey = ({
  automationFlow,
  workspaceRoot
}: AutomationFlowOwnerIdentityInput): string => {
  return automationFlow.scope === 'user'
    ? createGlobalFlowOwnerKey({ flowId: automationFlow.id })
    : createWorkspaceFlowOwnerKey({
        flowId: automationFlow.id,
        workspaceId: workspaceRoot ?? ''
      })
}

const createLegacyStoredAutomationFlowOwnerKey = ({
  automationFlowId,
  workspaceRoot
}: {
  readonly automationFlowId: string
  readonly workspaceRoot?: string
}): string => {
  const normalizeLegacyIdentityPart = (value: string): string =>
    encodeURIComponent(value.trim()).replace(/%2F/giu, '/')

  return [
    'automation-flow',
    normalizeLegacyIdentityPart(automationFlowId),
    normalizeLegacyIdentityPart(`workspace:${workspaceRoot ?? ''}:`)
  ].join(':')
}

export const getStoredAutomationFlowOwnerKey = ({
  automationFlowId,
  automationFlowOwnerKey,
  workspaceRoot
}: StoredAutomationFlowOwnerIdentityInput): string =>
  automationFlowOwnerKey ??
  createLegacyStoredAutomationFlowOwnerKey({ automationFlowId, workspaceRoot })
