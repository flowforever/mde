import { X } from 'lucide-react'
import {
  useMemo,
  useState,
  type ChangeEvent,
  type JSX
} from 'react'
import { MarkdownBlockEditor } from '@mde/editor-react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type {
  AutomationCreateFlowFromTemplateRequest,
  AutomationDiagnostic,
  AutomationFlowDefinitionDocument,
  AutomationFlowTemplateSummary
} from '../../../shared/automation'
import { createAutomationFlowEditorHostAdapter } from './automationFlowEditorHostAdapter'

type AutomationFlowEditorMode = 'create' | 'edit'

interface AutomationFlowEditorHostProps {
  readonly document?: AutomationFlowDefinitionDocument
  readonly mode: AutomationFlowEditorMode
  readonly onClose: () => void
  readonly onCreateFromTemplate?: (
    request: AutomationCreateFlowFromTemplateRequest
  ) => void | Promise<void>
  readonly onSaveDocument: (
    markdown: string
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly onSetupChange?: (
    setup: AutomationCreateFlowFromTemplateRequest
  ) => void
  readonly setup?: AutomationCreateFlowFromTemplateRequest
  readonly setupDiagnostics?: readonly AutomationDiagnostic[]
  readonly templates?: readonly AutomationFlowTemplateSummary[]
  readonly text: AppText
  readonly workspaceRoot?: string
}

const emptyDiagnostics: readonly AutomationDiagnostic[] = Object.freeze([])

export const AutomationFlowEditorHost = ({
  document,
  mode,
  onClose,
  onCreateFromTemplate,
  onSaveDocument,
  onSetupChange,
  setup,
  setupDiagnostics = emptyDiagnostics,
  templates = [],
  text,
  workspaceRoot
}: AutomationFlowEditorHostProps): JSX.Element => {
  const [draftMarkdown, setDraftMarkdown] = useState(document?.markdown ?? '')
  const [savedMarkdown, setSavedMarkdown] = useState(document?.markdown ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [validationDiagnostics, setValidationDiagnostics] =
    useState<readonly AutomationDiagnostic[]>(document?.diagnostics ?? [])

  const adapter = useMemo(
    () =>
      document === undefined
        ? null
        : createAutomationFlowEditorHostAdapter({
            documentPath: document.path,
            text,
            workspaceRoot
          }),
    [document, text, workspaceRoot]
  )

  const updateSetup = (
    patch: Partial<AutomationCreateFlowFromTemplateRequest>
  ): void => {
    if (setup === undefined) {
      return
    }

    onSetupChange?.({
      ...setup,
      ...patch
    })
  }

  const saveMarkdown = async (markdown: string): Promise<void> => {
    if (document === undefined) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const savedDocument = await onSaveDocument(markdown)
      setDraftMarkdown(savedDocument.markdown)
      setSavedMarkdown(savedDocument.markdown)
      setValidationDiagnostics(savedDocument.diagnostics)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : text('automation.saveFlowFailed')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const diagnostics =
    mode === 'create' && document === undefined
      ? setupDiagnostics
      : validationDiagnostics

  return (
    <section
      aria-label={text('automation.flowEditor')}
      className="automation-flow-editor-host"
      data-component-id={COMPONENT_IDS.automation.editorHost}
    >
      <header className="automation-flow-editor-host__header">
        <h2>{text('automation.flowEditor')}</h2>
        <button
          aria-label={text('automation.closeEditor')}
          className="automation-icon-button"
          data-component-id={COMPONENT_IDS.automation.editorCloseButton}
          onClick={onClose}
          title={text('automation.closeEditor')}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>

      {mode === 'create' && setup !== undefined ? (
        <div className="automation-flow-editor-setup">
          <label>
            <span>{text('automation.templatePicker')}</span>
            <select
              aria-label={text('automation.templatePicker')}
              data-component-id={COMPONENT_IDS.automation.templatePicker}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                updateSetup({
                  templateId: event.target
                    .value as AutomationCreateFlowFromTemplateRequest['templateId']
                })
              }}
              value={setup.templateId}
            >
              {templates.map((template) => (
                <option key={template.templateId} value={template.templateId}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{text('automation.flowId')}</span>
            <input
              aria-label={text('automation.flowId')}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                updateSetup({ flowId: event.target.value })
              }}
              value={setup.flowId}
            />
          </label>
          <button
            onClick={() => {
              void onCreateFromTemplate?.(setup)
            }}
            type="button"
          >
            {text('automation.createFlow')}
          </button>
        </div>
      ) : null}

      <section
        aria-label={text('automation.validationDiagnostics')}
        className="automation-validation-panel"
        data-component-id={COMPONENT_IDS.automation.validationPanel}
      >
        {diagnostics.length === 0 ? (
          <p>{text('automation.validationPassed')}</p>
        ) : (
          <ul>
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic.diagnosticId}>{diagnostic.message}</li>
            ))}
          </ul>
        )}
      </section>

      {document !== undefined && adapter !== null ? (
        <>
          <MarkdownBlockEditor
            colorScheme="light"
            draftMarkdown={draftMarkdown}
            errorMessage={errorMessage}
            isDirty={draftMarkdown !== savedMarkdown}
            isSaving={isSaving}
            markdown={savedMarkdown}
            markdownFilePaths={adapter.markdownFilePaths}
            onImageUpload={adapter.uploadImage}
            onMarkdownChange={setDraftMarkdown}
            onSaveRequest={(contents) => saveMarkdown(contents)}
            path={document.path}
            text={text}
            workspaceRoot={adapter.workspaceRoot}
            workspaceTree={adapter.workspaceTree}
          />
          <button
            data-component-id={COMPONENT_IDS.automation.editorSaveButton}
            disabled={isSaving}
            onClick={() => {
              void saveMarkdown(draftMarkdown)
            }}
            type="button"
          >
            {text('automation.saveFlow')}
          </button>
        </>
      ) : null}
    </section>
  )
}
