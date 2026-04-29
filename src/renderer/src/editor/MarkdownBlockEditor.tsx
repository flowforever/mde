import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import type { Block } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { useCreateBlockNote } from '@blocknote/react'

import { exportBlocksToMarkdown, importMarkdownToBlocks } from './markdownTransforms'

interface MarkdownBlockEditorProps {
  readonly errorMessage: string | null
  readonly isDirty: boolean
  readonly isSaving: boolean
  readonly markdown: string
  readonly onMarkdownChange: (contents: string) => void
  readonly onSaveRequest: (contents: string) => void | Promise<void>
  readonly path: string
}

export interface MarkdownBlockEditorHandle {
  readonly getMarkdown: () => Promise<string>
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export const MarkdownBlockEditor = forwardRef<
  MarkdownBlockEditorHandle,
  MarkdownBlockEditorProps
>(function MarkdownBlockEditor(
  {
    errorMessage,
    isDirty,
    isSaving,
    markdown,
    onMarkdownChange,
    onSaveRequest,
    path
  },
  ref
): React.JSX.Element {
  const editor = useCreateBlockNote()
  const isHydratingRef = useRef(false)
  const [parseErrorMessage, setParseErrorMessage] = useState<string | null>(null)
  const [serializationErrorMessage, setSerializationErrorMessage] = useState<
    string | null
  >(null)

  const serializeMarkdown = useCallback(
    async (): Promise<string> => exportBlocksToMarkdown(editor, editor.document),
    [editor]
  )

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: serializeMarkdown
    }),
    [serializeMarkdown]
  )

  useEffect(() => {
    let isCurrent = true

    const loadMarkdown = async (): Promise<void> => {
      try {
        const blocks = await importMarkdownToBlocks(editor, markdown)

        if (!isCurrent) {
          return
        }

        isHydratingRef.current = true
        editor.replaceBlocks(
          editor.document.map((block) => block.id),
          blocks as Block[]
        )
        setParseErrorMessage(null)
        window.setTimeout(() => {
          if (isCurrent) {
            isHydratingRef.current = false
          }
        }, 0)
      } catch (error) {
        if (isCurrent) {
          isHydratingRef.current = false
          setParseErrorMessage(getErrorMessage(error, 'Unable to parse Markdown'))
        }
      }
    }

    void loadMarkdown()

    return () => {
      isCurrent = false
      isHydratingRef.current = false
    }
  }, [editor, markdown])

  const saveMarkdown = async (): Promise<void> => {
    try {
      const contents = await serializeMarkdown()

      setSerializationErrorMessage(null)
      await onSaveRequest(contents)
    } catch (error) {
      setSerializationErrorMessage(
        getErrorMessage(error, 'Unable to serialize Markdown')
      )
    }
  }

  return (
    <div className="markdown-editor-shell" data-testid="markdown-block-editor">
      <div className="markdown-editor-titlebar">
        <div className="markdown-editor-file-state">
          <span className="markdown-editor-path">{path}</span>
          {isDirty ? (
            <span
              aria-live="polite"
              className="markdown-editor-dirty-state"
              role="status"
            >
              Unsaved changes
            </span>
          ) : null}
        </div>
        <button
          aria-label={
            isDirty ? `Save ${path} with unsaved changes` : `Save ${path}`
          }
          className="markdown-editor-save-button"
          disabled={isSaving}
          onClick={() => {
            void saveMarkdown()
          }}
          type="button"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {parseErrorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {parseErrorMessage}
        </p>
      ) : null}
      {serializationErrorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {serializationErrorMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <BlockNoteView
        className="markdown-editor-surface"
        data-testid="blocknote-view"
        editable
        editor={editor}
        onChange={(changedEditor) => {
          if (isHydratingRef.current) {
            return
          }

          void exportBlocksToMarkdown(changedEditor, changedEditor.document)
            .then((contents) => {
              setSerializationErrorMessage(null)
              onMarkdownChange(contents)
            })
            .catch((error: unknown) => {
              setSerializationErrorMessage(
                getErrorMessage(error, 'Unable to serialize Markdown')
              )
            })
        }}
        theme="light"
      />
    </div>
  )
})
