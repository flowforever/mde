import { AlertTriangle, Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { useMemo, useState, type JSX } from 'react'

import type { MarkdownFrontmatterBlock } from './frontmatter'
import type { AppText } from '../i18n/appLanguage'

interface FrontmatterPanelProps {
  readonly frontmatter: MarkdownFrontmatterBlock
  readonly isReadOnly: boolean
  readonly onApply: (raw: string) => void
  readonly text: AppText
}

const getFieldCountLabel = (
  frontmatter: MarkdownFrontmatterBlock,
  text: AppText
): string =>
  frontmatter.fieldCount === 1
    ? text('editor.frontmatterOneField')
    : text('editor.frontmatterManyFields', {
        count: frontmatter.fieldCount
      })

export const FrontmatterPanel = ({
  frontmatter,
  isReadOnly,
  onApply,
  text
}: FrontmatterPanelProps): JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftRaw, setDraftRaw] = useState(frontmatter.raw)
  const fieldCountLabel = useMemo(
    () => getFieldCountLabel(frontmatter, text),
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
        aria-label={`${text('editor.frontmatter')} ${fieldCountLabel}`}
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
        <span>{text('editor.frontmatter')}</span>
        <span>{fieldCountLabel}</span>
        {!frontmatter.isValid ? (
          <span className="frontmatter-warning-label">
            <AlertTriangle aria-hidden="true" size={14} />
            {text('editor.frontmatterInvalid')}
          </span>
        ) : null}
        {frontmatter.summary ? (
          <span className="frontmatter-summary-text">{frontmatter.summary}</span>
        ) : null}
      </button>
      {isExpanded ? (
        <div className="frontmatter-details">
          {!frontmatter.isValid ? (
            <p className="frontmatter-warning-message" role="status">
              {text('editor.frontmatterParseFailed')}
            </p>
          ) : null}
          {isEditing ? (
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
                    setIsEditing(false)
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
                    setIsEditing(false)
                  }}
                  type="button"
                >
                  {text('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <pre className="frontmatter-raw">{frontmatter.raw}</pre>
              {!isReadOnly ? (
                <button
                  className="frontmatter-action-button"
                  onClick={() => {
                    setDraftRaw(frontmatter.raw)
                    setIsEditing(true)
                  }}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={14} />
                  {text('editor.frontmatterEdit')}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
