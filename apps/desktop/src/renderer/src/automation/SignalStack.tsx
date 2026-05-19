import { FolderCog } from 'lucide-react'
import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import { isAppTextKey, type AppText, type AppTextKey } from '../i18n/appLanguage'
import type { AutomationCenterViewModel } from './automationViewModel'
import type { AutomationTaskCard } from '../../../shared/automation'

interface SignalStackProps {
  readonly onOpenDiagnosticsTarget?: () => void
  readonly onSelectTask?: (task: AutomationTaskCard) => void
  readonly selectedTaskKey?: string
  readonly text: AppText
  readonly viewModel: AutomationCenterViewModel
}

const AUTOMATION_NO_WORKSPACE_ID = 'mde:no-workspace'

const getBucketLabel = (
  bucket: AutomationTaskCard['bucket'],
  text: AppText
): string => {
  switch (bucket) {
    case 'done':
      return text('automation.done')
    case 'needs-me':
      return text('automation.needsMe')
    case 'ready':
      return text('automation.ready')
    case 'running':
      return text('automation.running')
  }
}

const isAbsoluteLikePath = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('~') ||
  value.startsWith('\\\\') ||
  /^[A-Za-z]:[\\/]/.test(value)

const isSafeRelativePathHint = (value: string | undefined): value is string => {
  if (value === undefined || value.trim().length === 0 || isAbsoluteLikePath(value)) {
    return false
  }

  return !value.split(/[\\/]+/).includes('..')
}

const getSourceTypeLabel = (
  sourceType: AutomationTaskCard['sourceType'],
  text: AppText
): string | undefined => {
  switch (sourceType) {
    case 'adapter-discovered':
      return text('automation.adapterDiscoveredSource')
    case 'local-file':
      return text('automation.localFileSource')
    case 'remote-doc':
      return text('automation.remoteDocSource')
    case 'remote-issue':
      return text('automation.remoteIssueSource')
    case 'remote-mr':
      return text('automation.remoteMrSource')
    case 'user-prompt':
      return text('automation.personalPromptsSource')
    case 'workspace-markdown':
      return text('automation.taskDocsSource')
    case undefined:
      return undefined
  }
}

const getTaskSourceHint = (task: AutomationTaskCard, text: AppText): string => {
  const source =
    isSafeRelativePathHint(task.relativePath)
      ? task.relativePath
      : isSafeRelativePathHint(task.sourcePath)
        ? task.sourcePath
        : getSourceTypeLabel(task.sourceType, text) ?? text('automation.unknownSource')

  return text('automation.taskSourceHint', { source })
}

const getDiagnosticMessageKey = (
  diagnostic: AutomationCenterViewModel['diagnostics'][number]
): AppTextKey | undefined => {
  if (
    diagnostic.messageKey !== undefined &&
    isAppTextKey(diagnostic.messageKey)
  ) {
    return diagnostic.messageKey
  }

  const automationFlowKey = `automationFlow.diagnostics.${diagnostic.code.replace(
    /^automationFlow\./u,
    ''
  )}`

  if (isAppTextKey(automationFlowKey)) {
    return automationFlowKey
  }

  const automationSourceKey = `automationSource.diagnostics.${diagnostic.code.replace(
    /^automationSource\./u,
    ''
  )}`

  return isAppTextKey(automationSourceKey) ? automationSourceKey : undefined
}

const getDiagnosticMessage = (
  diagnostic: AutomationCenterViewModel['diagnostics'][number],
  text: AppText
): string => {
  const diagnosticMessageKey = getDiagnosticMessageKey(diagnostic)

  return diagnosticMessageKey !== undefined
    ? text(diagnosticMessageKey, {
        field: diagnostic.missingField ?? text('automation.diagnosticUnknownField'),
        section:
          diagnostic.sectionName ?? text('automation.diagnosticUnknownSection')
      })
    : text('automation.diagnosticUnavailable')
}

const getDiagnosticSeverityLabel = (
  severity: AutomationCenterViewModel['diagnostics'][number]['severity'],
  text: AppText
): string =>
  severity === 'error'
    ? text('automation.diagnosticError')
    : text('automation.diagnosticWarning')

const getDiagnosticsSummary = (
  diagnosticsCount: number,
  text: AppText
): string =>
  diagnosticsCount === 1
    ? text('automation.setupDiagnosticsSummaryOne')
    : text('automation.setupDiagnosticsSummaryMany', { count: diagnosticsCount })

const hasTaskWorkspace = (task: AutomationTaskCard): boolean =>
  task.workspaceId !== undefined && task.workspaceId !== AUTOMATION_NO_WORKSPACE_ID

const hasCustomExecutionRoot = (task: AutomationTaskCard): task is
  AutomationTaskCard & { readonly executionRoot: string } => {
  const normalizeComparableRoot = (value: string | undefined): string | undefined => {
    if (value === undefined) {
      return undefined
    }

    const normalized = value.trim().replace(/\\/gu, '/').replace(/\/+$/u, '')

    return normalized.length === 0 ? '/' : normalized
  }

  return (
    task.executionRoot !== undefined &&
    normalizeComparableRoot(task.executionRoot) !==
      normalizeComparableRoot(task.workspaceId)
  )
}

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0

    return codePoint <= 0x1f || codePoint === 0x7f
  })

const getWorkspaceDisplayName = (
  workspaceId: string | undefined,
  text: AppText
): string => {
  if (workspaceId === undefined || workspaceId === AUTOMATION_NO_WORKSPACE_ID) {
    return text('automation.noWorkspace')
  }

  const normalized = workspaceId.trim().replace(/\\/gu, '/')
  const workspaceName = normalized.split('/').filter(Boolean).at(-1)

  if (
    workspaceName === undefined ||
    workspaceName === '.' ||
    workspaceName === '..' ||
    hasControlCharacters(workspaceName)
  ) {
    return text('automation.workspaceUnknown')
  }

  return workspaceName
}

const getFlowDisplayName = (task: AutomationTaskCard): string =>
  task.engine === undefined
    ? task.automationFlowId
    : `${task.automationFlowId} · ${task.engine}`

const getPrimaryExecutorName = (task: AutomationTaskCard, text: AppText): string =>
  task.primaryExecutor?.displayName ?? text('automation.noSelectedExecutor')

const getTaskDescription = (
  task: AutomationTaskCard,
  bucketLabel: string,
  text: AppText
): string =>
  [
    bucketLabel,
    hasTaskWorkspace(task)
      ? getWorkspaceDisplayName(task.workspaceId, text)
      : text('automation.noWorkspace'),
    getFlowDisplayName(task),
    getPrimaryExecutorName(task, text)
  ].join(' · ')

const getTaskKey = (task: AutomationTaskCard): string => task.taskKey ?? task.taskId

export const SignalStack = ({
  onOpenDiagnosticsTarget,
  onSelectTask,
  selectedTaskKey,
  text,
  viewModel
}: SignalStackProps): JSX.Element => (
  <section
    aria-label={text('automation.signalStack')}
    className="automation-signal-stack"
    data-component-id={COMPONENT_IDS.automation.signalStack}
  >
    <div className="automation-stack-header">
      <div>
        <p className="automation-kicker">{text('automation.signalStack')}</p>
        <h1>{text('automation.taskFirstQueue')}</h1>
        <p>{text('automation.taskFirstQueueDescription')}</p>
      </div>
    </div>
    <div className="automation-source-summary">
      {text('automation.selectedAutomationSources')}
    </div>
    {(viewModel.visibleTasks ?? viewModel.tasks).length === 0 ? (
      <p className="automation-signal-empty">{text('automation.emptyTasks')}</p>
    ) : null}
    <div className="automation-card-queue">
      {(viewModel.visibleTasks ?? viewModel.tasks).map((task) => {
        const bucketLabel = getBucketLabel(task.bucket, text)
        const selected =
          getTaskKey(task) ===
          (selectedTaskKey ??
            (viewModel.selectedTask === undefined
              ? undefined
              : getTaskKey(viewModel.selectedTask)))

        return (
          <button
            aria-pressed={selected}
            className={`automation-task-card automation-task-card--${task.bucket}${
              selected ? ' automation-task-card--selected' : ''
            }`}
            data-component-id={COMPONENT_IDS.automation.signalTaskRow}
            key={getTaskKey(task)}
            onClick={() => {
              onSelectTask?.(task)
            }}
            type="button"
          >
            <span className="automation-task-card__body">
              <span className="automation-task-card__title">{task.title}</span>
              <span className="automation-task-card__description">
                {getTaskDescription(task, bucketLabel, text)}
              </span>
            </span>
            <span className="automation-task-meta" aria-hidden="true">
              <span className="automation-task-badge automation-task-badge--status">
                {bucketLabel}
              </span>
              <span className="automation-task-badge">
                {hasTaskWorkspace(task)
                  ? getWorkspaceDisplayName(task.workspaceId, text)
                  : text('automation.noWorkspace')}
              </span>
              <span className="automation-task-badge">{getFlowDisplayName(task)}</span>
              <span
                className="automation-task-badge"
                data-component-id={COMPONENT_IDS.automation.primaryExecutorLabel}
              >
                {getPrimaryExecutorName(task, text)}
              </span>
              {hasCustomExecutionRoot(task) ? (
                <span
                  className="automation-task-badge"
                  data-component-id={COMPONENT_IDS.automation.executionRootLabel}
                >
                  {text('automation.executionRootHint', {
                    root: task.executionRoot
                  })}
                </span>
              ) : null}
            </span>
            <span className="automation-task-card__footer">
              <span className="automation-task-card__source">
                {getTaskSourceHint(task, text)}
              </span>
              <span className="automation-task-card__action">
                {text('automation.inspectFlowline')}
              </span>
            </span>
          </button>
        )
      })}
    </div>
    {viewModel.diagnostics.length > 0 ? (
      <section
        aria-label={text('automation.setupDiagnostics')}
        className="automation-diagnostic-list"
        data-component-id={COMPONENT_IDS.automation.diagnosticList}
      >
        <div className="automation-diagnostic-list__header">
          <h3>{text('automation.setupDiagnostics')}</h3>
          {onOpenDiagnosticsTarget !== undefined ? (
            <button
              className="automation-diagnostic-management-button"
              data-component-id={
                COMPONENT_IDS.automation.diagnosticManagementButton
              }
              onClick={onOpenDiagnosticsTarget}
              type="button"
            >
              <FolderCog aria-hidden="true" focusable="false" size={14} />
              <span>{text('automation.diagnosticManagementAction')}</span>
            </button>
          ) : null}
        </div>
        <p className="automation-diagnostic-summary">
          {getDiagnosticsSummary(viewModel.diagnostics.length, text)}
        </p>
        <div className="automation-diagnostic-rows">
          {viewModel.diagnostics.map((diagnostic) => (
            <article
              className={`automation-diagnostic-row automation-diagnostic-row--${diagnostic.severity}`}
              key={diagnostic.diagnosticId}
            >
              <div>
                <span className="automation-diagnostic-label">
                  {getDiagnosticSeverityLabel(diagnostic.severity, text)}
                </span>
                <p>{getDiagnosticMessage(diagnostic, text)}</p>
                <ul className="automation-diagnostic-meta">
                  {diagnostic.sourceFile !== undefined ? (
                    <li>
                      {text('automation.diagnosticFile', {
                        path: diagnostic.sourceFile
                      })}
                    </li>
                  ) : null}
                  {diagnostic.automationFlowId !== undefined ? (
                    <li>
                      {text('automation.diagnosticFlow', {
                        flowId: diagnostic.automationFlowId
                      })}
                    </li>
                  ) : null}
                  <li>
                    {text('automation.diagnosticCode', {
                      code: diagnostic.code
                    })}
                  </li>
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    ) : null}
  </section>
)
