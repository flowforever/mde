import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AutomationCenterViewModel } from './automationViewModel'

interface QuietFlowlineProps {
  readonly onSubmitDecision?: (decisionId: string, response: string) => void
  readonly text: AppText
  readonly viewModel: AutomationCenterViewModel
}

export const QuietFlowline = ({
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
