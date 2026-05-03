import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState, type JSX } from 'react'

import type { MarkdownFrontmatterBlock } from './frontmatter'
import type { AppText } from '../i18n/appLanguage'

interface FrontmatterPanelProps {
  readonly frontmatter: MarkdownFrontmatterBlock
  readonly isReadOnly: boolean
  readonly onApply: (raw: string) => void
  readonly text: AppText
}

type FrontmatterViewMode = 'fields' | 'source'

const getSummaryLabel = (
  frontmatter: MarkdownFrontmatterBlock,
  text: AppText
): string =>
  frontmatter.summary.length > 0
    ? frontmatter.summary
    : text('editor.frontmatterEmpty')

export const FrontmatterPanel = ({
  frontmatter,
  isReadOnly,
  onApply,
  text
}: FrontmatterPanelProps): JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(!frontmatter.isValid)
  const [viewMode, setViewMode] = useState<FrontmatterViewMode>(
    frontmatter.isValid ? 'fields' : 'source'
  )
  const [draftRaw, setDraftRaw] = useState(frontmatter.raw)
  const summaryLabel = useMemo(
    () => getSummaryLabel(frontmatter, text),
    [frontmatter, text]
  )

  return (
    <section
      aria-label={text('editor.frontmatter')}
      className={`frontmatter-panel${
        frontmatter.isValid ? '' : ' frontmatter-panel-warning'
      }`}
    >
      <button
        aria-expanded={isExpanded}
        aria-label={summaryLabel}
        className="frontmatter-summary-button"
        onClick={() => {
          setIsExpanded((currentValue) => !currentValue)
        }}
        type="button"
      >
        {isExpanded ? (
          <ChevronDown aria-hidden="true" size={15} />
        ) : (
          <ChevronRight aria-hidden="true" size={15} />
        )}
        {!frontmatter.isValid ? (
          <span className="frontmatter-warning-label">
            <AlertTriangle aria-hidden="true" size={14} />
            {text('editor.frontmatterInvalid')}
          </span>
        ) : null}
        <span className="frontmatter-summary-text">{summaryLabel}</span>
      </button>
      {isExpanded ? (
        <div className="frontmatter-details">
          {!frontmatter.isValid ? (
            <p className="frontmatter-warning-message" role="status">
              {text('editor.frontmatterParseFailed')}
            </p>
          ) : null}
          <div className="frontmatter-mode-actions">
            <button
              className="frontmatter-mode-button"
              onClick={() => {
                setViewMode('source')
                setDraftRaw(frontmatter.raw)
              }}
              type="button"
            >
              {text('editor.frontmatterSource')}
            </button>
            <button
              className="frontmatter-mode-button"
              onClick={() => {
                setViewMode('fields')
              }}
              type="button"
            >
              {text('editor.frontmatterFields')}
            </button>
          </div>
          {viewMode === 'source' ? (
            isReadOnly ? (
              <pre
                aria-label={text('editor.frontmatterRawYaml')}
                className="frontmatter-raw"
              >
                {frontmatter.raw}
              </pre>
            ) : (
              <div className="frontmatter-editor">
                <textarea
                  aria-label={text('editor.frontmatterRawYaml')}
                  onChange={(event) => {
                    setDraftRaw(event.currentTarget.value)
                  }}
                  spellCheck={false}
                  value={draftRaw}
                />
                <div className="frontmatter-actions">
                  <button
                    className="frontmatter-action-button frontmatter-action-primary"
                    onClick={() => {
                      onApply(draftRaw)
                      setViewMode('fields')
                    }}
                    type="button"
                  >
                    <Check aria-hidden="true" size={14} />
                    {text('editor.frontmatterApply')}
                  </button>
                  <button
                    className="frontmatter-action-button"
                    onClick={() => {
                      setDraftRaw(frontmatter.raw)
                      setViewMode(frontmatter.isValid ? 'fields' : 'source')
                    }}
                    type="button"
                  >
                    {text('common.cancel')}
                  </button>
                </div>
              </div>
            )
          ) : (
            <ul
              aria-label={text('editor.frontmatterFields')}
              className="frontmatter-field-list"
            >
              {frontmatter.fields.length > 0 ? (
                frontmatter.fields.map((field, index) => (
                  <li
                    className="frontmatter-field-row"
                    key={`${field.key}:${index}`}
                  >
                    <span className="frontmatter-field-key">{field.key}</span>
                    <span className="frontmatter-field-value">
                      {field.value}
                    </span>
                  </li>
                ))
              ) : (
                <li className="frontmatter-field-row">
                  <span className="frontmatter-field-value">
                    {text('editor.frontmatterEmpty')}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
