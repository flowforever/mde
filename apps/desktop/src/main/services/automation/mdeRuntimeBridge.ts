import type { AutomationDiagnostic } from '../../../shared/automation'
import {
  assertAutomationEvidencePath,
  assertAutomationRunWorkspacePath
} from './automationPathSafety'

type RuntimeToolName =
  | 'apply_source_patch'
  | 'report_phase_update'
  | 'update_task_status'

interface RuntimeBridgeOptions {
  readonly appDataPath: string
  readonly now?: () => number
  readonly tokenTtlMs?: number
}

interface RegisteredRun {
  readonly archived?: boolean
  readonly automationFlowSnapshotId: string
  readonly registeredAt?: number
  readonly runId: string
  readonly sourceItemId: string
  readonly sourcePath: string
  readonly taskId: string
  readonly token: string
  readonly workspaceRoot: string
}

interface RuntimeToolCall {
  readonly automationFlowSnapshotId: string
  readonly evidencePath?: string
  readonly message?: string
  readonly patch?: string
  readonly runId: string
  readonly sourceItemId: string
  readonly targetPath?: string
  readonly taskId: string
  readonly token: string
  readonly toolName: RuntimeToolName
}

interface RuntimeToolEvent {
  readonly createdAt: number
  readonly evidencePath?: string
  readonly message?: string
  readonly reason?: string
  readonly runId: string
  readonly toolName: RuntimeToolName
}

interface RuntimeToolResult {
  readonly accepted: boolean
  readonly diagnostic?: AutomationDiagnostic
  readonly reason?: string
}

export interface MdeRuntimeBridge {
  readonly handleRuntimeToolCall: (
    call: RuntimeToolCall
  ) => Promise<RuntimeToolResult>
  readonly listEvents: () => readonly RuntimeToolEvent[]
  readonly registerRun: (run: RegisteredRun) => void
}

const redactSensitiveText = (text: string): string =>
  text
    .replace(
      /\b(?:authorization:\s*bearer|api[_-]?key|password|token)\s*[:=]\s*[^\s,;]+/giu,
      (match) => `${match.split(/[:=]/u)[0]}=[redacted]`
    )
    .replace(/\bBearer\s+[^\s,;]+/giu, 'Bearer [redacted]')

const createBridgeDiagnostic = (
  reason: string,
  technicalMessage: string
): AutomationDiagnostic =>
  Object.freeze({
    code: `automationRuntime.${reason}`,
    diagnosticId: `runtime:${reason}`,
    message: 'Runtime tool call rejected.',
    messageKey: 'automationRuntime.diagnostics.toolCallRejected',
    severity: 'error',
    technicalMessage: redactSensitiveText(technicalMessage)
  })

export const createMdeRuntimeBridge = ({
  appDataPath,
  now = () => Date.now(),
  tokenTtlMs = 15 * 60 * 1000
}: RuntimeBridgeOptions): MdeRuntimeBridge => {
  const runs = new Map<string, RegisteredRun>()
  const events: RuntimeToolEvent[] = []

  const rejectCall = (
    call: RuntimeToolCall,
    reason: string,
    technicalMessage: string
  ): RuntimeToolResult => {
    events.push(
      Object.freeze({
        createdAt: now(),
        message: redactSensitiveText(technicalMessage),
        reason,
        runId: call.runId,
        toolName: call.toolName
      })
    )

    return Object.freeze({
      accepted: false,
      diagnostic: createBridgeDiagnostic(reason, technicalMessage),
      reason
    })
  }

  const authorizeCall = (
    call: RuntimeToolCall
  ): RuntimeToolResult & { readonly run?: RegisteredRun } => {
    const run = runs.get(call.runId)

    if (run === undefined) {
      return rejectCall(call, 'unknown-run', 'Runtime run is not registered.')
    }

    if (run.token !== call.token) {
      return rejectCall(call, 'invalid-token', 'Runtime token mismatch.')
    }

    if (now() - (run.registeredAt ?? now()) > tokenTtlMs) {
      return rejectCall(call, 'expired-token', 'Runtime token expired.')
    }

    if (run.automationFlowSnapshotId !== call.automationFlowSnapshotId) {
      return rejectCall(
        call,
        'snapshot-mismatch',
        'Automation flow snapshot mismatch.'
      )
    }

    if (run.sourceItemId !== call.sourceItemId) {
      return rejectCall(call, 'source-mismatch', 'Source item mismatch.')
    }

    if (run.taskId !== call.taskId) {
      return rejectCall(call, 'task-mismatch', 'Task id mismatch.')
    }

    if (run.archived === true) {
      return rejectCall(call, 'archived-source', 'Source item is archived.')
    }

    return Object.freeze({
      accepted: true,
      run
    })
  }

  const bridge: MdeRuntimeBridge = {
    async handleRuntimeToolCall(call: RuntimeToolCall) {
      const authorization = authorizeCall(call)

      if (!authorization.accepted || authorization.run === undefined) {
        return authorization
      }

      if (call.toolName === 'apply_source_patch') {
        if (call.targetPath === undefined) {
          return rejectCall(
            call,
            'missing-target-path',
            call.patch ?? 'Source patch target is missing.'
          )
        }

        try {
          await assertAutomationRunWorkspacePath(
            authorization.run.workspaceRoot,
            call.targetPath
          )
        } catch {
          return rejectCall(
            call,
            'unsafe-target-path',
            call.patch ?? 'Source patch target is outside the run workspace.'
          )
        }
      }

      if (call.toolName === 'report_phase_update') {
        let evidencePath: string | undefined

        try {
          evidencePath = await assertAutomationEvidencePath({
            appDataPath,
            targetPath: call.evidencePath ?? authorization.run.workspaceRoot,
            workspaceRoot: authorization.run.workspaceRoot
          })
        } catch {
          return rejectCall(
            call,
            'unsafe-evidence-path',
            call.message ?? 'Evidence path is outside allowed roots.'
          )
        }

        events.push(
          Object.freeze({
            createdAt: now(),
            evidencePath,
            message:
              call.message === undefined
                ? undefined
                : redactSensitiveText(call.message),
            runId: call.runId,
            toolName: call.toolName
          })
        )

        return Object.freeze({ accepted: true })
      }

      events.push(
        Object.freeze({
          createdAt: now(),
          message:
            call.message === undefined
              ? undefined
              : redactSensitiveText(call.message),
          runId: call.runId,
          toolName: call.toolName
        })
      )

      return Object.freeze({ accepted: true })
    },
    listEvents() {
      return Object.freeze([...events])
    },
    registerRun(run: RegisteredRun) {
      runs.set(run.runId, {
        ...run,
        registeredAt: run.registeredAt ?? now()
      })
    }
  }

  return Object.freeze(bridge)
}
