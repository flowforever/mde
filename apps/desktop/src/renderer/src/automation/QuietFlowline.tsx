import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AutomationCenterViewModel } from './automationViewModel'

interface QuietFlowlineProps {
  readonly onStartTask?: (taskId: string) => void
  readonly onSubmitDecision?: (decisionId: string, response: string) => void
  readonly text: AppText
  readonly viewModel: AutomationCenterViewModel
}

export const QuietFlowline = ({
  onStartTask,
  onSubmitDecision,
  text,
  viewModel
}: QuietFlowlineProps): JSX.Element => (
  <section
    aria-label={text('automation.flowline')}
    className="automation-flowline"
    data-component-id={COMPONENT_IDS.automation.flowline}
  >
    <h2>{text('automation.flowline')}</h2>
    {viewModel.selectedTask === undefined ? (
      <p>{text('automation.flowlineEmpty')}</p>
    ) : viewModel.selectedTask.bucket === 'ready' ? (
      <div className="automation-ready-preview">
        <p className="automation-kicker">{text('automation.readyFlowline')}</p>
        <h2>{viewModel.selectedTask.title}</h2>
        <p>{text('automation.readyFlowlineDescription')}</p>
        <dl>
          <div>
            <dt>{text('automation.sourceSummary')}</dt>
            <dd>{viewModel.readyPreview?.sourceSummary}</dd>
          </div>
          <div>
            <dt>{text('automation.owningFlow')}</dt>
            <dd>{viewModel.readyPreview?.flowName}</dd>
          </div>
          <div>
            <dt>{text('automation.engine')}</dt>
            <dd>{viewModel.readyPreview?.engine}</dd>
          </div>
        </dl>
        <section
          aria-label={text('automation.phasePlanPreview')}
          className="automation-ready-phase-plan"
          data-component-id={COMPONENT_IDS.automation.flowlinePhase}
        >
          <h3>{text('automation.phasePlanPreview')}</h3>
          <ol>
            {(viewModel.readyPreview?.phases ?? []).map((phaseKey) => (
              <li key={phaseKey}>{text(phaseKey)}</li>
            ))}
          </ol>
        </section>
        <button
          className="automation-flowline-start"
          data-component-id={COMPONENT_IDS.automation.flowlineStartButton}
          onClick={() => {
            if (viewModel.selectedTask !== undefined) {
              onStartTask?.(viewModel.selectedTask.taskId)
            }
          }}
          type="button"
        >
          {text('automation.startTask')}
        </button>
      </div>
    ) : (
      <ol className="automation-flowline-phases">
        {viewModel.phases.map((phase) => (
          <li
            className={`automation-flowline-phase automation-flowline-phase--${phase.status}`}
            data-component-id={COMPONENT_IDS.automation.flowlinePhase}
            key={phase.phaseId}
          >
            {phase.title}
          </li>
        ))}
      </ol>
    )}
    {viewModel.selectedDecision !== undefined ? (
      <section
        aria-label={text('automation.decisionPrompt')}
        className="automation-decision-panel"
        data-component-id={COMPONENT_IDS.automation.decisionPanel}
      >
        <h3>{text('automation.decisionPrompt')}</h3>
        <p>{viewModel.selectedDecision.prompt}</p>
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
      </section>
    ) : null}
  </section>
)
