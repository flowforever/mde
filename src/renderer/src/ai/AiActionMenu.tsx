import { FileText, Languages, LoaderCircle, Plus, X } from 'lucide-react'
import type { FormEvent } from 'react'

import { DEFAULT_AI_TRANSLATION_LANGUAGES } from './aiLanguages'

export type AiActionBusyState =
  | 'idle'
  | 'refining-summary'
  | 'summarizing'
  | 'translating'

interface AiActionMenuProps {
  readonly busyState: AiActionBusyState
  readonly customLanguageInput: string
  readonly customLanguages: readonly string[]
  readonly isTranslateMenuOpen: boolean
  readonly onAddCustomLanguage: () => void
  readonly onCustomLanguageInputChange: (value: string) => void
  readonly onForgetCustomLanguage: (language: string) => void
  readonly onSummarize: () => void
  readonly onToggleTranslateMenu: () => void
  readonly onTranslate: (language: string) => void
}

export const AiActionMenu = ({
  busyState,
  customLanguageInput,
  customLanguages,
  isTranslateMenuOpen,
  onAddCustomLanguage,
  onCustomLanguageInputChange,
  onForgetCustomLanguage,
  onSummarize,
  onToggleTranslateMenu,
  onTranslate
}: AiActionMenuProps): React.JSX.Element => {
  const submitCustomLanguage = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const language = customLanguageInput.trim()

    onAddCustomLanguage()
    if (language.length > 0) {
      onTranslate(language)
    }
  }
  const isBusy = busyState !== 'idle'
  const isSummarizing = busyState === 'summarizing'
  const isTranslating = busyState === 'translating'
  const renderActionIcon = (
    isSpinning: boolean,
    icon: React.JSX.Element
  ): React.JSX.Element =>
    isSpinning ? (
      <LoaderCircle
        aria-hidden="true"
        className="editor-action-spinner"
        data-testid="ai-action-spinner"
        size={17}
        strokeWidth={2}
      />
    ) : (
      icon
    )

  return (
    <>
      <button
        aria-label="Summarize Markdown"
        aria-busy={isSummarizing}
        className="editor-action-button"
        disabled={isBusy}
        onClick={onSummarize}
        title="Summarize Markdown"
        type="button"
      >
        {renderActionIcon(
          isSummarizing,
          <FileText aria-hidden="true" size={17} strokeWidth={2} />
        )}
      </button>
      <div className="editor-translate-menu-shell">
        <button
          aria-expanded={isTranslateMenuOpen}
          aria-haspopup="menu"
          aria-label="Translate Markdown"
          aria-busy={isTranslating}
          className="editor-action-button"
          disabled={isBusy}
          onClick={onToggleTranslateMenu}
          title="Translate Markdown"
          type="button"
        >
          {renderActionIcon(
            isTranslating,
            <Languages aria-hidden="true" size={17} strokeWidth={2} />
          )}
        </button>
        {isTranslateMenuOpen ? (
          <div
            aria-label="Translation languages"
            className="editor-translate-menu"
            role="menu"
          >
            <div className="editor-translate-menu-list">
              {DEFAULT_AI_TRANSLATION_LANGUAGES.map((language) => (
                <button
                  className="editor-translate-menu-item"
                  key={language}
                  onClick={() => {
                    onTranslate(language)
                  }}
                  role="menuitem"
                  type="button"
                >
                  {language}
                </button>
              ))}
              {customLanguages.map((language) => (
                <div className="editor-translate-custom-item" key={language}>
                  <button
                    className="editor-translate-menu-item"
                    onClick={() => {
                      onTranslate(language)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    {language}
                  </button>
                  <button
                    aria-label={`Remove custom language ${language}`}
                    className="editor-translate-remove-button"
                    onClick={() => {
                      onForgetCustomLanguage(language)
                    }}
                    title="Remove custom language"
                    type="button"
                  >
                    <X aria-hidden="true" size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
            <form
              aria-label="Add custom translation language"
              className="editor-translate-custom-form"
              onSubmit={submitCustomLanguage}
            >
              <input
                aria-label="Custom translation language"
                onChange={(event) => {
                  onCustomLanguageInputChange(event.target.value)
                }}
                placeholder="Other language"
                type="text"
                value={customLanguageInput}
              />
              <button
                aria-label="Add translation language"
                className="editor-translate-add-button"
                type="submit"
              >
                <Plus aria-hidden="true" size={15} strokeWidth={2} />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </>
  )
}
