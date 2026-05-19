import { ExternalLink, X } from 'lucide-react'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText, AppTextKey } from '../i18n/appLanguage'
import type {
  AutomationRunKind,
  AutomationRunState,
  AutomationRunSummary
} from '../../../shared/automation'

interface AutomationRunHistoryProps {
  readonly onOpenNativeSession?: (runId: string) => void
  readonly runs: readonly AutomationRunSummary[]
  readonly text: AppText
}

const getRunKindLabelKey = (runKind: AutomationRunKind): AppTextKey =>
  runKind === 'discovery'
    ? 'automation.runKindDiscovery'
    : 'automation.runKindTask'

const getRunStateLabelKey = (state: AutomationRunState): AppTextKey => {
  switch (state) {
    case 'cancelled':
      return 'automation.runStateCancelled'
    case 'done':
      return 'automation.done'
    case 'failed':
      return 'automation.runStateFailed'
    case 'needs-me':
      return 'automation.needsMe'
    case 'running':
      return 'automation.running'
    case 'starting':
      return 'automation.runStateStarting'
  }
}

const getRunTitle = (run: AutomationRunSummary): string =>
  run.title ?? run.taskId ?? run.automationFlowId

const getRunSourceLabel = (
  source: NonNullable<AutomationRunSummary['discoveryResult']>['sources'][number]
): string =>
  source.relativePath ?? source.sourcePath ?? source.sourceUri ?? source.sourceItemId

const formatRunTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  return date.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  })
}

const sortRunHistory = (
  runs: readonly AutomationRunSummary[]
): readonly AutomationRunSummary[] =>
  Object.freeze(
    [...runs].sort(
      (left, right) =>
        right.startedAt.localeCompare(left.startedAt) ||
        right.runId.localeCompare(left.runId)
    )
  )

const getProcessStepLabel = (
  run: AutomationRunSummary,
  step: NonNullable<AutomationRunSummary['processSteps']>[number],
  text: AppText
): string => {
  switch (step.type) {
    case 'discovered-task-sources':
      return step.sourceCount === 1
        ? text('automation.runProcessDiscoveredSourcesOne')
        : text('automation.runProcessDiscoveredSourcesMany', {
            count: step.sourceCount
          })
    case 'started':
      return text('automation.runProcessStarted')
    case 'state-updated':
      return text('automation.runProcessStateUpdated', {
        state: text(getRunStateLabelKey(step.state))
      })
  }
}

const getProcessSteps = (
  run: AutomationRunSummary
): NonNullable<AutomationRunSummary['processSteps']> =>
  run.processSteps ??
  Object.freeze([
    Object.freeze({
      createdAt: run.startedAt,
      type: 'started'
    }),
    Object.freeze({
      createdAt: run.updatedAt,
      state: run.state,
      type: 'state-updated'
    })
  ])

export const AutomationRunHistory = ({
  onOpenNativeSession,
  runs,
  text
}: AutomationRunHistoryProps): JSX.Element => {
  const sortedRuns = sortRunHistory(runs)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const selectedRun =
    selectedRunId === null
      ? undefined
      : sortedRuns.find((run) => run.runId === selectedRunId)

  useEffect(() => {
    if (selectedRun === undefined) {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSelectedRunId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedRun])

  return (
    <section
      aria-label={text('automation.runHistory')}
      className="automation-run-history"
      data-component-id={COMPONENT_IDS.automation.runHistoryPanel}
    >
      <div className="automation-run-history__header">
        <div>
          <p className="automation-kicker">{text('automation.runHistory')}</p>
          <h2>{text('automation.runHistory')}</h2>
        </div>
        <span>{sortedRuns.length}</span>
      </div>
      {sortedRuns.length === 0 ? (
        <p className="automation-run-history__empty">
          {text('automation.runHistoryEmpty')}
        </p>
      ) : (
        <div className="automation-run-history__rows">
          {sortedRuns.map((run) => {
            const stateLabel = text(getRunStateLabelKey(run.state))
            const canOpenNativeSession =
              run.availableActions?.includes('open-native-session') ?? false

            return (
              <article
                aria-label={`${getRunTitle(run)} ${stateLabel}`}
                className={`automation-run-history-row automation-run-history-row--${run.state}`}
                data-component-id={COMPONENT_IDS.automation.runHistoryRow}
                key={run.runId}
              >
                <button
                  aria-label={text('automation.openRunDetailsForRun', {
                    runId: run.runId
                  })}
                  className="automation-run-history-row__body automation-run-history-row__detail-button"
                  data-component-id={
                    COMPONENT_IDS.automation.runHistoryDetailButton
                  }
                  onClick={() => {
                    setSelectedRunId(run.runId)
                  }}
                  type="button"
                >
                  <span className="automation-run-history-row__id">
                    {run.runId}
                  </span>
                  <span className="automation-run-history-row__title">
                    {getRunTitle(run)}
                  </span>
                  <span className="automation-run-history-row__summary">
                    {[
                      text(getRunKindLabelKey(run.runKind)),
                      run.engine,
                      text('automation.runUpdatedAt', {
                        time: formatRunTimestamp(run.updatedAt)
                      })
                    ].join(' · ')}
                  </span>
                </button>
                <div className="automation-run-history-row__meta">
                  <span>{stateLabel}</span>
                  {canOpenNativeSession ? (
                    <button
                      aria-label={text('automation.openNativeSessionForRun', {
                        runId: run.runId
                      })}
                      className="automation-run-history-row__native-session"
                      data-component-id={
                        COMPONENT_IDS.automation.runHistoryNativeSessionButton
                      }
                      onClick={() => {
                        onOpenNativeSession?.(run.runId)
                      }}
                      title={text('automation.openNativeSession')}
                      type="button"
                    >
                      <ExternalLink aria-hidden="true" focusable="false" size={15} />
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {selectedRun !== undefined ? (
        <div className="automation-run-history-detail-backdrop">
          <section
            aria-labelledby="automation-run-history-detail-title"
            aria-modal="true"
            className="automation-run-history-detail"
            data-component-id={COMPONENT_IDS.automation.runHistoryDetailDialog}
            role="dialog"
          >
            <header className="automation-run-history-detail__header">
              <div>
                <p className="automation-kicker">
                  {text(getRunKindLabelKey(selectedRun.runKind))}
                </p>
                <h2 id="automation-run-history-detail-title">
                  {text('automation.runDetails')}
                </h2>
              </div>
              <button
                aria-label={text('automation.closeRunDetails')}
                className="automation-run-history-detail__close"
                data-component-id={
                  COMPONENT_IDS.automation.runHistoryDetailCloseButton
                }
                onClick={() => {
                  setSelectedRunId(null)
                }}
                title={text('automation.closeRunDetails')}
                type="button"
              >
                <X aria-hidden="true" focusable="false" size={16} />
              </button>
            </header>
            <div className="automation-run-history-detail__meta">
              <span>{selectedRun.runId}</span>
              <span>{selectedRun.engine}</span>
              <span>{text(getRunStateLabelKey(selectedRun.state))}</span>
              {selectedRun.executionRoot !== undefined ? (
                <span data-component-id={COMPONENT_IDS.automation.executionRootLabel}>
                  {text('automation.executionRootHint', {
                    root: selectedRun.executionRoot
                  })}
                </span>
              ) : null}
            </div>
            <section className="automation-run-history-detail__section">
              <h3>{text('automation.parseResult')}</h3>
              {selectedRun.discoveryResult !== undefined &&
              selectedRun.discoveryResult.sources.length > 0 ? (
                <ul className="automation-run-history-detail__sources">
                  {selectedRun.discoveryResult.sources.map((source) => (
                    <li key={source.sourceItemId}>
                      <strong>{source.title}</strong>
                      <span>{getRunSourceLabel(source)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{text('automation.parseResultEmpty')}</p>
              )}
            </section>
            <section className="automation-run-history-detail__section">
              <h3>{text('automation.parseProcess')}</h3>
              <ol className="automation-run-history-detail__steps">
                {getProcessSteps(selectedRun).map((step, index) => (
                  <li key={`${step.type}:${index}`}>
                    <span>{getProcessStepLabel(selectedRun, step, text)}</span>
                    <time dateTime={step.createdAt}>
                      {formatRunTimestamp(step.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          </section>
        </div>
      ) : null}
    </section>
  )
}
