import { useEffect, useState } from 'react'
import type { Block } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { useCreateBlockNote } from '@blocknote/react'

import { importMarkdownToBlocks } from './markdownTransforms'

interface MarkdownBlockEditorProps {
  readonly markdown: string
  readonly path: string
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to parse Markdown'

export const MarkdownBlockEditor = ({
  markdown,
  path
}: MarkdownBlockEditorProps): React.JSX.Element => {
  const editor = useCreateBlockNote()
  const [parseErrorMessage, setParseErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    const loadMarkdown = async (): Promise<void> => {
      try {
        const blocks = await importMarkdownToBlocks(editor, markdown)

        if (!isCurrent) {
          return
        }

        editor.replaceBlocks(
          editor.document.map((block) => block.id),
          blocks as Block[]
        )
        setParseErrorMessage(null)
      } catch (error) {
        if (isCurrent) {
          setParseErrorMessage(getErrorMessage(error))
        }
      }
    }

    void loadMarkdown()

    return () => {
      isCurrent = false
    }
  }, [editor, markdown])

  return (
    <div className="markdown-editor-shell" data-testid="markdown-block-editor">
      <div className="markdown-editor-titlebar">
        <span className="markdown-editor-path">{path}</span>
      </div>
      {parseErrorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {parseErrorMessage}
        </p>
      ) : null}
      <BlockNoteView
        className="markdown-editor-surface"
        data-testid="blocknote-view"
        editable={false}
        editor={editor}
        theme="light"
      />
    </div>
  )
}
