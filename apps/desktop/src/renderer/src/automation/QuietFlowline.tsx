import { useState, type JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AutomationCenterViewModel, AutomationFlowlinePhaseStatus } from './automationViewModel'
import type {
  AutomationTaskCard,
  AutomationTaskExecutorSummary
} from '../../../shared/automation'

interface QuietFlowlineProps {
  readonly onClearSelection?: () => void
  readonly onStartTask?: (
    taskId: string,
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
    readonly taskId?: string
  }>({})

  const eligibleExecutors = selectedTask?.eligibleExecutors ?? []
  const selectedExecutorId =
    executorSelection.taskId === selectedTask?.taskId
      ? executorSelection.executorId ?? selectedTask?.primaryExecutor?.executorId
      : selectedTask?.primaryExecutor?.executorId
  const selectedExecutor =
    eligibleExecutors.find((executor) => executor.executorId === selectedExecutorId) ??
    selectedTask?.primaryExecutor
  const blockingDiagnostics = selectedTask?.blockingDiagnostics ?? []
  const startBlocked = blockingDiagnostics.length > 0 || selectedExecutor === undefined

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
          </dl>
          {eligibleExecutors.length > 1 ? (
            <label className="automation-executor-selector">
              <span>{text('automation.executorSelector')}</span>
              <select
                data-component-id={COMPONENT_IDS.automation.executorSelector}
                onChange={(event) => {
                  setExecutorSelection({
                    executorId: event.currentTarget.value,
                    taskId: selectedTask.taskId
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
                  {text('automation.diagnosticUnavailable')}
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
          {selectedTask.bucket === 'ready' || viewModel.selectedDecision !== undefined ? (
            <div className="automation-flowline-actions">
              {selectedTask.bucket === 'ready' ? (
                <button
                  className="automation-flowline-start"
                  data-component-id={COMPONENT_IDS.automation.selectedExecutorStartButton}
                  disabled={startBlocked}
                  onClick={() => {
                    if (selectedExecutor !== undefined) {
                      onStartTask?.(selectedTask.taskId, selectedExecutor)
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
