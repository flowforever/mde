import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

import type {
  AgentEngineId,
  AutomationDiscoveredTaskSource,
  AutomationFlow,
  AutomationFlowTaskCandidate,
  AutomationRunKind
} from '@mde/automation-flow'
import { normalizeAutomationDiscoveredTaskSources } from '@mde/automation-flow'

import type { AutomationDiagnostic } from '../../../shared/automation'
import { scanWorkspaceMarkdownSources } from './automationSourceScanner'

export type AgentCliCapabilityVerdict = 'full' | 'limited' | 'unsupported'

export interface AgentCliCapabilitySet {
  readonly automationFlowAuthoring: boolean
  readonly autonomyGate: boolean
  readonly cancellation: boolean
  readonly evidenceCapture: boolean
  readonly fileMutation: boolean
  readonly mdeRuntimeTools: boolean
  readonly nonInteractiveRun: boolean
  readonly openNativeSession: boolean
  readonly permissionMode: boolean
  readonly runScopedRuntimeAuthorization: boolean
  readonly schemaConstrainedFinalOutput: boolean
  readonly sessionContinuation: boolean
  readonly sessionId: boolean
  readonly stdoutJsonlFallback: boolean
  readonly structuredEventStream: boolean
  readonly workingDirectory: boolean
}

export interface AgentCliCapabilityProbeInput {
  readonly workspaceRoot?: string
}

export type AgentCliNormalizedEvent =
  | {
      readonly adapterSessionId: string
      readonly type: 'session-started'
    }
  | {
      readonly phaseTitle: string
      readonly status: 'done' | 'failed' | 'running'
      readonly type: 'phase-update'
    }
  | {
      readonly prompt: string
      readonly type: 'decision-required'
    }
  | {
      readonly sources: readonly AutomationDiscoveredTaskSource[]
      readonly type: 'discovered-task-sources'
    }
  | {
      readonly evidencePath?: string
      readonly outcome: 'blocked' | 'cancelled' | 'failed' | 'succeeded'
      readonly summary?: string
      readonly title: string
      readonly type: 'final-report'
    }

export interface AgentCliRunInput {
  readonly automationFlow: AutomationFlow
  readonly automationFlowOwnerKey?: string
  readonly automationFlowSnapshotId: string
  readonly candidate?: AutomationFlowTaskCandidate
  readonly preferredAdapterSessionId: string
  readonly promptBundle: string
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly taskSource?: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}

export interface AgentCliRunResult {
  readonly adapterSessionId: string
  readonly events: readonly AgentCliNormalizedEvent[]
}

export interface AgentCliResumeInput {
  readonly adapterSessionId: string
  readonly promptBundle: string
  readonly runId: string
  readonly workspaceRoot?: string
}

export interface AgentCliCancelInput {
  readonly adapterSessionId?: string
  readonly runId: string
  readonly workspaceRoot?: string
}

export interface AgentCliOpenNativeSessionInput {
  readonly adapterSessionId: string
  readonly workspaceRoot?: string
}

export interface AgentCliCommandResult {
  readonly accepted: boolean
  readonly diagnostic?: AutomationDiagnostic
}

export interface AgentCliCapabilityProbeReport {
  readonly authenticated: boolean
  readonly capabilities: AgentCliCapabilitySet
  readonly checkedAt: string
  readonly commandPath?: string
  readonly detected: boolean
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly engine: AgentEngineId
  readonly verdict: AgentCliCapabilityVerdict
  readonly version?: string
  readonly workspaceSupported: boolean
}

export interface AgentCliAdapter {
  readonly cancelRun: (input: AgentCliCancelInput) => Promise<AgentCliCommandResult>
  readonly engine: AgentEngineId
  readonly openNativeSession: (
    input: AgentCliOpenNativeSessionInput
  ) => Promise<AgentCliCommandResult>
  readonly probe: (
    input: AgentCliCapabilityProbeInput
  ) => Promise<AgentCliCapabilityProbeReport>
  readonly resumeRun: (input: AgentCliResumeInput) => Promise<AgentCliRunResult>
  readonly startRun: (input: AgentCliRunInput) => Promise<AgentCliRunResult>
}

interface CreateFakeAgentCliAdapterInput {
  readonly authenticated?: boolean
  readonly capabilities?: Partial<AgentCliCapabilitySet>
  readonly commandPath: string
  readonly discoverySources?: readonly AutomationDiscoveredTaskSource[]
  readonly engine: AgentEngineId
  readonly resumeRunEvents?: readonly AgentCliNormalizedEvent[]
  readonly taskRunEvents?: readonly AgentCliNormalizedEvent[]
  readonly version?: string
  readonly workspaceSupported?: boolean
}

interface CreateJsonlAgentCliAdapterInput {
  readonly commandPath: string
  readonly engine: AgentEngineId
  readonly version?: string
}

const fullCapabilities: AgentCliCapabilitySet = Object.freeze({
  automationFlowAuthoring: true,
  autonomyGate: true,
  cancellation: true,
  evidenceCapture: true,
  fileMutation: true,
  mdeRuntimeTools: true,
  nonInteractiveRun: true,
  openNativeSession: true,
  permissionMode: true,
  runScopedRuntimeAuthorization: true,
  schemaConstrainedFinalOutput: true,
  sessionContinuation: true,
  sessionId: true,
  stdoutJsonlFallback: true,
  structuredEventStream: true,
  workingDirectory: true
})

const createAdapterDiagnostic = (
  code: string,
  messageKey: string,
  technicalMessage: string
): AutomationDiagnostic =>
  Object.freeze({
    code,
    diagnosticId: `adapter:${code}`,
    message: technicalMessage,
    messageKey,
    severity: 'error',
    technicalMessage
  })

const getMissingRequiredCapabilities = (
  capabilities: AgentCliCapabilitySet
): readonly (keyof AgentCliCapabilitySet)[] =>
  (
    [
      'mdeRuntimeTools',
      'nonInteractiveRun',
      'runScopedRuntimeAuthorization',
      'structuredEventStream',
      'workingDirectory'
    ] as const
  ).filter((capability) => !capabilities[capability])

const getCapabilityVerdict = (
  detected: boolean,
  capabilities: AgentCliCapabilitySet
): AgentCliCapabilityVerdict => {
  if (!detected) {
    return 'unsupported'
  }

  return getMissingRequiredCapabilities(capabilities).length === 0
    ? 'full'
    : 'limited'
}

const isReadySourceTitle = (title: string): boolean =>
  title.trim().toLowerCase().startsWith('ready')

const discoverLocalWorkspaceSources = async (
  input: AgentCliRunInput
): Promise<readonly AutomationDiscoveredTaskSource[]> => {
  if (input.workspaceRoot === undefined) {
    return Object.freeze([])
  }

  const scan = await scanWorkspaceMarkdownSources({
    workspaceRoot: input.workspaceRoot
  })
  const sources = await Promise.all(
    scan.sourceItems
      .filter(
        (source) =>
          source.automationStatus === 'ready' || isReadySourceTitle(source.title)
      )
      .map(async (source) => {
        const contentSnapshot =
          source.sourcePath === undefined
            ? undefined
            : await readFile(source.sourcePath, 'utf8')

        return {
          ...(contentSnapshot !== undefined ? { contentSnapshot } : {}),
          ...(input.automationFlowOwnerKey !== undefined
            ? { automationFlowOwnerKey: input.automationFlowOwnerKey }
            : {}),
          provider: 'mde-local-helper',
          relativePath: source.relativePath,
          sourceItemId: source.sourceItemId,
          sourcePath: source.sourcePath,
          sourceType: 'local-file' as const,
          ...(source.sourcePath !== undefined
            ? { sourceUri: `file://${source.sourcePath}` }
            : {}),
          tags: source.tags,
          title: source.title,
          workspaceId: source.workspaceId
        }
      })
  )

  return normalizeAutomationDiscoveredTaskSources({
    automationFlow: input.automationFlow,
    discoveredAt: new Date(0).toISOString(),
    sources
  })
}

const parseJsonlEvents = (stdout: string): readonly AgentCliNormalizedEvent[] =>
  Object.freeze(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap((line) => {
        try {
          const event = JSON.parse(line) as AgentCliNormalizedEvent

          return typeof event.type === 'string' ? [event] : []
        } catch {
          return []
        }
      })
  )

const runJsonlCommand = async (
  commandPath: string,
  input: AgentCliRunInput | AgentCliResumeInput,
  env: NodeJS.ProcessEnv
): Promise<readonly AgentCliNormalizedEvent[]> =>
  new Promise((resolve, reject) => {
    const child = spawn(commandPath, [], {
      cwd: input.workspaceRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Agent CLI exited with ${code}.`))
        return
      }

      resolve(parseJsonlEvents(stdout))
    })
    child.stdin.end(input.promptBundle)
  })

export const createFakeAgentCliAdapter = ({
  authenticated = true,
  capabilities = {},
  commandPath,
  discoverySources = [],
  engine,
  resumeRunEvents = [],
  taskRunEvents = [],
  version,
  workspaceSupported = true
}: CreateFakeAgentCliAdapterInput): AgentCliAdapter =>
  Object.freeze({
    cancelRun() {
      return Promise.resolve(Object.freeze({ accepted: true }))
    },
    engine,
    openNativeSession() {
      return Promise.resolve(Object.freeze({ accepted: true }))
    },
    probe() {
      const mergedCapabilities = Object.freeze({
        ...fullCapabilities,
        ...capabilities
      })
      const missingCapabilities =
        getMissingRequiredCapabilities(mergedCapabilities)

      return Promise.resolve(Object.freeze({
        authenticated,
        capabilities: mergedCapabilities,
        checkedAt: new Date(0).toISOString(),
        commandPath,
        detected: true,
        diagnostics: Object.freeze(
          [
            ...(!authenticated
              ? [
                  createAdapterDiagnostic(
                    'automationAdapter.authenticationRequired',
                    'automationAdapter.diagnostics.authenticationRequired',
                    'Adapter authentication is required.'
                  )
                ]
              : []),
            ...missingCapabilities.map((capability) =>
              createAdapterDiagnostic(
                'automationAdapter.missingRequiredCapability',
                'automationAdapter.diagnostics.missingRequiredCapability',
                `Missing required capability: ${capability}.`
              )
            )
          ]
        ),
        engine,
        verdict: authenticated
          ? getCapabilityVerdict(true, mergedCapabilities)
          : 'unsupported',
        ...(version !== undefined ? { version } : {}),
        workspaceSupported
      }))
    },
    resumeRun(input: AgentCliResumeInput) {
      return Promise.resolve(Object.freeze({
        adapterSessionId: input.adapterSessionId,
        events: Object.freeze([
          Object.freeze({
            adapterSessionId: input.adapterSessionId,
            type: 'session-started'
          }),
          ...resumeRunEvents
        ])
      }))
    },
    async startRun(input: AgentCliRunInput) {
      const sessionStarted = Object.freeze({
        adapterSessionId: input.preferredAdapterSessionId,
        type: 'session-started'
      } satisfies AgentCliNormalizedEvent)

      if (input.runKind === 'discovery') {
        const discoveredSources =
          discoverySources.length > 0
            ? discoverySources
            : await discoverLocalWorkspaceSources(input)

        return Object.freeze({
          adapterSessionId: input.preferredAdapterSessionId,
          events: Object.freeze([
            sessionStarted,
            Object.freeze({
              sources: discoveredSources,
              type: 'discovered-task-sources'
            } satisfies AgentCliNormalizedEvent)
          ])
        })
      }

      return Object.freeze({
        adapterSessionId: input.preferredAdapterSessionId,
        events: Object.freeze([sessionStarted, ...taskRunEvents])
      })
    }
  })

export const createJsonlAgentCliAdapter = ({
  commandPath,
  engine,
  version = 'jsonl'
}: CreateJsonlAgentCliAdapterInput): AgentCliAdapter =>
  Object.freeze({
    cancelRun() {
      return Promise.resolve(Object.freeze({ accepted: true }))
    },
    engine,
    openNativeSession() {
      return Promise.resolve(Object.freeze({ accepted: true }))
    },
    probe() {
      return Promise.resolve(Object.freeze({
        authenticated: true,
        capabilities: fullCapabilities,
        checkedAt: new Date(0).toISOString(),
        commandPath,
        detected: true,
        diagnostics: Object.freeze([]),
        engine,
        verdict: 'full',
        version,
        workspaceSupported: true
      }))
    },
    async resumeRun(input: AgentCliResumeInput) {
      const events = await runJsonlCommand(commandPath, input, {
        ...process.env,
        MDE_AUTOMATION_ADAPTER_SESSION_ID: input.adapterSessionId,
        MDE_AUTOMATION_RUN_ID: input.runId,
        MDE_AUTOMATION_RUN_KIND: 'resume',
        ...(input.workspaceRoot !== undefined
          ? { MDE_AUTOMATION_WORKSPACE_ROOT: input.workspaceRoot }
          : {})
      })

      return Object.freeze({
        adapterSessionId: input.adapterSessionId,
        events
      })
    },
    async startRun(input: AgentCliRunInput) {
      const events = await runJsonlCommand(commandPath, input, {
        ...process.env,
        MDE_AUTOMATION_ADAPTER_SESSION_ID: input.preferredAdapterSessionId,
        MDE_AUTOMATION_FLOW_ID: input.automationFlow.id,
        MDE_AUTOMATION_RUN_ID: input.runId,
        MDE_AUTOMATION_RUN_KIND: input.runKind,
        ...(input.taskSource?.sourcePath !== undefined
          ? { MDE_AUTOMATION_TASK_SOURCE_PATH: input.taskSource.sourcePath }
          : {}),
        ...(input.workspaceRoot !== undefined
          ? { MDE_AUTOMATION_WORKSPACE_ROOT: input.workspaceRoot }
          : {})
      })
      const sessionEvent = events.find((event) => event.type === 'session-started')

      return Object.freeze({
        adapterSessionId:
          sessionEvent?.type === 'session-started'
            ? sessionEvent.adapterSessionId
            : input.preferredAdapterSessionId,
        events:
          sessionEvent === undefined
            ? Object.freeze([
                Object.freeze({
                  adapterSessionId: input.preferredAdapterSessionId,
                  type: 'session-started'
                } satisfies AgentCliNormalizedEvent),
                ...events
              ])
            : events
      })
    }
  })

export const createMissingAgentCliAdapter = (
  engine: AgentEngineId
): AgentCliAdapter =>
  Object.freeze({
    cancelRun() {
      return Promise.resolve(Object.freeze({
        accepted: false,
        diagnostic: createAdapterDiagnostic(
          'automationAdapter.missingExecutable',
          'automationAdapter.diagnostics.missingExecutable',
          `Missing ${engine} executable.`
        )
      }))
    },
    engine,
    openNativeSession() {
      return Promise.resolve(Object.freeze({
        accepted: false,
        diagnostic: createAdapterDiagnostic(
          'automationAdapter.missingExecutable',
          'automationAdapter.diagnostics.missingExecutable',
          `Missing ${engine} executable.`
        )
      }))
    },
    probe() {
      return Promise.resolve(Object.freeze({
        authenticated: false,
        capabilities: fullCapabilities,
        checkedAt: new Date(0).toISOString(),
        detected: false,
        diagnostics: Object.freeze([
          createAdapterDiagnostic(
            'automationAdapter.missingExecutable',
            'automationAdapter.diagnostics.missingExecutable',
            `Missing ${engine} executable.`
          )
        ]),
        engine,
        verdict: 'unsupported',
        workspaceSupported: false
      }))
    },
    resumeRun() {
      return Promise.reject(new Error(`Missing ${engine} executable.`))
    },
    startRun() {
      return Promise.reject(new Error(`Missing ${engine} executable.`))
    }
  })

export const isFullCapabilityReport = (
  report: AgentCliCapabilityProbeReport
): boolean => report.verdict === 'full'
