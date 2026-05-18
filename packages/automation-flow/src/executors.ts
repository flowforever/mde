import { basename, extname } from 'node:path'

import { createAutomationFlowDiagnostic } from './diagnostics'
import type {
  AutomationFlowDiagnostic,
  AutomationFlowExecutorDeclaration,
  AutomationFlowExecutorHandles,
  AutomationFlowExecutorRef,
  AutomationFlowSourceType
} from './types'

interface DiscoveredMarkdownExecutor {
  readonly path: string
}

export interface ResolveAutomationFlowExecutorsInput {
  readonly autoDiscoveredMarkdownExecutors: readonly DiscoveredMarkdownExecutor[]
  readonly declarations: readonly AutomationFlowExecutorDeclaration[]
  readonly flowId: string
}

export interface ResolveAutomationFlowExecutorsResult {
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly executors: readonly AutomationFlowExecutorRef[]
}

export interface SelectAutomationFlowExecutorInput {
  readonly executors: readonly AutomationFlowExecutorRef[]
  readonly requiredExecutorId?: string
  readonly requiredExecutorRef?: string
  readonly sourceType?: AutomationFlowSourceType
  readonly tags?: readonly string[]
  readonly taskType?: string
}

export interface SelectAutomationFlowExecutorResult {
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly executor?: AutomationFlowExecutorRef
}

export const normalizeAutomationExecutorId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

const normalizePathKey = (value: string): string =>
  value.trim().replace(/\\/gu, '/').replace(/\/+/gu, '/').replace(/\/$/u, '')

const createExecutorDiagnostic = (
  code: string,
  technicalMessage: string
): AutomationFlowDiagnostic =>
  createAutomationFlowDiagnostic({
    code,
    messageKey: `automationFlow.diagnostics.${code.replace(/^automationFlow\./u, '')}`,
    severity: 'error',
    technicalMessage
  })

const markdownPathForDeclaration = (
  declaration: AutomationFlowExecutorDeclaration,
  executorId: string,
  flowId: string
): string | undefined => {
  if (declaration.type !== 'markdown') {
    return undefined
  }

  return declaration.path ?? `./${flowId}/${executorId}.md`
}

const displayNameForExecutor = (executorId: string): string =>
  executorId
    .split(/[-_.]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || executorId

const freezeExecutor = (
  executor: Omit<AutomationFlowExecutorRef, 'diagnostics' | 'handles' | 'tags'> & {
    readonly diagnostics?: readonly AutomationFlowDiagnostic[]
    readonly handles?: AutomationFlowExecutorHandles
    readonly tags?: readonly string[]
  }
): AutomationFlowExecutorRef =>
  Object.freeze({
    ...executor,
    diagnostics: Object.freeze([...(executor.diagnostics ?? [])]),
    handles: Object.freeze({
      sourceTypes: executor.handles?.sourceTypes === undefined
        ? undefined
        : Object.freeze([...executor.handles.sourceTypes]),
      tags: executor.handles?.tags === undefined
        ? undefined
        : Object.freeze([...executor.handles.tags]),
      taskTypes: executor.handles?.taskTypes === undefined
        ? undefined
        : Object.freeze([...executor.handles.taskTypes])
    }),
    tags: Object.freeze([...(executor.tags ?? [])])
  })

const createExecutorFromDeclaration = (
  declaration: AutomationFlowExecutorDeclaration,
  order: number,
  flowId: string,
  autoDiscoveredSourcePath?: string
): AutomationFlowExecutorRef => {
  const executorId = normalizeAutomationExecutorId(declaration.id)
  const sourcePath =
    declaration.type === 'markdown'
      ? (autoDiscoveredSourcePath ??
        markdownPathForDeclaration(declaration, executorId, flowId))
      : undefined

  return freezeExecutor({
    autoDiscovered: false,
    displayName: declaration.displayName ?? displayNameForExecutor(executorId),
    enabled: declaration.enabled ?? true,
    executorId,
    handles: declaration.handles ?? {},
    order,
    skillRef: declaration.type === 'skill' ? declaration.ref : undefined,
    sourcePath,
    tags: declaration.tags ?? [],
    type: declaration.type
  })
}

const createAutoDiscoveredExecutor = (
  path: string,
  order: number
): AutomationFlowExecutorRef => {
  const extension = extname(path)
  const executorId = normalizeAutomationExecutorId(
    basename(path, extension)
  )

  return freezeExecutor({
    autoDiscovered: true,
    displayName: displayNameForExecutor(executorId),
    enabled: true,
    executorId,
    handles: {},
    order,
    sourcePath: path,
    tags: [],
    type: 'markdown'
  })
}

export const resolveAutomationFlowExecutors = ({
  autoDiscoveredMarkdownExecutors,
  declarations,
  flowId
}: ResolveAutomationFlowExecutorsInput): ResolveAutomationFlowExecutorsResult => {
  const diagnostics: AutomationFlowDiagnostic[] = []
  const autoById = new Map<string, DiscoveredMarkdownExecutor>()
  const explicitIds = new Set<string>()
  const pathOwners = new Map<string, string>()
  const executors: AutomationFlowExecutorRef[] = []

  for (const autoExecutor of autoDiscoveredMarkdownExecutors) {
    const extension = extname(autoExecutor.path)
    const executorId = normalizeAutomationExecutorId(
      basename(autoExecutor.path, extension)
    )
    autoById.set(executorId, autoExecutor)
  }

  declarations.forEach((declaration, index) => {
    const executorId = normalizeAutomationExecutorId(declaration.id)

    if (explicitIds.has(executorId)) {
      diagnostics.push(
        createExecutorDiagnostic(
          'automationFlow.duplicateExecutorId',
          `Duplicate executor id "${executorId}".`
        )
      )
      return
    }

    explicitIds.add(executorId)
    const autoDiscovered = autoById.get(executorId)
    const executor = createExecutorFromDeclaration(
      declaration,
      index,
      flowId,
      autoDiscovered?.path
    )

    if (executor.type === 'markdown' && executor.sourcePath !== undefined) {
      const pathKey = normalizePathKey(executor.sourcePath)
      const existingExecutorId = pathOwners.get(pathKey)

      if (existingExecutorId !== undefined && existingExecutorId !== executorId) {
        diagnostics.push(
          createExecutorDiagnostic(
            'automationFlow.duplicateExecutorPath',
            `Executors "${existingExecutorId}" and "${executorId}" use the same Markdown path.`
          )
        )
      } else {
        pathOwners.set(pathKey, executorId)
      }
    }

    executors.push(executor)
  })

  const autoExecutors = [...autoById.entries()]
    .filter(([executorId]) => !explicitIds.has(executorId))
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([, autoExecutor], index) =>
      createAutoDiscoveredExecutor(
        autoExecutor.path,
        declarations.length + index
      )
    )

  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    executors: Object.freeze([...executors, ...autoExecutors])
  })
}

const includes = (
  values: readonly string[] | undefined,
  value: string | undefined
): boolean => value !== undefined && (values?.includes(value) ?? false)

const overlapCount = (
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): number => {
  if (left === undefined || right === undefined) {
    return 0
  }

  const rightSet = new Set(right)
  return left.filter((value) => rightSet.has(value)).length
}

const matchScore = (
  executor: AutomationFlowExecutorRef,
  input: SelectAutomationFlowExecutorInput
): number =>
  (includes(executor.handles.sourceTypes, input.sourceType) ? 4 : 0) +
  (includes(executor.handles.taskTypes, input.taskType) ? 3 : 0) +
  overlapCount(executor.handles.tags, input.tags) * 2 +
  overlapCount(executor.tags, input.tags)

const bySelectionOrder = (
  input: SelectAutomationFlowExecutorInput
): ((left: AutomationFlowExecutorRef, right: AutomationFlowExecutorRef) => number) =>
  (left, right) => {
    const scoreDelta = matchScore(right, input) - matchScore(left, input)

    if (scoreDelta !== 0) {
      return scoreDelta
    }

    const orderDelta = left.order - right.order

    return orderDelta === 0
      ? left.executorId.localeCompare(right.executorId)
      : orderDelta
  }

const getRequiredExecutor = (
  input: SelectAutomationFlowExecutorInput
): AutomationFlowExecutorRef | undefined => {
  if (input.requiredExecutorId !== undefined) {
    const executorId = normalizeAutomationExecutorId(input.requiredExecutorId)
    return input.executors.find((executor) => executor.executorId === executorId)
  }

  if (input.requiredExecutorRef !== undefined) {
    return input.executors.find(
      (executor) => executor.skillRef === input.requiredExecutorRef
    )
  }

  return undefined
}

export const selectAutomationFlowExecutor = (
  input: SelectAutomationFlowExecutorInput
): SelectAutomationFlowExecutorResult => {
  const requiredExecutor =
    input.requiredExecutorId !== undefined ||
    input.requiredExecutorRef !== undefined
      ? getRequiredExecutor(input)
      : undefined

  if (
    input.requiredExecutorId !== undefined ||
    input.requiredExecutorRef !== undefined
  ) {
    if (requiredExecutor === undefined) {
      return Object.freeze({
        diagnostics: Object.freeze([
          createExecutorDiagnostic(
            'automationFlow.requiredExecutorMissing',
            'The required executor is not available.'
          )
        ])
      })
    }

    if (!requiredExecutor.enabled) {
      return Object.freeze({
        diagnostics: Object.freeze([
          createExecutorDiagnostic(
            'automationFlow.requiredExecutorDisabled',
            `Required executor "${requiredExecutor.executorId}" is disabled.`
          )
        ])
      })
    }

    return Object.freeze({
      diagnostics: Object.freeze([]),
      executor: requiredExecutor
    })
  }

  const enabledExecutors = input.executors.filter((executor) => executor.enabled)

  if (enabledExecutors.length === 0) {
    return Object.freeze({
      diagnostics: Object.freeze([
        createExecutorDiagnostic(
          'automationFlow.missingExecutor',
          'The automation flow has no enabled executor.'
        )
      ])
    })
  }

  return Object.freeze({
    diagnostics: Object.freeze([]),
    executor: [...enabledExecutors].sort(bySelectionOrder(input))[0]
  })
}
