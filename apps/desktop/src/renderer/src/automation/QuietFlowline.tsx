import { useState, type JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AutomationCenterViewModel, AutomationFlowlinePhaseStatus } from './automationViewModel'
import type {
  AutomationRunSummary,
  AutomationTaskCard,
  AutomationTaskExecutorSummary
} from '../../../shared/automation'

interface QuietFlowlineProps {
  readonly onClearSelection?: () => void
  readonly onStartTask?: (
    task: AutomationTaskCard,
    executor: AutomationTaskExecutorSummary
  ) => void
  readonly onSubmitDecision?: (decisionId: string, response: string) => void
  readonly text: AppText
  readonly viewModel: AutomationCenterViewModel
}

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

const getPhaseStatusLabel = (
  status: AutomationFlowlinePhaseStatus,
  text: AppText
): string =>
  status === 'pending' ? text('automation.pending') : getBucketLabel(status, text)

const getRunStateLabel = (
  state: AutomationRunSummary['state'],
  text: AppText
): string => {
  switch (state) {
    case 'cancelled':
      return text('automation.runStateCancelled')
    case 'done':
      return text('automation.done')
    case 'failed':
      return text('automation.runStateFailed')
    case 'needs-me':
      return text('automation.needsMe')
    case 'running':
      return text('automation.running')
    case 'starting':
      return text('automation.runStateStarting')
  }
}

const getTaskSourceSummary = (
  task: AutomationTaskCard,
  viewModel: AutomationCenterViewModel,
  text: AppText
): string =>
  viewModel.readyPreview?.sourceSummary ??
  task.relativePath ??
  task.sourceUri ??
  task.sourceType ??
  text('automation.unknownSource')

const getTaskFlowName = (
  task: AutomationTaskCard,
  viewModel: AutomationCenterViewModel
): string => viewModel.readyPreview?.flowName ?? task.automationFlowId

const getTaskEngine = (
  task: AutomationTaskCard,
  viewModel: AutomationCenterViewModel
): string => viewModel.readyPreview?.engine ?? task.engine ?? 'codex'

const getExecutorLabel = (
  executor: AutomationTaskExecutorSummary | undefined,
  text: AppText
): string => executor?.displayName ?? text('automation.noSelectedExecutor')

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

const getExecutionRecordRoot = (
  run: AutomationRunSummary,
  text: AppText
): string => run.executionRoot ?? run.workspaceId ?? text('automation.noWorkspace')

const getExecutionRootReasonText = (
  reason: string | undefined,
  text: AppText
): string => {
  switch (reason) {
    case 'the path is empty or malformed':
      return text('automation.executionRootReasonMalformed')
    case 'the path is not a valid absolute local path':
      return text('automation.executionRootReasonInvalidAbsolutePath')
    case 'the path is not an existing directory':
      return text('automation.executionRootReasonMissingDirectory')
    default:
      return text('automation.executionRootReasonInvalidAbsolutePath')
  }
}

const getBlockingDiagnosticText = (
  diagnostic: NonNullable<AutomationTaskCard['blockingDiagnostics']>[number],
  selectedTask: AutomationTaskCard,
  text: AppText
): string => {
  if (
    diagnostic.code === 'automationRun.invalidExecutionRoot' &&
    diagnostic.executionRoot !== undefined
  ) {
    return text('automation.executionRootDiagnosticDetail', {
      reason: getExecutionRootReasonText(diagnostic.userSafeReason, text),
      root: diagnostic.executionRoot,
      task: diagnostic.taskTitle ?? selectedTask.title
    })
  }

  return text('automation.diagnosticUnavailable')
}

const getTaskKey = (task: AutomationTaskCard): string => task.taskKey ?? task.taskId

export const QuietFlowline = ({
  onClearSelection,
  onStartTask,
  onSubmitDecision,
  text,
  viewModel
}: QuietFlowlineProps): JSX.Element => {
  const selectedTask = viewModel.selectedTask
  const [executorSelection, setExecutorSelection] = useState<{
    readonly executorId?: string
    readonly taskKey?: string
  }>({})

  const eligibleExecutors = selectedTask?.eligibleExecutors ?? []
  const selectedExecutorId =
    executorSelection.taskKey ===
      (selectedTask === undefined ? undefined : getTaskKey(selectedTask))
      ? executorSelection.executorId ?? selectedTask?.primaryExecutor?.executorId
      : selectedTask?.primaryExecutor?.executorId
  const selectedExecutor =
    eligibleExecutors.find((executor) => executor.executorId === selectedExecutorId) ??
    selectedTask?.primaryExecutor
  const blockingDiagnostics = selectedTask?.blockingDiagnostics ?? []
  const startBlocked = blockingDiagnostics.length > 0 || selectedExecutor === undefined
  const selectedTaskRuns = viewModel.selectedTaskRuns ?? []

  return (
    <section
      aria-label={text('automation.flowline')}
      className="automation-flowline"
      data-component-id={COMPONENT_IDS.automation.flowline}
    >
      {selectedTask === undefined ? (
        <>
          <h2>{text('automation.flowline')}</h2>
          <p>{text('automation.flowlineEmpty')}</p>
        </>
      ) : (
        <>
          <div className="automation-flow-head">
            <div>
              <p className="automation-kicker">{text('automation.flowline')}</p>
              <h2>{selectedTask.title}</h2>
              <p>
                {[
                  getBucketLabel(selectedTask.bucket, text),
                  selectedTask.bucket === 'ready'
                    ? text('automation.readyFlowlineDescription')
                    : text('automation.flowlineTaskLifecycleDescription')
                ].join(' · ')}
              </p>
            </div>
            <button
              aria-label={text('automation.closeFlowlineDetail')}
              className="automation-flowline-close"
              data-component-id={COMPONENT_IDS.automation.flowlineCloseButton}
              onClick={() => {
                onClearSelection?.()
              }}
              title={text('automation.closeFlowlineDetail')}
              type="button"
            >
              x
            </button>
          </div>
          <dl className="automation-flowline-meta">
            <div>
              <dt>{text('automation.sourceSummary')}</dt>
              <dd>{getTaskSourceSummary(selectedTask, viewModel, text)}</dd>
            </div>
            <div>
              <dt>{text('automation.owningFlow')}</dt>
              <dd>{getTaskFlowName(selectedTask, viewModel)}</dd>
            </div>
            <div data-component-id={COMPONENT_IDS.automation.primaryExecutorLabel}>
              <dt>{text('automation.primaryExecutor')}</dt>
              <dd>{getExecutorLabel(selectedTask.primaryExecutor, text)}</dd>
            </div>
            <div>
              <dt>{text('automation.engine')}</dt>
              <dd>{getTaskEngine(selectedTask, viewModel)}</dd>
            </div>
            {hasCustomExecutionRoot(selectedTask) ? (
              <div data-component-id={COMPONENT_IDS.automation.executionRootLabel}>
                <dt>{text('automation.executionRoot')}</dt>
                <dd>{selectedTask.executionRoot}</dd>
              </div>
            ) : null}
          </dl>
          {eligibleExecutors.length > 1 ? (
            <label className="automation-executor-selector">
              <span>{text('automation.executorSelector')}</span>
              <select
                data-component-id={COMPONENT_IDS.automation.executorSelector}
                onChange={(event) => {
                  setExecutorSelection({
                    executorId: event.currentTarget.value,
                    taskKey: getTaskKey(selectedTask)
                  })
                }}
                value={selectedExecutor?.executorId}
              >
                {eligibleExecutors.map((executor) => (
                  <option key={executor.executorId} value={executor.executorId}>
                    {executor.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {blockingDiagnostics.length > 0 ? (
            <section
              aria-label={text('automation.blockedStartDiagnostics')}
              className="automation-blocked-start-diagnostics"
              data-component-id={COMPONENT_IDS.automation.blockedStartDiagnosticsPanel}
            >
              <h3>{text('automation.blockedStartDiagnostics')}</h3>
              {blockingDiagnostics.map((diagnostic) => (
                <p
                  data-component-id={COMPONENT_IDS.automation.blockedStartDiagnosticRow}
                  key={diagnostic.code}
                >
                  {getBlockingDiagnosticText(diagnostic, selectedTask, text)}
                </p>
              ))}
            </section>
          ) : null}
          <section
            aria-label={text('automation.phasePlanPreview')}
            className="automation-ready-phase-plan"
          >
            <h3>{text('automation.phasePlanPreview')}</h3>
            <ol className="automation-flowline-phases">
              {viewModel.phases.map((phase) => (
                <li
                  className={`automation-flowline-phase automation-flowline-phase--${phase.status}`}
                  data-component-id={COMPONENT_IDS.automation.flowlinePhase}
                  key={phase.phaseId}
                >
                  <h3>
                    {text(phase.titleKey)}
                    <span>{getPhaseStatusLabel(phase.status, text)}</span>
                  </h3>
                  <p>{text(phase.descriptionKey)}</p>
                </li>
              ))}
            </ol>
          </section>
          {viewModel.selectedDecision !== undefined ? (
            <section
              aria-label={text('automation.decisionPrompt')}
              className="automation-decision-panel"
              data-component-id={COMPONENT_IDS.automation.decisionPanel}
            >
              <h3>{text('automation.decisionPrompt')}</h3>
              <p>{viewModel.selectedDecision.prompt}</p>
            </section>
          ) : null}
          {selectedTaskRuns.length > 0 ? (
            <section
              aria-label={text('automation.executionRecords')}
              className="automation-execution-records"
              data-component-id={COMPONENT_IDS.automation.executionRecordsPanel}
            >
              <h3>{text('automation.executionRecords')}</h3>
              <ul>
                {selectedTaskRuns.map((run) => (
                  <li
                    data-component-id={COMPONENT_IDS.automation.executionRecordRow}
                    key={run.runId}
                  >
                    <strong>{run.title ?? run.runId}</strong>
                    <span>
                      {text('automation.executionRecordSummary', {
                        executor: run.executorId ?? text('automation.noSelectedExecutor'),
                        root: getExecutionRecordRoot(run, text),
                        state: getRunStateLabel(run.state, text)
                      })}
                    </span>
                    {run.reportReference !== undefined ? (
                      <>
                        <span>
                          {text('automation.executionRecordReport', {
                            reportId: run.reportReference.reportId,
                            title: run.reportReference.title
                          })}
                        </span>
                        {run.reportReference.summary !== undefined ? (
                          <span>
                            {text('automation.executionRecordReportSummary', {
                              summary: run.reportReference.summary
                            })}
                          </span>
                        ) : null}
                        {run.reportReference.evidencePath !== undefined ? (
                          <span>
                            {text('automation.executionRecordReportReference', {
                              reference: run.reportReference.evidencePath
                            })}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {selectedTask.bucket === 'ready' || viewModel.selectedDecision !== undefined ? (
            <div className="automation-flowline-actions">
              {selectedTask.bucket === 'ready' ? (
                <button
                  className="automation-flowline-start"
                  data-component-id={COMPONENT_IDS.automation.selectedExecutorStartButton}
                  disabled={startBlocked}
                  onClick={() => {
                    if (selectedExecutor !== undefined) {
                      onStartTask?.(selectedTask, selectedExecutor)
                    }
                  }}
                  type="button"
                >
                  {text('automation.startTaskWithSelectedExecutor')}
                </button>
              ) : null}
              {viewModel.selectedDecision !== undefined ? (
                <button
                  data-component-id={COMPONENT_IDS.automation.decisionApproveButton}
                  onClick={() => {
                    const decision = viewModel.selectedDecision

                    if (decision !== undefined) {
                      onSubmitDecision?.(decision.decisionId, 'approved')
                    }
                  }}
                  type="button"
                >
                  {text('automation.decisionAction')}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
