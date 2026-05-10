import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AutomationCenterViewModel } from './automationViewModel'
import type { AutomationTaskCard } from '../../../shared/automation'

interface SignalStackProps {
  readonly onStartTask?: (task: AutomationTaskCard) => void
  readonly text: AppText
  readonly viewModel: AutomationCenterViewModel
}

interface TaskBucketProps {
  readonly bucketClassName: string
  readonly label: string
  readonly onStartTask?: (task: AutomationTaskCard) => void
  readonly tasks: readonly AutomationTaskCard[]
  readonly text: AppText
}

const TaskBucket = ({
  bucketClassName,
  label,
  onStartTask,
  tasks,
  text
}: TaskBucketProps): JSX.Element => (
  <section
    aria-label={label}
    className="automation-bucket"
    data-component-id={COMPONENT_IDS.automation.bucket}
  >
    <h3 className="automation-bucket-heading">
      {label}
      <span>{tasks.length}</span>
    </h3>
    {tasks.length === 0 ? (
      <p className="automation-bucket-empty">{text('automation.bucketEmpty')}</p>
    ) : null}
    {tasks.map((task) => (
      <article
        className={`automation-task-card ${bucketClassName}`}
        data-component-id={COMPONENT_IDS.automation.taskCard}
        key={task.taskId}
      >
        <h2>{task.title}</h2>
        <p>
          {label}
          {task.engine === undefined ? '' : ` · ${task.engine}`}
        </p>
        <div className="automation-task-meta">
          <span>{label}</span>
          <span>{task.automationFlowId}</span>
        </div>
        {task.bucket === 'ready' ? (
          <button
            className="automation-task-start"
            data-component-id={COMPONENT_IDS.automation.startTaskButton}
            onClick={() => onStartTask?.(task)}
            type="button"
          >
            {text('automation.startTask')}
          </button>
        ) : null}
      </article>
    ))}
  </section>
)

export const SignalStack = ({
  onStartTask,
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
      {text('automation.selectedSources')}
    </div>
    {viewModel.tasks.length === 0 ? <p>{text('automation.emptyTasks')}</p> : null}
    <div className="automation-bucket-grid">
      <TaskBucket
        bucketClassName="automation-task-card--needs-me"
        label={text('automation.needsMe')}
        onStartTask={onStartTask}
        tasks={viewModel.needsMeTasks}
        text={text}
      />
      <TaskBucket
        bucketClassName="automation-task-card--running"
        label={text('automation.running')}
        onStartTask={onStartTask}
        tasks={viewModel.runningTasks}
        text={text}
      />
      <TaskBucket
        bucketClassName="automation-task-card--ready"
        label={text('automation.ready')}
        onStartTask={onStartTask}
        tasks={viewModel.readyTasks}
        text={text}
      />
      <TaskBucket
        bucketClassName="automation-task-card--done"
        label={text('automation.done')}
        onStartTask={onStartTask}
        tasks={viewModel.doneTasks}
        text={text}
      />
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
            <li key={diagnostic.diagnosticId}>{diagnostic.message}</li>
          ))}
        </ul>
      </section>
    ) : null}
  </section>
)
