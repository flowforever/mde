import type { AutomationStoredRun } from './automationStore'
import type { AutomationRunLockIdentity } from '../../../shared/automationRuntime'

export interface AutomationRunLockValidation {
  readonly ok: boolean
  readonly reason?: string
}

const identityFields = Object.freeze([
  'profileId',
  'workspaceScope',
  'automationFlowId',
  'sourceItemId',
  'taskId'
] as const satisfies readonly (keyof AutomationRunLockIdentity)[])

const unsafeIdentityPattern = /::|\r|\n|\0/u

export const validateAutomationRunLockIdentity = (
  identity: AutomationRunLockIdentity
): AutomationRunLockValidation => {
  for (const field of identityFields) {
    const value = identity[field].trim()

    if (value.length === 0) {
      return Object.freeze({
        ok: false,
        reason: `${field} is required`
      })
    }

    if (unsafeIdentityPattern.test(value)) {
      return Object.freeze({
        ok: false,
        reason: `${field} contains unsafe characters`
      })
    }
  }

  return Object.freeze({ ok: true })
}

export const createAutomationRunLockKey = (
  identity: AutomationRunLockIdentity
): string => {
  const validation = validateAutomationRunLockIdentity(identity)

  if (!validation.ok) {
    throw new Error(validation.reason ?? 'Invalid automation run lock identity')
  }

  return identityFields.map((field) => identity[field].trim()).join('::')
}

export const isAutomationRunLockActive = (run: AutomationStoredRun): boolean =>
  run.state === 'starting' ||
  run.state === 'running' ||
  run.state === 'needs-me' ||
  run.recoverable
