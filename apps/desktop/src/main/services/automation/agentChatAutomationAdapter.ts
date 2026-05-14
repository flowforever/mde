import type {
  AgentChatDiagnostic,
  AgentChatRuntime,
  AgentChatSession
} from '@mde/agent-chat'
import { normalizeAutomationDiscoveredTaskSources } from '@mde/automation-flow'
import type {
  AgentEngineId,
  AutomationDiscoveredTaskSource
} from '@mde/automation-flow'

import type {
  AgentCliAdapter,
  AgentCliCancelInput,
  AgentCliCapabilityProbeInput,
  AgentCliCapabilityProbeReport,
  AgentCliCapabilitySet,
  AgentCliNormalizedEvent,
  AgentCliResumeInput,
  AgentCliRunInput,
  AgentCliRunResult
} from './agentCliAdapters'
import type { AutomationDiagnostic } from '../../../shared/automation'

interface CreateAgentChatAutomationAdapterInput {
  readonly engine?: Extract<AgentEngineId, 'codex'>
  readonly runtime: AgentChatRuntime
}

interface AutomationStructuredEnvelope {
  readonly decisionPrompt?: string
  readonly discoveredTaskSources?: readonly {
    readonly contentSnapshot?: string
    readonly engine?: AgentEngineId
    readonly externalId?: string
    readonly priority?: number
    readonly provider?: string
    readonly relativePath?: string
    readonly sourceItemId: string
    readonly sourcePath?: string
    readonly sourceSnapshotHash?: string
    readonly sourceType: AutomationDiscoveredTaskSource['sourceType']
    readonly sourceUri?: string
    readonly tags?: readonly string[]
    readonly title: string
    readonly workspaceId?: string
  }[]
  readonly finalReport?: {
    readonly outcome: 'blocked' | 'cancelled' | 'failed' | 'succeeded'
    readonly summary?: string
    readonly title: string
  }
}

const unsupportedCapabilities: AgentCliCapabilitySet = Object.freeze({
  automationFlowAuthoring: false,
  autonomyGate: false,
  cancellation: false,
  evidenceCapture: false,
  fileMutation: false,
  mdeRuntimeTools: false,
  nonInteractiveRun: false,
  openNativeSession: false,
  permissionMode: false,
  runScopedRuntimeAuthorization: false,
  schemaConstrainedFinalOutput: false,
  sessionContinuation: false,
  sessionId: false,
  stdoutJsonlFallback: false,
  structuredEventStream: false,
  workingDirectory: false
})

const agentChatCapabilities: AgentCliCapabilitySet = Object.freeze({
  automationFlowAuthoring: true,
  autonomyGate: true,
  cancellation: true,
  evidenceCapture: true,
  fileMutation: true,
  mdeRuntimeTools: true,
  nonInteractiveRun: true,
  openNativeSession: false,
  permissionMode: true,
  runScopedRuntimeAuthorization: true,
  schemaConstrainedFinalOutput: true,
  sessionContinuation: true,
  sessionId: true,
  stdoutJsonlFallback: false,
  structuredEventStream: true,
  workingDirectory: true
})

const createDiagnostic = (
  code: string,
  technicalMessage: string
): AutomationDiagnostic =>
  Object.freeze({
    code,
    diagnosticId: `agent-chat-automation:${code}`,
    message: technicalMessage,
    messageKey: `automationAdapter.diagnostics.${code}`,
    severity: 'error',
    technicalMessage
  })

const mapAgentChatDiagnostic = (
  diagnostic: AgentChatDiagnostic | undefined
): AutomationDiagnostic =>
  createDiagnostic(
    diagnostic?.code ?? 'protocol-unsupported',
    diagnostic?.message ?? 'Codex Agent Chat is unavailable.'
  )

const mapAgentChatAvailabilityDiagnostic = (input: {
  readonly diagnostic?: AgentChatDiagnostic
  readonly reason?: string
}): AutomationDiagnostic =>
  mapAgentChatDiagnostic(
    input.diagnostic ?? {
      code:
        input.reason === 'authentication-required'
          ? 'authentication-required'
          : 'protocol-unsupported',
      message:
        input.reason === 'authentication-required'
          ? 'Sign in to Codex.'
          : 'Codex Agent Chat is unavailable.',
      recoverable: input.reason === 'authentication-required'
    }
  )

const mapAgentChatAvailabilityState = (availability: {
  readonly available: boolean
  readonly diagnostic?: AgentChatDiagnostic
  readonly reason?: string
}): {
  readonly authenticated: boolean
  readonly detected: boolean
  readonly workspaceSupported: boolean
} => {
  if (availability.available) {
    return {
      authenticated: true,
      detected: true,
      workspaceSupported: true
    }
  }

  const diagnosticCode = availability.diagnostic?.code

  return {
    authenticated: availability.reason !== 'authentication-required',
    detected:
      availability.reason !== 'engine-not-registered' &&
      diagnosticCode !== 'engine-missing',
    workspaceSupported: availability.reason !== 'workspace-missing'
  }
}

const normalizeWorkspaceRoot = (
  workspaceRoot: string | undefined
): string | undefined => {
  const normalized = workspaceRoot?.trim()

  return normalized === '' ? undefined : normalized
}

const createWorkspaceRequiredDiagnostic = (): AutomationDiagnostic =>
  createDiagnostic(
    'workspaceRequired',
    'Codex automation requires an open workspace.'
  )

const requireWorkspaceRoot = (workspaceRoot: string | undefined): string => {
  const normalized = normalizeWorkspaceRoot(workspaceRoot)

  if (normalized === undefined) {
    throw new Error(createWorkspaceRequiredDiagnostic().technicalMessage)
  }

  return normalized
}

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const extractJsonCandidates = (text: string): readonly unknown[] => {
  const fenced = Array.from(
    text.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu),
    (match) => match[1]
  )
  return Object.freeze([text, ...fenced].map(tryParseJson).filter(Boolean))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isDiscoveredSourceInput = (
  value: unknown
): value is NonNullable<
  AutomationStructuredEnvelope['discoveredTaskSources']
>[number] =>
  isRecord(value) &&
  typeof value.sourceItemId === 'string' &&
  typeof value.sourceType === 'string' &&
  typeof value.title === 'string'

const parseAutomationEnvelope = (
  content: string
): AutomationStructuredEnvelope | undefined => {
  for (const candidate of extractJsonCandidates(content)) {
    if (!isRecord(candidate)) {
      continue
    }

    const envelope = isRecord(candidate.automation)
      ? candidate.automation
      : candidate
    const discoveredTaskSources = Array.isArray(envelope.discoveredTaskSources)
      ? envelope.discoveredTaskSources.filter(isDiscoveredSourceInput)
      : undefined
    const finalReport = isRecord(envelope.finalReport)
      ? envelope.finalReport
      : undefined

    if (discoveredTaskSources !== undefined || finalReport !== undefined) {
      return Object.freeze({
        ...(typeof envelope.decisionPrompt === 'string'
          ? { decisionPrompt: envelope.decisionPrompt }
          : {}),
        ...(discoveredTaskSources !== undefined
          ? { discoveredTaskSources }
          : {}),
        ...(finalReport !== undefined &&
        typeof finalReport.outcome === 'string' &&
        typeof finalReport.title === 'string'
          ? {
              finalReport: {
                outcome: finalReport.outcome as never,
                ...(typeof finalReport.summary === 'string'
                  ? { summary: finalReport.summary }
                  : {}),
                title: finalReport.title
              }
            }
          : {})
      })
    }
  }

  return undefined
}

const createContextManifest = (
  _input: AgentCliRunInput,
  workspaceRoot: string
) =>
  Object.freeze({
    currentDocumentSnapshot: '',
    permissionMode: 'max-permission' as const,
    selectedBlockIds: Object.freeze([]),
    selectedText: '',
    sessionPurpose: 'automation-task' as const,
    workspaceRoot
  })

const createResumeContextManifest = (workspaceRoot: string) =>
  Object.freeze({
    currentDocumentSnapshot: '',
    permissionMode: 'max-permission' as const,
    selectedBlockIds: Object.freeze([]),
    selectedText: '',
    sessionPurpose: 'automation-task' as const,
    workspaceRoot
  })

const collectEventsFromEnvelope = (
  input: AgentCliRunInput,
  envelope: AutomationStructuredEnvelope | undefined
): readonly AgentCliNormalizedEvent[] => {
  if (envelope === undefined) {
    return Object.freeze([])
  }

  const events: AgentCliNormalizedEvent[] = []

  if (
    input.runKind === 'discovery' &&
    envelope.discoveredTaskSources !== undefined
  ) {
    events.push(
      Object.freeze({
        sources: normalizeAutomationDiscoveredTaskSources({
          automationFlow: input.automationFlow,
          discoveredAt: new Date(0).toISOString(),
          sources: envelope.discoveredTaskSources
        }),
        type: 'discovered-task-sources'
      })
    )
  }

  if (typeof envelope.decisionPrompt === 'string') {
    events.push(
      Object.freeze({
        prompt: envelope.decisionPrompt,
        type: 'decision-required'
      })
    )
  }

  if (envelope.finalReport !== undefined) {
    events.push(
      Object.freeze({
        outcome: envelope.finalReport.outcome,
        ...(envelope.finalReport.summary !== undefined
          ? { summary: envelope.finalReport.summary }
          : {}),
        title: envelope.finalReport.title,
        type: 'final-report'
      })
    )
  }

  return Object.freeze(events)
}

const collectResumeEventsFromEnvelope = (
  envelope: AutomationStructuredEnvelope | undefined
): readonly AgentCliNormalizedEvent[] => {
  if (envelope === undefined) {
    return Object.freeze([])
  }

  const events: AgentCliNormalizedEvent[] = []

  if (typeof envelope.decisionPrompt === 'string') {
    events.push(
      Object.freeze({
        prompt: envelope.decisionPrompt,
        type: 'decision-required'
      })
    )
  }

  if (envelope.finalReport !== undefined) {
    events.push(
      Object.freeze({
        outcome: envelope.finalReport.outcome,
        ...(envelope.finalReport.summary !== undefined
          ? { summary: envelope.finalReport.summary }
          : {}),
        title: envelope.finalReport.title,
        type: 'final-report'
      })
    )
  }

  return Object.freeze(events)
}

const resolveRuntimeSessionId = async (
  runtime: AgentChatRuntime,
  adapterSessionId: string,
  workspaceRoot: string
): Promise<string> => {
  const sessions = await runtime.listSessions({
    selectedEngineId: 'codex',
    workspaceRoot
  })
  const session = sessions.find(
    (item) =>
      item.sessionId === adapterSessionId ||
      item.nativeSessionId === adapterSessionId
  )

  return session?.sessionId ?? adapterSessionId
}

const stopRuntimeSession = async (
  runtime: AgentChatRuntime,
  input: AgentCliCancelInput
) => {
  const workspaceRoot = normalizeWorkspaceRoot(input.workspaceRoot)

  if (workspaceRoot === undefined) {
    return Object.freeze({
      accepted: false,
      diagnostic: createWorkspaceRequiredDiagnostic()
    })
  }

  if (input.adapterSessionId === undefined) {
    return Object.freeze({
      accepted: false,
      diagnostic: createDiagnostic(
        'nativeSessionUnavailable',
        'No Agent Chat session is attached to this automation run.'
      )
    })
  }

  const sessionId = await resolveRuntimeSessionId(
    runtime,
    input.adapterSessionId,
    workspaceRoot
  )

  await runtime.stopSession({
    sessionId,
    workspaceRoot
  })

  return Object.freeze({ accepted: true })
}

export const createAgentChatAutomationAdapter = ({
  engine = 'codex',
  runtime
}: CreateAgentChatAutomationAdapterInput): AgentCliAdapter =>
  Object.freeze({
    cancelRun(input: AgentCliCancelInput) {
      return stopRuntimeSession(runtime, input)
    },
    engine,
    openNativeSession() {
      return Promise.resolve(
        Object.freeze({
          accepted: false,
          diagnostic: createDiagnostic(
            'nativeSessionUnavailable',
            'Native Agent Chat session opening is unavailable from Automation Center.'
          )
        })
      )
    },
    async probe(input: AgentCliCapabilityProbeInput) {
      const workspaceRoot = normalizeWorkspaceRoot(input.workspaceRoot)
      if (workspaceRoot === undefined) {
        return Object.freeze({
          authenticated: false,
          capabilities: unsupportedCapabilities,
          checkedAt: new Date().toISOString(),
          detected: false,
          diagnostics: Object.freeze([createWorkspaceRequiredDiagnostic()]),
          engine,
          verdict: 'unsupported',
          workspaceSupported: false
        }) satisfies AgentCliCapabilityProbeReport
      }

      const availability = await runtime.getAvailability({
        selectedEngineId: 'codex',
        workspaceRoot
      })
      const availabilityState = mapAgentChatAvailabilityState(availability)

      return Object.freeze({
        authenticated: availabilityState.authenticated,
        capabilities: availability.available
          ? agentChatCapabilities
          : unsupportedCapabilities,
        checkedAt: new Date().toISOString(),
        detected: availabilityState.detected,
        diagnostics: availability.available
          ? Object.freeze([])
          : Object.freeze([
              mapAgentChatAvailabilityDiagnostic({
                diagnostic: availability.diagnostic,
                reason: availability.reason
              })
            ]),
        engine,
        verdict: availability.available ? 'full' : 'unsupported',
        workspaceSupported: availabilityState.workspaceSupported
      }) satisfies AgentCliCapabilityProbeReport
    },
    async resumeRun(input: AgentCliResumeInput) {
      const workspaceRoot = requireWorkspaceRoot(input.workspaceRoot)
      const sessionId = await resolveRuntimeSessionId(
        runtime,
        input.adapterSessionId,
        workspaceRoot
      )
      const assistantContents: string[] = []
      const unsubscribe = runtime.subscribe(sessionId, (event) => {
        if (event.type === 'assistant-message-completed') {
          assistantContents.push(event.message.content)
        }
      })

      try {
        await runtime.resumeSession({
          content: input.promptBundle,
          contextManifest: createResumeContextManifest(workspaceRoot),
          nativeSessionId:
            sessionId === input.adapterSessionId ? undefined : input.adapterSessionId,
          sessionId,
          workspaceRoot
        })
      } finally {
        unsubscribe()
      }

      const envelope = assistantContents
        .map(parseAutomationEnvelope)
        .find((item): item is AutomationStructuredEnvelope => item !== undefined)

      return Object.freeze({
        adapterSessionId: input.adapterSessionId,
        events: Object.freeze([
          Object.freeze({
            adapterSessionId: input.adapterSessionId,
            type: 'session-started'
          } satisfies AgentCliNormalizedEvent),
          ...collectResumeEventsFromEnvelope(envelope)
        ])
      })
    },
    async startRun(input: AgentCliRunInput): Promise<AgentCliRunResult> {
      const workspaceRoot = requireWorkspaceRoot(input.workspaceRoot)
      const session = await runtime.createDraftSession({
        engineId: 'codex',
        host: 'automation-center',
        sessionPurpose: 'automation-task',
        workspaceRoot
      })
      let activeSession: AgentChatSession = session
      const assistantContents: string[] = []
      const unsubscribe = runtime.subscribe(session.sessionId, (event) => {
        if ('session' in event) {
          activeSession = event.session
          return
        }

        if (event.type === 'assistant-message-completed') {
          assistantContents.push(event.message.content)
        }
      })

      try {
        await runtime.sendMessage({
          content: input.promptBundle,
          contextManifest: createContextManifest(input, workspaceRoot),
          sessionId: session.sessionId,
          workspaceRoot
        })
      } finally {
        unsubscribe()
      }

      const envelope = assistantContents
        .map(parseAutomationEnvelope)
        .find((item): item is AutomationStructuredEnvelope => item !== undefined)
      const adapterSessionId = activeSession.nativeSessionId ?? activeSession.sessionId

      return Object.freeze({
        adapterSessionId,
        events: Object.freeze([
          Object.freeze({
            adapterSessionId,
            type: 'session-started'
          } satisfies AgentCliNormalizedEvent),
          ...collectEventsFromEnvelope(input, envelope)
        ])
      })
    }
  })
