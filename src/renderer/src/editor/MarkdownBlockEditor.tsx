import {
  type FocusEvent as ReactFocusEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import type { Block } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { useCreateBlockNote } from '@blocknote/react'

import { replaceMermaidBlocksFromSource } from './flowchartMarkdown'
import { MermaidFlowchartPanel } from './MermaidFlowchartPanel'
import {
  exportBlocksToMarkdown,
  importMarkdownToBlocks,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage
} from './markdownTransforms'

interface MarkdownBlockEditorProps {
  readonly colorScheme: 'dark' | 'light'
  readonly draftMarkdown: string
  readonly errorMessage: string | null
  readonly isDirty: boolean
  readonly isReadOnly?: boolean
  readonly isSaving: boolean
  readonly markdown: string
  readonly onImageUpload: (file: File) => Promise<string>
  readonly onMarkdownChange: (contents: string) => void
  readonly onSaveRequest: (contents: string) => void | Promise<void>
  readonly path: string
  readonly workspaceRoot: string
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
    colorScheme,
    errorMessage,
    draftMarkdown,
    isDirty,
    isReadOnly = false,
    isSaving,
    markdown,
    onImageUpload,
    onMarkdownChange,
    onSaveRequest,
    path,
    workspaceRoot
  },
  ref
): React.JSX.Element {
  const editor = useCreateBlockNote(
    {
      uploadFile: onImageUpload
    },
    [onImageUpload]
  )
  const isHydratingRef = useRef(false)
  const hasLocalChangesRef = useRef(false)
  const [parseErrorMessage, setParseErrorMessage] = useState<string | null>(null)
  const [serializationErrorMessage, setSerializationErrorMessage] = useState<
    string | null
  >(null)
  const assetContext = useMemo(
    () => ({
      markdownFilePath: path,
      workspaceRoot
    }),
    [path, workspaceRoot]
  )
  const editorMarkdown = useMemo(
    () => prepareMarkdownForEditor(markdown, assetContext),
    [assetContext, markdown]
  )

  const serializeMarkdown = useCallback(
    async (): Promise<string> => {
      const exportedMarkdown = await exportBlocksToMarkdown(editor, editor.document)
      const portableMarkdown = prepareMarkdownForStorage(
        exportedMarkdown,
        assetContext
      )

      return replaceMermaidBlocksFromSource(portableMarkdown, draftMarkdown)
    },
    [assetContext, draftMarkdown, editor]
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
        const blocks = await importMarkdownToBlocks(editor, editorMarkdown)

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
  }, [editor, editorMarkdown])

  useEffect(() => {
    hasLocalChangesRef.current = false
  }, [markdown, path, workspaceRoot])

  const saveMarkdown = useCallback(async (): Promise<void> => {
    if (isReadOnly || isSaving || !hasLocalChangesRef.current) {
      return
    }

    try {
      const contents = await serializeMarkdown()

      if (contents === markdown) {
        hasLocalChangesRef.current = false
        return
      }

      setSerializationErrorMessage(null)
      await onSaveRequest(contents)
      hasLocalChangesRef.current = false
    } catch (error) {
      setSerializationErrorMessage(
        getErrorMessage(error, 'Unable to serialize Markdown')
      )
    }
  }, [isReadOnly, isSaving, markdown, onSaveRequest, serializeMarkdown])

  const saveMarkdownOnBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>): void => {
      const nextFocusedElement = event.relatedTarget

      if (
        nextFocusedElement instanceof Node &&
        event.currentTarget.contains(nextFocusedElement)
      ) {
        return
      }

      void saveMarkdown()
    },
    [saveMarkdown]
  )

  return (
    <div
      className="markdown-editor-shell"
      data-testid="markdown-block-editor"
      onBlur={saveMarkdownOnBlur}
    >
      <div className="markdown-editor-titlebar">
        <div className="markdown-editor-file-state">
          <span className="markdown-editor-path">{path}</span>
          {isSaving ? (
            <span
              aria-live="polite"
              className="markdown-editor-save-state"
              role="status"
            >
              Saving...
            </span>
          ) : isDirty ? (
            <span
              aria-live="polite"
              className="markdown-editor-dirty-state"
              role="status"
            >
              Unsaved changes
            </span>
          ) : null}
        </div>
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
      {!isReadOnly ? (
        <MermaidFlowchartPanel
          colorScheme={colorScheme}
          markdown={draftMarkdown}
          onMarkdownChange={onMarkdownChange}
        />
      ) : null}
      <BlockNoteView
        className="markdown-editor-surface"
        data-testid="blocknote-view"
        editable={!isReadOnly}
        editor={editor}
        onChange={(changedEditor) => {
          if (isReadOnly || isHydratingRef.current) {
            return
          }

          hasLocalChangesRef.current = true
          void exportBlocksToMarkdown(changedEditor, changedEditor.document)
            .then((contents) => {
              const portableContents = prepareMarkdownForStorage(
                contents,
                assetContext
              )

              setSerializationErrorMessage(null)
              onMarkdownChange(
                replaceMermaidBlocksFromSource(portableContents, draftMarkdown)
              )
            })
            .catch((error: unknown) => {
              setSerializationErrorMessage(
                getErrorMessage(error, 'Unable to serialize Markdown')
              )
            })
        }}
        theme={colorScheme}
      />
    </div>
  )
})
