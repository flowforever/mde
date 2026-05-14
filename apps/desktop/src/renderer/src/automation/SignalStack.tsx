import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import { isAppTextKey, type AppText } from '../i18n/appLanguage'
import type { AutomationCenterViewModel } from './automationViewModel'
import type { AutomationTaskCard } from '../../../shared/automation'

interface SignalStackProps {
  readonly onSelectTask?: (task: AutomationTaskCard) => void
  readonly selectedTaskId?: string
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

const getDiagnosticMessage = (
  diagnostic: AutomationCenterViewModel['diagnostics'][number],
  text: AppText
): string =>
  diagnostic.messageKey !== undefined && isAppTextKey(diagnostic.messageKey)
    ? text(diagnostic.messageKey)
    : text('automation.diagnosticUnavailable')

const hasTaskWorkspace = (task: AutomationTaskCard): boolean =>
  task.workspaceId !== undefined && task.workspaceId !== AUTOMATION_NO_WORKSPACE_ID

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

export const SignalStack = ({
  onSelectTask,
  selectedTaskId,
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
    <div className="automation-flat-queue">
      {(viewModel.visibleTasks ?? viewModel.tasks).map((task) => {
        const bucketLabel = getBucketLabel(task.bucket, text)
        const selected =
          task.taskId === (selectedTaskId ?? viewModel.selectedTask?.taskId)

        return (
          <button
            aria-pressed={selected}
            className={`automation-task-row${
              selected ? ' automation-task-row--selected' : ''
            } automation-task-row--${task.bucket}`}
            data-component-id={COMPONENT_IDS.automation.signalTaskRow}
            key={task.taskId}
            onClick={() => {
              onSelectTask?.(task)
            }}
            type="button"
          >
            <span className="automation-task-row__status">{bucketLabel}</span>
            <span className="automation-task-row__title">{task.title}</span>
            <span className="automation-task-row__meta">
              {task.engine === undefined
                ? task.automationFlowId
                : `${task.automationFlowId} · ${task.engine}`}
            </span>
            <span className="automation-task-row__meta">
              {hasTaskWorkspace(task)
                ? getWorkspaceDisplayName(task.workspaceId, text)
                : text('automation.noWorkspace')}
            </span>
            <span className="automation-task-row__meta">
              {getTaskSourceHint(task, text)}
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
        <h3>{text('automation.setupDiagnostics')}</h3>
        <ul>
          {viewModel.diagnostics.map((diagnostic) => (
            <li key={diagnostic.diagnosticId}>
              {getDiagnosticMessage(diagnostic, text)}
            </li>
          ))}
        </ul>
      </section>
    ) : null}
  </section>
)
