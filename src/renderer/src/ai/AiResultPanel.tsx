import { LoaderCircle, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import type { AiGenerationResult } from '../../../shared/ai'
import { MarkdownBlockEditor } from '../editor/MarkdownBlockEditor'

interface AiResultPanelProps {
  readonly colorScheme: 'dark' | 'light'
  readonly isRegeneratingSummary: boolean
  readonly onClose: () => void
  readonly onRegenerateSummary: (instruction: string) => void
  readonly result: AiGenerationResult
  readonly workspaceRoot: string
}

export const AiResultPanel = ({
  colorScheme,
  isRegeneratingSummary,
  onClose,
  onRegenerateSummary,
  result,
  workspaceRoot
}: AiResultPanelProps): React.JSX.Element => {
  const [summaryInstruction, setSummaryInstruction] = useState('')
  const resultTitle =
    result.kind === 'summary'
      ? 'Summary'
      : `Translation${result.language ? `: ${result.language}` : ''}`
  const submitSummaryInstruction = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const instruction = summaryInstruction.trim()

    if (instruction.length === 0 || isRegeneratingSummary) {
      return
    }

    onRegenerateSummary(instruction)
    setSummaryInstruction('')
  }

  return (
    <section aria-label="AI result" className="ai-result-panel">
      <header className="ai-result-header">
        <div className="ai-result-heading">
          <span>{resultTitle}</span>
          <span>
            {result.cached ? 'Cached' : `Generated with ${result.tool.name}`} ·
            read-only
          </span>
        </div>
        <button
          aria-label="Close AI result"
          className="ai-result-close-button"
          onClick={onClose}
          title="Close AI result"
          type="button"
        >
          <X aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </header>
      <p className="ai-result-path">Saved to {result.path}</p>
      <div className="ai-result-editor-scroll">
        <MarkdownBlockEditor
          colorScheme={colorScheme}
          draftMarkdown={result.contents}
          errorMessage={null}
          isDirty={false}
          isReadOnly
          isSaving={false}
          key={`${result.kind}:${result.path}:${result.contents}`}
          markdown={result.contents}
          onImageUpload={() => Promise.reject(new Error('AI result is read-only'))}
          onMarkdownChange={() => undefined}
          onSaveRequest={() => undefined}
          path={result.path}
          workspaceRoot={workspaceRoot}
        />
      </div>
      {result.kind === 'summary' ? (
        <form
          aria-label="Refine summary"
          className="ai-summary-refine-bar"
          onSubmit={submitSummaryInstruction}
        >
          <input
            aria-label="Refine summary instruction"
            onChange={(event) => {
              setSummaryInstruction(event.target.value)
            }}
            placeholder="Ask MDE to regenerate the summary..."
            type="text"
            value={summaryInstruction}
          />
          <button disabled={isRegeneratingSummary} type="submit">
            {isRegeneratingSummary ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="editor-action-spinner"
                  size={15}
                  strokeWidth={2}
                />
                <span>Regenerating</span>
              </>
            ) : (
              'Regenerate summary'
            )}
          </button>
        </form>
      ) : null}
    </section>
  )
}
