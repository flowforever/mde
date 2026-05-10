import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import {
  listBuiltInAutomationFlowTemplates,
  type AutomationDiscoveredTaskSource,
  type AutomationFlowDiagnostic,
  type AutomationFlowTaskCandidate,
  type AutomationProjectedTask,
  type AutomationReportOverlay,
  type AutomationRunOverlay,
  type ParsedAutomationFlow
} from '@mde/automation-flow'

import type {
  AutomationAdapterCapabilityReport,
  AutomationArchiveFlowCommand,
  AutomationCommandResponse,
  AutomationCreateFlowFromTemplateRequest,
  AutomationDiagnostic,
  AutomationFlowDefinitionDocument,
  AutomationFlowRow,
  AutomationGetProjectionRequest,
  AutomationLoadFlowDefinitionCommand,
  AutomationProjection,
  AutomationProjectionFilters,
  AutomationRunSummary,
  AutomationSaveFlowDefinitionCommand,
  AutomationSetFlowLifecycleCommand,
  AutomationStartRunRequest,
  AutomationSubmitDecisionRequest,
  AutomationValidateTemplateInputResponse
} from '../../shared/automation'
import { AUTOMATION_CHANNELS } from './channels'
import type { AgentCliCapabilityProbeReport } from '../services/automation/agentCliAdapters'
import type { AutomationAdapterRegistry } from '../services/automation/automationAdapterRegistry'
import { createAutomationFlowDefinitionService } from '../services/automation/automationFlowDefinitionService'
import { loadAutomationFlowLibrary } from '../services/automation/automationFlowLibrary'
import { buildAutomationIndex } from '../services/automation/automationIndexService'
import type { AutomationStoredRun, AutomationStore } from '../services/automation/automationStore'
import type { AutomationRuntime } from '../services/automation/automationRuntime'

interface RegisterAutomationHandlersOptions {
  readonly adapterRegistry: AutomationAdapterRegistry
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null
  readonly homePath: string
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly now?: () => string
  readonly runtime: AutomationRuntime
  readonly store: AutomationStore
}

interface AutomationContext {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
  readonly discoveredSources: readonly AutomationDiscoveredTaskSource[]
  readonly flows: readonly ParsedAutomationFlow[]
  readonly projection: AutomationProjection
}

const createDiagnostic = (
  code: string,
  message: string,
  severity: AutomationDiagnostic['severity'] = 'error'
): AutomationDiagnostic =>
  Object.freeze({
    code,
    diagnosticId: `automation:${code}`,
    message,
    messageKey: `automation.diagnostics.${code}`,
    severity,
    technicalMessage: message
  })

const mapFlowDiagnostic = (
  diagnostic: AutomationFlowDiagnostic
): AutomationDiagnostic =>
  Object.freeze({
    code: diagnostic.code,
    diagnosticId: `automation-flow:${diagnostic.code}:${diagnostic.sourceFile ?? 'inline'}`,
    message: diagnostic.technicalMessage ?? diagnostic.code,
    messageKey: diagnostic.messageKey,
    severity: diagnostic.severity,
    ...(diagnostic.sourceFile !== undefined
      ? { sourceFile: diagnostic.sourceFile }
      : {}),
    ...(diagnostic.technicalMessage !== undefined
      ? { technicalMessage: diagnostic.technicalMessage }
      : {})
  })

const mapCapabilityReport = (
  report: AgentCliCapabilityProbeReport
): AutomationAdapterCapabilityReport =>
  Object.freeze({
    authenticated: report.authenticated,
    capabilities: Object.freeze({ ...report.capabilities }),
    checkedAt: report.checkedAt,
    ...(report.commandPath !== undefined ? { commandPath: report.commandPath } : {}),
    detected: report.detected,
    diagnostics: report.diagnostics,
    engine: report.engine,
    verdict: report.verdict,
    ...(report.version !== undefined ? { version: report.version } : {}),
    workspaceSupported: report.workspaceSupported
  })

const mapDefinitionDocument = (
  document: Awaited<
    ReturnType<
      ReturnType<typeof createAutomationFlowDefinitionService>['loadEditableDocument']
    >
  >
): AutomationFlowDefinitionDocument =>
  Object.freeze({
    diagnostics: document.validation.diagnostics.map(mapFlowDiagnostic),
    markdown: document.markdown,
    path: document.path,
    valid: document.validation.ok
  })

const assertRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }

  return value as Record<string, unknown>
}

const assertString = (value: unknown, name: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }

  return value
}

const assertProjectionFilters = (
  value: unknown
): AutomationProjectionFilters => {
  if (value === undefined) {
    return Object.freeze({})
  }

  const filters = assertRecord(value, 'Automation filters')

  return Object.freeze({
    ...(typeof filters.archivedVisible === 'boolean'
      ? { archivedVisible: filters.archivedVisible }
      : {}),
    ...(typeof filters.bucket === 'string' ? { bucket: filters.bucket as never } : {}),
    ...(typeof filters.flowId === 'string' ? { flowId: filters.flowId } : {}),
    ...(typeof filters.workspaceId === 'string'
      ? { workspaceId: filters.workspaceId }
      : {})
  })
}

const assertOptionalProjectionRequest = (
  value: unknown
): AutomationGetProjectionRequest | undefined => {
  if (value === undefined) {
    return undefined
  }

  const request = assertRecord(value, 'Automation projection request')

  return Object.freeze({
    ...(request.filters !== undefined
      ? { filters: assertProjectionFilters(request.filters) }
      : {}),
    ...(typeof request.workspaceRoot === 'string'
      ? { workspaceRoot: request.workspaceRoot }
      : {})
  })
}

const getWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: RegisterAutomationHandlersOptions['getActiveWorkspaceRoot'],
  request?: AutomationGetProjectionRequest
): string | undefined => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot(event)
  const requestedWorkspaceRoot = request?.workspaceRoot

  if (
    activeWorkspaceRoot !== null &&
    requestedWorkspaceRoot !== undefined &&
    requestedWorkspaceRoot !== activeWorkspaceRoot
  ) {
    throw new Error('Workspace changed before automation operation completed')
  }

  return requestedWorkspaceRoot ?? activeWorkspaceRoot ?? undefined
}

const getRequiredWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: RegisterAutomationHandlersOptions['getActiveWorkspaceRoot'],
  request?: AutomationGetProjectionRequest
): string => {
  const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot, request)

  if (workspaceRoot === undefined) {
    throw new Error('Open a workspace before using workspace automation')
  }

  return workspaceRoot
}

const createDefinitionService = ({
  homePath,
  workspaceRoot
}: {
  readonly homePath: string
  readonly workspaceRoot?: string
}) =>
  createAutomationFlowDefinitionService({
    homePath,
    workspaceRoot
  })

const assertCreateTemplateRequest = (
  value: unknown
): AutomationCreateFlowFromTemplateRequest => {
  const request = assertRecord(value, 'Automation template request')

  return {
    defaultEngine: assertString(request.defaultEngine, 'Default engine'),
    flowId: assertString(request.flowId, 'Flow id'),
    scope: assertString(request.scope, 'Scope') as AutomationCreateFlowFromTemplateRequest['scope'],
    templateId: assertString(
      request.templateId,
      'Template id'
    ) as AutomationCreateFlowFromTemplateRequest['templateId']
  }
}

const assertArchiveFlowCommand = (value: unknown): AutomationArchiveFlowCommand => {
  const command = assertRecord(value, 'Automation archive command')

  return {
    filePath: assertString(command.filePath, 'File path')
  }
}

const assertLoadFlowDefinitionCommand = (
  value: unknown
): AutomationLoadFlowDefinitionCommand => {
  const command = assertRecord(value, 'Automation load definition command')

  return {
    filePath: assertString(command.filePath, 'File path')
  }
}

const assertSaveFlowDefinitionCommand = (
  value: unknown
): AutomationSaveFlowDefinitionCommand => {
  const command = assertRecord(value, 'Automation save definition command')

  return {
    filePath: assertString(command.filePath, 'File path'),
    markdown: assertString(command.markdown, 'Markdown')
  }
}

const assertSetLifecycleCommand = (
  value: unknown
): AutomationSetFlowLifecycleCommand => {
  const command = assertRecord(value, 'Automation lifecycle command')

  return {
    filePath: assertString(command.filePath, 'File path'),
    lifecycle: assertString(
      command.lifecycle,
      'Lifecycle'
    ) as AutomationSetFlowLifecycleCommand['lifecycle']
  }
}

const assertStartRunRequest = (value: unknown): AutomationStartRunRequest => {
  const command = assertRecord(value, 'Automation start command')

  return {
    taskId: assertString(command.taskId, 'Task id')
  }
}

const assertSubmitDecisionRequest = (
  value: unknown
): AutomationSubmitDecisionRequest => {
  const command = assertRecord(value, 'Automation decision command')

  return {
    decisionId: assertString(command.decisionId, 'Decision id'),
    response: assertString(command.response, 'Decision response')
  }
}

const getTemplateById = (
  templateId: AutomationCreateFlowFromTemplateRequest['templateId']
) => listBuiltInAutomationFlowTemplates().find((template) => template.id === templateId)

const validateTemplateInput = (
  request: AutomationCreateFlowFromTemplateRequest,
  workspaceRoot: string | undefined
): AutomationValidateTemplateInputResponse => {
  const template = getTemplateById(request.templateId)
  const diagnostics: AutomationDiagnostic[] = []

  if (template === undefined) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.unknownTemplate',
        'Unknown automation-flow template.'
      )
    )
  }

  if (request.flowId.trim().length === 0) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.invalidFlowId',
        'Automation-flow id is required.'
      )
    )
  }

  if (
    template !== undefined &&
    !template.allowedScopes.includes(request.scope)
  ) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.unsupportedScope',
        'Automation-flow template does not support the requested scope.'
      )
    )
  }

  if (request.scope === 'workspace' && workspaceRoot === undefined) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.workspaceRequired',
        'Workspace root is required.'
      )
    )
  }

  return Object.freeze({
    diagnostics,
    ok: diagnostics.length === 0
  })
}

const mapTask = (task: AutomationProjectedTask) =>
  Object.freeze({
    activeRunId: task.activeRunId,
    automationFlowId: task.automationFlowId,
    bucket: task.bucket,
    engine: task.engine,
    latestReportId: task.latestReportId,
    sourceItemId: task.sourceItemId,
    sourceType: task.sourceType,
    taskId: task.taskId,
    title: task.title
  })

const mapRunSummary = (run: AutomationStoredRun): AutomationRunSummary =>
  Object.freeze({
    ...(run.adapterSessionId !== undefined
      ? { adapterSessionId: run.adapterSessionId }
      : {}),
    ...(run.adapterSessionLineage !== undefined
      ? { adapterSessionLineage: run.adapterSessionLineage }
      : {}),
    automationFlowId: run.automationFlowId,
    ...(run.automationFlowSnapshotId !== undefined
      ? { automationFlowSnapshotId: run.automationFlowSnapshotId }
      : {}),
    engine: run.engine,
    runId: run.runId,
    runKind: run.runKind,
    ...(run.sourceItemId !== undefined ? { sourceItemId: run.sourceItemId } : {}),
    ...(run.sourcePath !== undefined ? { sourcePath: run.sourcePath } : {}),
    ...(run.sourceSnapshotHash !== undefined
      ? { sourceSnapshotHash: run.sourceSnapshotHash }
      : {}),
    startedAt: run.startedAt,
    state: run.state,
    taskId: run.taskId,
    ...(run.title !== undefined ? { title: run.title } : {}),
    updatedAt: run.updatedAt
  })

const applyTaskFilters = <Task extends { readonly automationFlowId: string }>(
  tasks: readonly Task[],
  filters: AutomationProjectionFilters
): readonly Task[] =>
  filters.flowId === undefined
    ? Object.freeze([...tasks])
    : Object.freeze(
        tasks.filter((task) => task.automationFlowId === filters.flowId)
      )

const mapFlowRows = (
  flows: readonly ParsedAutomationFlow[],
  candidates: readonly AutomationFlowTaskCandidate[],
  diagnostics: readonly AutomationDiagnostic[]
): readonly AutomationFlowRow[] =>
  Object.freeze(
    flows.map((flow) =>
      Object.freeze({
        automationFlowId: flow.id,
        ...(flow.sourceFile !== undefined ? { definitionPath: flow.sourceFile } : {}),
        diagnosticCount: diagnostics.filter(
          (diagnostic) => diagnostic.automationFlowId === flow.id
        ).length,
        lifecycle: flow.lifecycle,
        name: flow.name,
        scope: flow.scope,
        sourceTypes: flow.sourceTypes,
        status: flow.status,
        taskCount: candidates.filter(
          (candidate) => candidate.automationFlowId === flow.id
        ).length
      })
    )
  )

const createReportOverlays = (
  reports: Awaited<ReturnType<AutomationStore['listReports']>>,
  runs: readonly AutomationStoredRun[]
): readonly AutomationReportOverlay[] => {
  const runById = new Map(runs.map((run) => [run.runId, run]))

  return Object.freeze(
    reports.flatMap((report) => {
      const run = report.runId === undefined ? undefined : runById.get(report.runId)

      if (run?.sourceItemId === undefined || run.runKind !== 'task') {
        return []
      }

      return [
        Object.freeze({
          automationFlowId: run.automationFlowId,
          completedAt: report.completedAt,
          reportId: report.reportId,
          sourceItemId: run.sourceItemId,
          taskId: report.taskId,
          title: report.title
        })
      ]
    })
  )
}

const createRunOverlays = (
  runs: readonly AutomationStoredRun[]
): readonly AutomationRunOverlay[] =>
  Object.freeze(
    runs.flatMap((run) =>
      run.sourceItemId === undefined || run.runKind !== 'task'
        ? []
        : [
            Object.freeze({
              automationFlowId: run.automationFlowId,
              runKind: run.runKind,
              runId: run.runId,
              sourceItemId: run.sourceItemId,
              state: run.state,
              taskId: run.taskId
            })
          ]
    )
  )

export const registerAutomationHandlers = ({
  adapterRegistry,
  getActiveWorkspaceRoot,
  homePath,
  ipcMain,
  now = () => new Date().toISOString(),
  runtime,
  store
}: RegisterAutomationHandlersOptions): void => {
  let initialized = false
  const ensureInitialized = async (): Promise<void> => {
    if (initialized) {
      return
    }

    await store.initialize()
    initialized = true
  }

  const buildContext = async (
    event: Pick<IpcMainInvokeEvent, 'sender'>,
    request?: AutomationGetProjectionRequest
  ): Promise<AutomationContext> => {
    await ensureInitialized()

    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot, request)
    const filters = request?.filters ?? (await store.loadFilterState())
    const projectionFilters = Object.freeze({
      ...filters,
      ...(workspaceRoot !== undefined ? { workspaceId: workspaceRoot } : {})
    })
    const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })
    let runs = await store.listRuns()
    let discoveredSources = await store.listDiscoveredTaskSources()
    const discoveredFlowIds = new Set(
      discoveredSources.map((source) => source.automationFlowId)
    )
    const discoveryRunFlowIds = new Set(
      runs
        .filter((run) => run.runKind === 'discovery')
        .map((run) => run.automationFlowId)
    )
    const discoveryDiagnostics: AutomationDiagnostic[] = []

    for (const automationFlow of library.automationFlows) {
      if (
        automationFlow.lifecycle !== 'enabled' ||
        discoveredFlowIds.has(automationFlow.id) ||
        discoveryRunFlowIds.has(automationFlow.id)
      ) {
        continue
      }

      try {
        await runtime.startDiscoveryRun({ automationFlow, workspaceRoot })
      } catch (error) {
        discoveryDiagnostics.push(
          createDiagnostic(
            'automationDiscovery.runCapabilityUnavailable',
            error instanceof Error
              ? error.message
              : 'Discovery run could not be started.'
          )
        )
      }
    }

    runs = await store.listRuns()
    discoveredSources = await store.listDiscoveredTaskSources()
    const decisions = await store.listDecisions()
    const reports = await store.listReports()
    const index = buildAutomationIndex({
      automationFlows: library.automationFlows,
      discoveredSources,
      reports: createReportOverlays(reports, runs),
      runs: createRunOverlays(runs)
    })
    const filteredBuckets = Object.freeze({
      done: applyTaskFilters(index.projection.buckets.done, projectionFilters),
      needsMe: applyTaskFilters(
        index.projection.buckets.needsMe,
        projectionFilters
      ),
      ready: applyTaskFilters(index.projection.buckets.ready, projectionFilters),
      running: applyTaskFilters(
        index.projection.buckets.running,
        projectionFilters
      )
    })
    const filteredTasks = applyTaskFilters(index.projection.tasks, projectionFilters)
    const diagnostics = Object.freeze([
      ...library.diagnostics.map(mapFlowDiagnostic),
      ...discoveryDiagnostics,
      ...index.diagnostics.map(mapFlowDiagnostic)
    ])
    const projection: AutomationProjection = Object.freeze({
      buckets: Object.freeze({
        done: Object.freeze(filteredBuckets.done.map(mapTask)),
        needsMe: Object.freeze(filteredBuckets.needsMe.map(mapTask)),
        ready: Object.freeze(filteredBuckets.ready.map(mapTask)),
        running: Object.freeze(filteredBuckets.running.map(mapTask))
      }),
      decisions,
      diagnostics,
      filters: projectionFilters,
      flows: mapFlowRows(library.automationFlows, index.candidates, diagnostics),
      generatedAt: now(),
      reports,
      runs: Object.freeze(runs.map(mapRunSummary)),
      tasks: Object.freeze(filteredTasks.map(mapTask))
    })

    return Object.freeze({
      candidates: index.candidates,
      discoveredSources,
      flows: library.automationFlows,
      projection
    })
  }

  ipcMain.handle(AUTOMATION_CHANNELS.getProjection, async (event, request) => ({
    projection: (await buildContext(
      event,
      assertOptionalProjectionRequest(request)
    )).projection
  }))

  ipcMain.handle(AUTOMATION_CHANNELS.listCapabilityReports, async (event, request) => {
    await ensureInitialized()

    return {
      reports: (
        await adapterRegistry.probeAll({
          workspaceRoot: getWorkspaceRoot(
            event,
            getActiveWorkspaceRoot,
            assertOptionalProjectionRequest(request)
          )
        })
      ).map(mapCapabilityReport)
    }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.listReports, async () => {
    await ensureInitialized()

    return { reports: await store.listReports() }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.listTemplates, () => ({
    templates: listBuiltInAutomationFlowTemplates().map((template) =>
      Object.freeze({
        allowedScopes: template.allowedScopes,
        name: template.name,
        requiredInputs: template.requiredInputs,
        templateId: template.id
      })
    )
  }))

  ipcMain.handle(AUTOMATION_CHANNELS.validateTemplateInput, (event, rawRequest) => {
    const request = assertCreateTemplateRequest(rawRequest)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return validateTemplateInput(request, workspaceRoot)
  })

  ipcMain.handle(
    AUTOMATION_CHANNELS.createFlowFromTemplate,
    async (event, rawRequest) => {
      const request = assertCreateTemplateRequest(rawRequest)
      const workspaceRoot =
        request.scope === 'workspace'
          ? getRequiredWorkspaceRoot(event, getActiveWorkspaceRoot)
          : getWorkspaceRoot(event, getActiveWorkspaceRoot)
      const validation = validateTemplateInput(request, workspaceRoot)

      if (!validation.ok) {
        throw new Error(validation.diagnostics[0]?.message ?? 'Invalid template input')
      }

      return mapDefinitionDocument(
        await createDefinitionService({ homePath, workspaceRoot }).createFromTemplate(
          request
        )
      )
    }
  )

  ipcMain.handle(AUTOMATION_CHANNELS.setFlowLifecycle, async (event, rawCommand) => {
    const command = assertSetLifecycleCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).setLifecycle(
        command.filePath,
        command.lifecycle
      )
    )
  })

  ipcMain.handle(
    AUTOMATION_CHANNELS.loadFlowDefinition,
    async (event, rawCommand) => {
      const command = assertLoadFlowDefinitionCommand(rawCommand)
      const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

      return mapDefinitionDocument(
        await createDefinitionService({ homePath, workspaceRoot })
          .loadEditableDocument(command.filePath)
      )
    }
  )

  ipcMain.handle(
    AUTOMATION_CHANNELS.saveFlowDefinition,
    async (event, rawCommand) => {
      const command = assertSaveFlowDefinitionCommand(rawCommand)
      const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

      return mapDefinitionDocument(
        await createDefinitionService({ homePath, workspaceRoot }).saveDefinition(
          command.filePath,
          command.markdown
        )
      )
    }
  )

  ipcMain.handle(AUTOMATION_CHANNELS.archiveFlow, async (event, rawCommand) => {
    const command = assertArchiveFlowCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).archiveDefinition(
        command.filePath
      )
    )
  })

  ipcMain.handle(AUTOMATION_CHANNELS.restoreFlow, async (event, rawCommand) => {
    const command = assertArchiveFlowCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).restoreDefinition(
        command.filePath
      )
    )
  })

  ipcMain.handle(AUTOMATION_CHANNELS.startRun, async (event, rawCommand) => {
    const command = assertStartRunRequest(rawCommand)
    const context = await buildContext(event)
    const candidate = context.candidates.find(
      (item) => item.taskId === command.taskId
    )
    const taskSource =
      candidate === undefined
        ? undefined
        : context.discoveredSources.find(
            (source) =>
              source.automationFlowId === candidate.automationFlowId &&
              source.sourceItemId === candidate.sourceItemId
          )
    const automationFlow = context.flows.find(
      (flow) => flow.id === candidate?.automationFlowId
    )

    if (candidate === undefined || automationFlow === undefined) {
      return {
        accepted: false,
        diagnostic: createDiagnostic(
          'automationRun.taskNotFound',
          'Automation task was not found.'
        )
      } satisfies AutomationCommandResponse
    }

    try {
      const result = await runtime.startRun({
        automationFlow,
        candidate,
        ...(taskSource !== undefined ? { taskSource } : {}),
        workspaceRoot: getWorkspaceRoot(event, getActiveWorkspaceRoot)
      })

      return {
        accepted: true,
        ...(result.decision !== undefined
          ? { decisionId: result.decision.decisionId }
          : {}),
        runId: result.runId
      } satisfies AutomationCommandResponse
    } catch (error) {
      return {
        accepted: false,
        diagnostic: createDiagnostic(
          'automationAdapter.runCapabilityUnavailable',
          error instanceof Error
            ? error.message
            : 'Required adapter capabilities are unavailable.'
        )
      } satisfies AutomationCommandResponse
    }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.resumeRun, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation resume command')
    const result = await runtime.resumeRun({
      runId: assertString(command.runId, 'Run id')
    })

    return { accepted: true, runId: result.runId } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.cancelRun, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation cancel command')
    const run = await runtime.cancelRun(assertString(command.runId, 'Run id'))

    return { accepted: true, runId: run.runId } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.submitDecision, async (_event, rawCommand) => {
    const command = assertSubmitDecisionRequest(rawCommand)
    const decision = await store.resolveDecision(
      command.decisionId,
      command.response
    )

    return {
      accepted: true,
      decisionId: decision.decisionId,
      runId: decision.runId
    } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.updateFilters, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation filter command')

    await store.saveFilterState(assertProjectionFilters(command.filters))

    return { accepted: true } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.openNativeSession, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation native session command')
    const runId = assertString(command.runId, 'Run id')
    const run = await store.getRun(runId)
    const actions = await runtime.getRunActions({
      engine: run.engine,
      runId,
      workspaceRoot: run.workspaceRoot
    })

    if (!actions.includes('open-native-session')) {
      return {
        accepted: false,
        diagnostic: createDiagnostic(
          'automationRun.nativeSessionUnavailable',
          'Native adapter session is unavailable.'
        ),
        runId
      } satisfies AutomationCommandResponse
    }

    return {
      accepted: await runtime.openNativeSession(runId),
      runId
    } satisfies AutomationCommandResponse
  })
}
