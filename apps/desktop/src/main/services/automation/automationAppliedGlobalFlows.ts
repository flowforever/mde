import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  createAutomationFlowDiagnostic,
  type AutomationFlowDiagnostic
} from '@mde/automation-flow'

import { getWorkspaceAutomationFlowRoot } from './automationPathSafety'

const APPLIED_GLOBAL_FLOW_REFS_FILE = '.applied-global-flows.json'

interface AppliedGlobalFlowRefsFile {
  readonly flowIds: readonly string[]
  readonly version: 1
}

const refsPathForWorkspace = (workspaceRoot: string): string =>
  join(
    getWorkspaceAutomationFlowRoot(workspaceRoot),
    APPLIED_GLOBAL_FLOW_REFS_FILE
  )

const createInvalidRefsDiagnostic = (
  technicalMessage: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code: 'automationFlow.invalidAppliedGlobalRefs',
    messageKey: 'automationFlow.diagnostics.invalidAppliedGlobalRefs',
    severity: 'warning',
    technicalMessage
  })

const isAppliedGlobalFlowRefsFile = (
  value: unknown
): value is AppliedGlobalFlowRefsFile =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (value as { version?: unknown }).version === 1 &&
  Array.isArray((value as { flowIds?: unknown }).flowIds) &&
  (value as { flowIds: unknown[] }).flowIds.every(
    (flowId) => typeof flowId === 'string' && flowId.trim().length > 0
  )

export const loadAppliedGlobalFlowRefs = async (
  workspaceRoot: string
): Promise<{
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly flowIds: readonly string[]
}> => {
  try {
    const raw = await readFile(refsPathForWorkspace(workspaceRoot), 'utf8')
    const parsed: unknown = JSON.parse(raw)

    if (!isAppliedGlobalFlowRefsFile(parsed)) {
      return Object.freeze({
        diagnostics: Object.freeze([
          createInvalidRefsDiagnostic('Applied global flow refs file is invalid.')
        ]),
        flowIds: Object.freeze([])
      })
    }

    return Object.freeze({
      diagnostics: Object.freeze([]),
      flowIds: Object.freeze([...new Set(parsed.flowIds)].sort())
    })
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return Object.freeze({
        diagnostics: Object.freeze([]),
        flowIds: Object.freeze([])
      })
    }

    return Object.freeze({
      diagnostics: Object.freeze([
        createInvalidRefsDiagnostic(
          error instanceof Error ? error.message : 'Unable to read refs file.'
        )
      ]),
      flowIds: Object.freeze([])
    })
  }
}

export const saveAppliedGlobalFlowRefs = async (
  workspaceRoot: string,
  flowIds: readonly string[]
): Promise<void> => {
  const refsPath = refsPathForWorkspace(workspaceRoot)
  const data: AppliedGlobalFlowRefsFile = {
    flowIds: Object.freeze([...new Set(flowIds)].sort()),
    version: 1
  }

  await mkdir(dirname(refsPath), { recursive: true })
  await writeFile(refsPath, `${JSON.stringify(data, null, 2)}\n`)
}
