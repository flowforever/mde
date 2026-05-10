import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AutomationFlowEditorHost } from '../../src/renderer/src/automation/AutomationFlowEditorHost'
import { createAutomationFlowEditorHostAdapter } from '../../src/renderer/src/automation/automationFlowEditorHostAdapter'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText
} from '../../src/renderer/src/i18n/appLanguage'
import type {
  AutomationCreateFlowFromTemplateRequest,
  AutomationFlowDefinitionDocument,
  AutomationFlowTemplateSummary
} from '../../src/shared/automation'

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

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en)

const flowDocument: AutomationFlowDefinitionDocument = {
  diagnostics: [],
  markdown: '# Existing automation-flow',
  path: '/workspace/.mde/automation-flows/flow-a.md',
  valid: true
}

const templates: readonly AutomationFlowTemplateSummary[] = [
  {
    allowedScopes: ['workspace'],
    name: 'Local dev task',
    requiredInputs: [],
    templateId: 'local-dev-task'
  }
]

describe('AutomationFlowEditorHost', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders setup controls before creating a new automation-flow document', () => {
    const onCreateFromTemplate = vi.fn()
    const onSetupChange = vi.fn()
    const setup: AutomationCreateFlowFromTemplateRequest = {
      defaultEngine: 'codex',
      flowId: 'automation-flow-1',
      scope: 'workspace',
      templateId: 'local-dev-task'
    }

    render(
      <AutomationFlowEditorHost
        mode="create"
        onClose={vi.fn()}
        onCreateFromTemplate={onCreateFromTemplate}
        onSaveDocument={vi.fn()}
        onSetupChange={onSetupChange}
        setup={setup}
        templates={templates}
        text={text}
      />
    )

    expect(screen.getByRole('region', { name: 'Automation-flow editor' }))
      .toHaveAttribute('data-component-id', COMPONENT_IDS.automation.editorHost)
    expect(screen.getByLabelText('Template')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.templatePicker
    )
    expect(screen.queryByTestId('markdown-block-editor')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Flow id'), {
      target: { value: 'custom-flow' }
    })
    expect(onSetupChange).toHaveBeenCalledWith({
      ...setup,
      flowId: 'custom-flow'
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create automation-flow' }))
    expect(onCreateFromTemplate).toHaveBeenCalledWith(setup)
  })

  it('reuses MarkdownBlockEditor for editing and saves the latest draft', async () => {
    const onSaveDocument = vi.fn(() => Promise.resolve(flowDocument))

    render(
      <AutomationFlowEditorHost
        document={flowDocument}
        mode="edit"
        onClose={vi.fn()}
        onSaveDocument={onSaveDocument}
        text={text}
      />
    )

    expect(screen.getByText('/workspace/.mde/automation-flows/flow-a.md'))
      .toBeInTheDocument()
    expect(
      screen.getByText('/workspace/.mde/automation-flows/flow-a.md')
        .closest('[data-component-id="editor.markdown-editor-shell"]')
    ).not.toBeNull()
    expect(
      screen.getByRole('region', { name: 'Validation diagnostics' })
    ).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.validationPanel
    )
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Change automation markdown' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save automation-flow' }))

    await waitFor(() => {
      expect(onSaveDocument).toHaveBeenCalledWith('# Updated automation-flow')
    })
  })

  it('adapts user-global automation-flow editing without file-tree or asset actions', async () => {
    const adapter = createAutomationFlowEditorHostAdapter({
      documentPath: '/Users/test/.mde/automation-flows/user-flow.md',
      text
    })

    expect(adapter.workspaceRoot).toBe('mde://automation-flows/user-global')
    expect(adapter.workspaceTree).toEqual([])
    expect(adapter.markdownFilePaths).toEqual([
      '/Users/test/.mde/automation-flows/user-flow.md'
    ])
    expect(adapter.createLinkedMarkdown).toBeUndefined()
    expect(adapter.openLink).toBeUndefined()
    await expect(adapter.uploadImage(new File(['image'], 'image.png'))).rejects
      .toThrow('Automation-flow editor does not attach image assets.')
  })
})
