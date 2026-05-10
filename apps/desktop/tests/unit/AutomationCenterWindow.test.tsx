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
  filters: {},
  flows: [
    {
      automationFlowId: 'flow-a',
      definitionPath: '/workspace/.mde/automation-flows/flow-a.md',
      lifecycle: 'enabled',
      name: 'Workspace Flow',
      scope: 'workspace',
      sourceTypes: ['workspace-markdown'],
      status: 'formal',
      taskCount: 1
    }
  ],
  generatedAt: '2026-05-10T08:00:00.000Z',
  reports: [],
  runs: [],
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
      await screen.findByRole('button', { name: 'Workspace Flow' })
    )

    await waitFor(() => {
      expect(automationApi.updateFilters).toHaveBeenCalledWith({
        filters: { flowId: 'flow-a' }
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
})
