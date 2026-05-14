import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
        bucket: 'ready',
        sourceItemId: 'source-a',
        taskId: 'task-a',
        title: 'READY Implement UI'
      }
    ],
    running: []
  },
  decisions: [],
  diagnostics: [],
  filters: {
    bucket: 'ready',
    flowIds: [],
    workspaceIds: ['/workspace', 'mde:no-workspace']
  },
  flows: [
    {
      automationFlowId: 'flow-a',
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
      bucket: 'ready',
      sourceItemId: 'source-a',
      taskId: 'task-a',
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

    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Workspace Flow' })
    )

    await waitFor(() => {
      expect(automationApi.updateFilters).toHaveBeenCalledWith({
        filters: {
          bucket: 'ready',
          flowIds: ['flow-a'],
          workspaceIds: ['/workspace', 'mde:no-workspace']
        }
      })
    })
    expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
  })

  it('opens New automation-flow setup in the right editor mode', async () => {
    const automationApi = {
      createFlowFromTemplate: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Generated automation-flow',
          path: '/workspace/.mde/automation-flows/new-flow.md',
          valid: true
        })
      ),
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      listTemplates: vi.fn(() =>
        Promise.resolve({
          templates: [
            {
              allowedScopes: ['workspace'],
              name: 'Local dev task',
              requiredInputs: [],
              templateId: 'local-dev-task'
            }
          ]
        })
      ),
      validateTemplateInput: vi.fn(() =>
        Promise.resolve({ diagnostics: [], ok: true })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'New automation-flow' })
    )

    expect(screen.getByRole('region', { name: 'Workspace flows' }))
      .toBeInTheDocument()
    expect(await screen.findByLabelText('Template')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.templatePicker
    )
    expect(screen.queryByRole('region', { name: 'Signal Stack' }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Flowline' }))
      .not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create automation-flow' }))

    await waitFor(() => {
      expect(automationApi.createFlowFromTemplate).toHaveBeenCalledWith({
        defaultEngine: 'codex',
        flowId: 'automation-flow-2',
        scope: 'workspace',
        templateId: 'local-dev-task'
      })
    })
    expect(
      await screen.findByText('/workspace/.mde/automation-flows/new-flow.md')
    ).toBeInTheDocument()
  })

  it('opens No workspace group add-flow setup with user scope', async () => {
    const automationApi = {
      createFlowFromTemplate: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Generated automation-flow',
          path: '/user/.mde/automation-flows/personal-flow.md',
          valid: true
        })
      ),
      getProjection: vi.fn(() =>
        Promise.resolve({
          projection: {
            ...projection,
            flows: [
              ...projection.flows,
              {
                automationFlowId: 'user-flow',
                lifecycle: 'enabled',
                name: 'Personal Flow',
                scope: 'user',
                sourceTypes: ['user-prompt'],
                status: 'formal',
                taskCount: 1
              }
            ]
          }
        })
      ),
      listTemplates: vi.fn(() =>
        Promise.resolve({
          templates: [
            {
              allowedScopes: ['workspace'],
              name: 'Local dev task',
              requiredInputs: [],
              templateId: 'local-dev-task'
            },
            {
              allowedScopes: ['user'],
              name: 'Personal prompt',
              requiredInputs: [],
              templateId: 'personal-prompt'
            }
          ]
        })
      ),
      validateTemplateInput: vi.fn(() =>
        Promise.resolve({ diagnostics: [], ok: true })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add flow for No workspace' })
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Create automation-flow' }))

    await waitFor(() => {
      expect(automationApi.createFlowFromTemplate).toHaveBeenCalledWith({
        defaultEngine: 'codex',
        flowId: 'automation-flow-3',
        scope: 'user',
        templateId: 'personal-prompt'
      })
    })
  })

  it('loads an existing automation-flow into editor mode and saves updates', async () => {
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      loadFlowDefinition: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Existing automation-flow',
          path: '/workspace/.mde/automation-flows/flow-a.md',
          valid: true
        })
      ),
      saveFlowDefinition: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Updated automation-flow',
          path: '/workspace/.mde/automation-flows/flow-a.md',
          valid: true
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Flow actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit automation-flow' }))
    expect(
      await screen.findByText('/workspace/.mde/automation-flows/flow-a.md')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change automation markdown' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save automation-flow' }))

    await waitFor(() => {
      expect(automationApi.saveFlowDefinition).toHaveBeenCalledWith({
        filePath: '/workspace/.mde/automation-flows/flow-a.md',
        markdown: '# Updated automation-flow'
      })
    })
  })

  it('runs flow lifecycle actions through automation IPC and refreshes projection', async () => {
    const automationApi = {
      archiveFlow: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Archived automation-flow',
          path: '/workspace/.mde/automation-flows/flow-a.md',
          valid: true
        })
      ),
      getProjection: vi.fn(() => Promise.resolve({ projection })),
      setFlowLifecycle: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Disabled automation-flow',
          path: '/workspace/.mde/automation-flows/flow-a.md',
          valid: true
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Flow actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable automation-flow' }))

    await waitFor(() => {
      expect(automationApi.setFlowLifecycle).toHaveBeenCalledWith({
        filePath: '/workspace/.mde/automation-flows/flow-a.md',
        lifecycle: 'disabled'
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Archive automation-flow' }))

    await waitFor(() => {
      expect(automationApi.archiveFlow).toHaveBeenCalledWith({
        filePath: '/workspace/.mde/automation-flows/flow-a.md'
      })
    })
    expect(automationApi.getProjection).toHaveBeenCalledTimes(3)
  })

  it('runs restore through automation IPC for archived flows', async () => {
    const archivedProjection: AutomationProjection = {
      ...projection,
      filters: {
        ...projection.filters,
        archivedVisible: true
      },
      flows: [
        {
          ...projection.flows[0],
          lifecycle: 'archived'
        }
      ]
    }
    const automationApi = {
      getProjection: vi.fn(() => Promise.resolve({ projection: archivedProjection })),
      restoreFlow: vi.fn(() =>
        Promise.resolve({
          diagnostics: [],
          markdown: '# Restored automation-flow',
          path: '/workspace/.mde/automation-flows/flow-a.md',
          valid: true
        })
      )
    } as unknown as AutomationApi

    render(<AutomationCenterWindow automationApi={automationApi} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Flow actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore automation-flow' }))

    await waitFor(() => {
      expect(automationApi.restoreFlow).toHaveBeenCalledWith({
        filePath: '/workspace/.mde/automation-flows/flow-a.md'
      })
    })
    expect(automationApi.getProjection).toHaveBeenCalledTimes(2)
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
      await screen.findByRole('button', { name: 'Start automation task' })
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
      await screen.findByRole('button', { name: 'Start automation task' })
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

  it('keeps Automation Agent Chat available when filters select only no-workspace', async () => {
    const filteredProjection: AutomationProjection = {
      ...projection,
      filters: {
        bucket: 'ready',
        flowIds: ['user-flow'],
        workspaceIds: ['mde:no-workspace']
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

    expect(
      await screen.findByRole('button', { name: 'Open Automation Agent Chat' })
    ).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.agentChatButton
    )
    expect(agentChatApi.getAvailability).toHaveBeenCalledWith({
      selectedEngineId: 'codex',
      workspaceRoot: '/workspace'
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Automation Agent Chat' })
    )
    expect(
      await screen.findByRole('button', { name: 'Close Automation Agent Chat' })
    ).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.agentChatCloseButton
    )
  })
})
