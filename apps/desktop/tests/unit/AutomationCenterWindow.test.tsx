import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AutomationCenterWindow } from '../../src/renderer/src/automation/AutomationCenterWindow'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
import type { AutomationApi, AutomationProjection } from '../../src/shared/automation'

vi.mock('@mde/editor-react', async () => {
  const actual = await vi.importActual('@mde/editor-react')

  return {
    ...(actual as object),
    MarkdownBlockEditor: (props: {
      readonly draftMarkdown: string
      readonly onMarkdownChange: (contents: string) => void
      readonly path: string
    }) => (
      <div data-component-id="editor.markdown-editor-shell">
        <div data-component-id="editor.markdown-editing-surface">
          <span>{props.path}</span>
          <button
            onClick={() => props.onMarkdownChange('# Updated automation-flow')}
            type="button"
          >
            Change automation markdown
          </button>
          <span>{props.draftMarkdown}</span>
        </div>
      </div>
    )
  }
})

vi.mock('../../src/renderer/src/agentChat/AgentChatPanel', () => ({
  AgentChatPanel: () => (
    <section data-component-id="agent-chat.panel">Agent Chat Panel</section>
  )
}))

const projection: AutomationProjection = {
  buckets: {
    done: [],
    needsMe: [],
    ready: [
      {
        automationFlowId: 'flow-a',
        automationFlowOwnerKey: 'workspace:/workspace:flow:flow-a',
        bucket: 'ready',
        eligibleExecutors: [
          {
            displayName: 'Implementation',
            executorId: 'implementation',
            executorSnapshotId: 'executor-snapshot-a',
            type: 'markdown'
          }
        ],
        executorSnapshotId: 'executor-snapshot-a',
        primaryExecutor: {
          displayName: 'Implementation',
          executorId: 'implementation',
          executorSnapshotId: 'executor-snapshot-a',
          type: 'markdown'
        },
        sourceItemId: 'source-a',
        taskId: 'task-a',
        taskDataId: 'task-data-a',
        taskDataSnapshotId: 'task-data-snapshot-a',
        title: 'READY Implement UI'
      }
    ],
    running: []
  },
  decisions: [],
  diagnostics: [],
  filters: {
    bucket: 'ready',
    flowOwnerKeys: [],
    scopeIds: ['workspace:/workspace']
  },
  flows: [
    {
      automationFlowId: 'flow-a',
      automationFlowOwnerKey: 'workspace:/workspace:flow:flow-a',
      definitionPath: '/workspace/.mde/automation-flows/flow-a.md',
      lifecycle: 'enabled',
      name: 'Workspace Flow',
      scope: 'workspace',
      sourceTypes: ['workspace-markdown'],
      status: 'formal',
      taskCount: 1,
      workspaceId: '/workspace'
    }
  ],
  generatedAt: '2026-05-10T08:00:00.000Z',
  reports: [],
  runs: [],
  workspaceRoot: '/workspace',
  tasks: [
    {
      automationFlowId: 'flow-a',
      automationFlowOwnerKey: 'workspace:/workspace:flow:flow-a',
      bucket: 'ready',
      eligibleExecutors: [
        {
          displayName: 'Implementation',
          executorId: 'implementation',
          executorSnapshotId: 'executor-snapshot-a',
          type: 'markdown'
        }
      ],
      executorSnapshotId: 'executor-snapshot-a',
      primaryExecutor: {
        displayName: 'Implementation',
        executorId: 'implementation',
        executorSnapshotId: 'executor-snapshot-a',
        type: 'markdown'
      },
      sourceItemId: 'source-a',
      taskId: 'task-a',
      taskDataId: 'task-data-a',
      taskDataSnapshotId: 'task-data-snapshot-a',
      title: 'READY Implement UI'
    }
  ]
}

const needsMeProjection: AutomationProjection = {
  ...projection,
  buckets: {
    done: [],
    needsMe: [
      {
        activeRunId: 'run-needs-me',
        automationFlowId: 'flow-a',
        bucket: 'needs-me',
        sourceItemId: 'source-a',
        taskId: 'task-a',
        title: 'READY Implement UI'
      }
    ],
    ready: [],
    running: []
  },
  decisions: [
    {
      createdAt: '2026-05-10T08:01:00.000Z',
      decisionId: 'decision-a',
      prompt: 'Approve resume?',
      runId: 'run-needs-me',
      status: 'pending',
      taskId: 'task-a',
      type: 'approval'
    }
  ],
  filters: {
    ...projection.filters,
    bucket: 'needsMe'
  },
  runs: [
    {
      automationFlowId: 'flow-a',
      engine: 'codex',
      runId: 'run-needs-me',
      runKind: 'task',
      startedAt: '2026-05-10T08:00:00.000Z',
      state: 'needs-me',
      taskId: 'task-a',
      updatedAt: '2026-05-10T08:01:00.000Z'
    }
  ],
  tasks: [
    {
      activeRunId: 'run-needs-me',
      automationFlowId: 'flow-a',
      bucket: 'needs-me',
      sourceItemId: 'source-a',
      taskId: 'task-a',
      title: 'READY Implement UI'
    }
  ]
}

describe('AutomationCenterWindow', () => {
  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(window, 'editorApi')
    Reflect.deleteProperty(window, 'mdeWindow')
    localStorage.clear()
  })

  it('composes workspace filters, resize handle, Signal Stack, and Quiet Flowline from IPC projection', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection }))
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    expect(await screen.findByRole('main', { name: 'Automation Center' }))
      .toHaveClass('app-shell')
    expect(await screen.findByRole('region', { name: 'Workspace flows' }))
      .toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Automation Center' }))
      .toHaveClass('editor-pane')
    expect(screen.getByRole('region', { name: 'Signal Stack' }))
      .toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Flowline' })).toBeInTheDocument()
    expect(
      screen.getByRole('separator', { name: 'Resize Automation Center sidebar' })
    ).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.sidebarResizeHandle
    )
    expect(screen.getAllByText('READY Implement UI').length).toBeGreaterThan(1)
  })

  it('returns focus to the workspace window from the left panel', async () => {
    const focusWorkspaceWindow = vi.fn(() => Promise.resolve())
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection }))
    } as unknown as AutomationApi

    Object.defineProperty(window, 'mdeWindow', {
      configurable: true,
      value: { focusWorkspaceWindow }
    })

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Return to workspace' })
    )

    expect(focusWorkspaceWindow).toHaveBeenCalledTimes(1)
  })

  it('persists selected automation-flow filters and refreshes the projection', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      updateFilters: vi.fn(() => Promise.resolve({ accepted: true }))
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    const flowFilterSelector = `[data-component-id="${COMPONENT_IDS.automation.flowFilterToggle}"]`

    await waitFor(() => {
      expect(document.querySelector(flowFilterSelector)).toBeInstanceOf(
        HTMLElement
      )
    })
    const flowFilterButton = document.querySelector(flowFilterSelector)

    if (!(flowFilterButton instanceof HTMLElement)) {
      throw new Error('Expected automation flow filter toggle')
    }

    fireEvent.click(flowFilterButton)

    await waitFor(() => {
      expect(automationApi.updateFilters).toHaveBeenCalledWith({
        filters: {
          bucket: 'ready',
          flowOwnerKeys: [],
          scopeIds: []
        }
      })
    })
    expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
  })

  it('updates automation-flow lifecycle from the workspace filter row', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      setFlowLifecycle: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '',
          path: '/workspace/.mde/automation-flows/flow-a.md',
          valid: true
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    const lifecycleButtonSelector = `[data-component-id="${COMPONENT_IDS.automation.flowLifecycleButton}"]`

    await waitFor(() => {
      expect(document.querySelector(lifecycleButtonSelector)).toBeInstanceOf(
        HTMLButtonElement
      )
    })
    const lifecycleButton = document.querySelector(lifecycleButtonSelector)

    if (!(lifecycleButton instanceof HTMLButtonElement)) {
      throw new Error('Expected automation flow lifecycle button')
    }

    expect(lifecycleButton).toHaveAccessibleName(
      'Disable automation-flow Workspace Flow'
    )
    fireEvent.click(lifecycleButton)

    await waitFor(() => {
      expect(automationApi.setFlowLifecycle).toHaveBeenCalledWith({
        filePath: '/workspace/.mde/automation-flows/flow-a.md',
        lifecycle: 'disabled',
        workspaceRoot: '/workspace'
      })
    })
    expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
  })

  it('renders automation run history and opens a native session from a run record', async () => {
    const runHistoryProjection: AutomationProjection = {
      ...projection,
      runs: [
        {
          adapterSessionId: 'session-a',
          automationFlowId: 'flow-a',
          availableActions: ['open-native-session'],
          engine: 'codex',
          runId: 'run-a',
          runKind: 'task',
          sourceItemId: 'source-a',
          startedAt: '2026-05-10T08:00:00.000Z',
          state: 'done',
          taskId: 'task-a',
          title: 'READY Implement UI',
          updatedAt: '2026-05-10T08:03:00.000Z'
        }
      ]
    }
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: runHistoryProjection })),
      openNativeSession: vi.fn(() =>
        Promise.resolve({
          accepted: true,
          runId: 'run-a'
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    const runHistory = await screen.findByRole('region', { name: 'Run history' })
    const workspaceFilterPanel = document.querySelector(
      `[data-component-id="${COMPONENT_IDS.automation.workspaceFilterPanel}"]`
    )

    if (!(workspaceFilterPanel instanceof HTMLElement)) {
      throw new Error('Expected workspace filter panel')
    }

    expect(runHistory).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.runHistoryPanel
    )
    expect(runHistory.parentElement).toHaveClass('automation-left-panel')
    expect(
      workspaceFilterPanel.compareDocumentPosition(runHistory) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(runHistory).getByText('READY Implement UI')).toBeInTheDocument()
    expect(
      within(runHistory)
        .getByText('run-a')
        .closest(
          `[data-component-id="${COMPONENT_IDS.automation.runHistoryRow}"]`
        )
    ).toHaveAttribute('data-component-id', COMPONENT_IDS.automation.runHistoryRow)
    expect(within(runHistory).getByText('Done')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Open native session for run run-a' })
    )

    await waitFor(() => {
      expect(automationApi.openNativeSession).toHaveBeenCalledWith({
        runId: 'run-a'
      })
    })
  })

  it('does not expose native session action when a run record cannot open it', async () => {
    const runHistoryProjection: AutomationProjection = {
      ...projection,
      runs: [
        {
          adapterSessionId: 'session-a',
          automationFlowId: 'flow-a',
          availableActions: [],
          engine: 'codex',
          runId: 'run-a',
          runKind: 'task',
          sourceItemId: 'source-a',
          startedAt: '2026-05-10T08:00:00.000Z',
          state: 'done',
          taskId: 'task-a',
          title: 'READY Implement UI',
          updatedAt: '2026-05-10T08:03:00.000Z'
        }
      ]
    }
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: runHistoryProjection })),
      openNativeSession: vi.fn()
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    const runHistory = await screen.findByRole('region', { name: 'Run history' })

    expect(within(runHistory).getByText('READY Implement UI')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Open native session for run run-a'
      })
    ).not.toBeInTheDocument()
    expect(automationApi.openNativeSession).not.toHaveBeenCalled()
  })

  it('opens run detail popup with automation-flow parse result and process', async () => {
    const runHistoryProjection: AutomationProjection = {
      ...projection,
      runs: [
        {
          adapterSessionId: 'session-a',
          automationFlowId: 'flow-a',
          availableActions: [],
          discoveryResult: {
            sourceCount: 1,
            sources: [
              {
                relativePath: '.mde/docs/tasks/ready.md',
                sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
                sourceType: 'workspace-markdown',
                title: 'READY Parsed task'
              }
            ]
          },
          engine: 'codex',
          processSteps: [
            {
              createdAt: '2026-05-10T08:00:00.000Z',
              type: 'started'
            },
            {
              createdAt: '2026-05-10T08:03:00.000Z',
              sourceCount: 1,
              type: 'discovered-task-sources'
            },
            {
              createdAt: '2026-05-10T08:03:00.000Z',
              state: 'done',
              type: 'state-updated'
            }
          ],
          runId: 'run-parse',
          runKind: 'discovery',
          startedAt: '2026-05-10T08:00:00.000Z',
          state: 'done',
          taskId: 'discovery:flow-a',
          title: 'Workspace Flow discovery',
          updatedAt: '2026-05-10T08:03:00.000Z'
        }
      ]
    }
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: runHistoryProjection })),
      openNativeSession: vi.fn()
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'View run details for run run-parse'
      })
    )

    const dialog = await screen.findByRole('dialog', { name: 'Run details' })

    expect(dialog).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.runHistoryDetailDialog
    )
    expect(within(dialog).getByText('Parse result')).toBeInTheDocument()
    expect(within(dialog).getByText('READY Parsed task')).toBeInTheDocument()
    expect(within(dialog).getByText('.mde/docs/tasks/ready.md')).toBeInTheDocument()
    expect(within(dialog).getByText('Parse process')).toBeInTheDocument()
    expect(within(dialog).getByText('Started')).toBeInTheDocument()
    expect(within(dialog).getByText('Parsed 1 task list item')).toBeInTheDocument()
    expect(within(dialog).queryByText('MDE Automation Runtime Contract'))
      .not.toBeInTheDocument()
    expect(automationApi.openNativeSession).not.toHaveBeenCalled()
  })

  it('requests recent workspace roots for cross-workspace flow sections', async () => {
    localStorage.setItem(
      'mde.recentWorkspaces',
      JSON.stringify([
        {
          name: 'mdv',
          rootPath: '/Users/example/mdv',
          type: 'workspace'
        }
      ])
    )
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection }))
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    await screen.findByRole('main', { name: 'Automation Center' })
    expect(automationApi.getProjection).toHaveBeenCalledWith({
      workspaceRoots: ['/Users/example/mdv']
    })
  })

  it('switches Task Stack buckets before the refreshed projection returns', async () => {
    let resolveRefresh:
      | ((value: { readonly projection: AutomationProjection }) => void)
      | undefined
    const refreshedProjection: AutomationProjection = {
      ...projection,
      filters: {
        ...projection.filters,
        bucket: 'done'
      },
      tasks: []
    }
    const automationApi = {
      getProjection: vi
        .fn()
        .mockResolvedValueOnce({ projection })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve
            })
        ),
      updateFilters: vi.fn(() => Promise.resolve({ accepted: true }))
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    const doneBucket = await screen.findByRole('button', { name: /Done/ })

    fireEvent.click(doneBucket)

    await waitFor(() => {
      expect(doneBucket).toHaveAttribute('aria-pressed', 'true')
    })
    expect(automationApi.updateFilters).toHaveBeenCalledWith({
      filters: {
        bucket: 'done',
        flowOwnerKeys: [],
        scopeIds: ['workspace:/workspace']
      }
    })

    resolveRefresh?.({ projection: refreshedProjection })
    await waitFor(() => {
      expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
    })
  })

  it('opens scope management instead of the old template editor', async () => {
    const focusWorkspaceWindow = vi.fn(() => Promise.resolve())
    const openPathInNewWindow = vi.fn(() => Promise.resolve())
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      openAutomationManagementTarget: vi.fn(() =>
        Promise.resolve({ rootPath: '/workspace' })
      )
    } as unknown as AutomationApi

    Object.defineProperty(window, 'mdeWindow', {
      configurable: true,
      value: { focusWorkspaceWindow }
    })
    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: { openPathInNewWindow }
    })

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Manage flows for workspace'
      })
    )

    await waitFor(() => {
      expect(automationApi.openAutomationManagementTarget).toHaveBeenCalledWith({
        target: 'workspace',
        workspaceRoot: '/workspace'
      })
    })
    expect(openPathInNewWindow).toHaveBeenCalledWith({
      type: 'workspace-automation-flows',
      workspaceRoot: '/workspace'
    })
    expect(focusWorkspaceWindow).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Template')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Signal Stack' })).toBeInTheDocument()
  })

  it('opens workspace automation management from setup diagnostics CTA', async () => {
    const openPathInNewWindow = vi.fn(() => Promise.resolve())
    const diagnosticProjection: AutomationProjection = {
      ...projection,
      diagnostics: [
        {
          automationFlowId: 'flow-a',
          code: 'automationFlow.missingExecutor',
          diagnosticId: 'diagnostic-1',
          message: 'automationFlow.missingExecutor',
          severity: 'error',
          sourceFile: '/workspace/.mde/automation-flows/flow-a.md'
        }
      ]
    }
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: diagnosticProjection })),
      openAutomationManagementTarget: vi.fn(() =>
        Promise.resolve({ rootPath: '/workspace' })
      )
    } as unknown as AutomationApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: { openPathInNewWindow }
    })

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open Automation Flows' })
    )

    await waitFor(() => {
      expect(automationApi.openAutomationManagementTarget).toHaveBeenCalledWith({
        target: 'workspace',
        workspaceRoot: '/workspace'
      })
    })
    expect(openPathInNewWindow).toHaveBeenCalledWith({
      type: 'workspace-automation-flows',
      workspaceRoot: '/workspace'
    })
  })

  it('surfaces decision submit failures through localized UI text only', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: needsMeProjection })),
      submitDecision: vi.fn(() =>
        Promise.resolve({
          accepted: false,
          decisionId: 'decision-a',
          diagnostic: {
            code: 'automationRun.resumeFailed',
            diagnosticId: 'automation:automationRun.resumeFailed',
            message: 'Error: /Users/private/secret token=abc123',
            messageKey: 'automation.diagnostics.automationRun.resumeFailed',
            severity: 'error',
            technicalMessage: 'Error: /Users/private/secret token=abc123'
          },
          runId: 'run-needs-me'
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve and resume' }))

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Automation run could not be resumed. Check the task status and try again.'
    )
    expect(alert).not.toHaveTextContent('/Users/private/secret')
    expect(alert).not.toHaveTextContent('token=abc123')
    await waitFor(() => {
      expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
    })
  })

  it('surfaces rejected startRun results through localized UI text only', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      startRun: vi.fn(() =>
        Promise.resolve({
          accepted: false,
          diagnostic: {
            code: 'automationAdapter.runCapabilityUnavailable',
            diagnosticId: 'automation:automationAdapter.runCapabilityUnavailable',
            message: 'Error: /Users/private/secret token=abc123',
            messageKey:
              'automation.diagnostics.automationAdapter.runCapabilityUnavailable',
            severity: 'error',
            technicalMessage: 'Error: /Users/private/secret token=abc123'
          }
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Start with selected executor' })
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Automation cannot start because the required adapter is unavailable.'
    )
    expect(alert).not.toHaveTextContent('/Users/private/secret')
    expect(alert).not.toHaveTextContent('token=abc123')
    await waitFor(() => {
      expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
    })
  })

  it('surfaces thrown startRun failures through the safe fallback text', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      startRun: vi.fn(() =>
        Promise.reject(new Error('spawn failed /Users/private token=abc123'))
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Start with selected executor' })
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Automation task could not be started. Check the task status and try again.'
    )
    expect(alert).not.toHaveTextContent('/Users/private')
    expect(alert).not.toHaveTextContent('token=abc123')
    await waitFor(() => {
      expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
    })
  })

  it('does not render Automation Agent Chat entry in Automation Center', async () => {
    const filteredProjection: AutomationProjection = {
      ...projection,
      filters: {
        bucket: 'ready',
        flowOwnerKeys: ['global:flow:user-flow'],
        scopeIds: ['global']
      }
    }
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: filteredProjection }))
    } as unknown as AutomationApi
    const agentChatApi = {
      getAvailability: vi.fn(() =>
        Promise.resolve({
          available: true,
          selectedEngineId: 'codex'
        })
      )
    }

    render(
      <AutomationCenterWindow
        agentChatApi={agentChatApi as never}
        automationApi={automationApi}
      />
    )

    await screen.findByRole('main', { name: 'Automation Center' })

    expect(
      screen.queryByRole('button', { name: 'Open Automation Agent Chat' })
    ).not.toBeInTheDocument()
    expect(agentChatApi.getAvailability).not.toHaveBeenCalled()
  })
})
