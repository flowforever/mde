import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  MouseEvent
} from 'react'

import type { TreeNode } from '../../../shared/fileTree'
import type { ExplorerInlineEditor, ExplorerTreeProps } from './explorerTypes'

interface ExplorerTreeNodeProps extends ExplorerTreeProps {
  readonly depth: number
  readonly node: TreeNode
}

interface ExplorerTreeRootProps extends ExplorerTreeProps {
  readonly nodes: readonly TreeNode[]
}

const getRowAccessibleName = (node: TreeNode): string =>
  node.type === 'directory'
    ? `${node.name} folder`
    : `${node.name} Markdown file`

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? entryPath : entryPath.slice(separatorIndex + 1)
}

const getInlineEditorLabel = (editor: ExplorerInlineEditor): string => {
  if (editor.type === 'create-file') {
    return 'New Markdown file name'
  }

  if (editor.type === 'create-folder') {
    return 'New folder name'
  }

  return `Rename ${
    editor.targetEntryPath ? getEntryName(editor.targetEntryPath) : editor.value
  }`
}

interface ExplorerInlineEditorRowProps {
  readonly depth: number
  readonly editor: ExplorerInlineEditor
  readonly onCancel?: () => void
  readonly onChange?: (value: string) => void
  readonly onSubmit?: () => void
}

const ExplorerInlineEditorRow = ({
  depth,
  editor,
  onCancel,
  onChange,
  onSubmit
}: ExplorerInlineEditorRowProps): React.JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rowStyle = { '--depth': depth } as CSSProperties
  const label = getInlineEditorLabel(editor)
  const submitInlineEditor = (event: FormEvent): void => {
    event.preventDefault()
    onSubmit?.()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    onCancel?.()
  }

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editor.targetDirectoryPath, editor.targetEntryPath, editor.type])

  return (
    <form
      className="explorer-tree-row explorer-inline-entry-form"
      onSubmit={submitInlineEditor}
      style={rowStyle}
    >
      <span className="explorer-file-spacer" aria-hidden="true" />
      <input
        aria-label={label}
        onChange={(event) => {
          onChange?.(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        value={editor.value}
      />
    </form>
  )
}

const ExplorerTreeNode = ({
  depth,
  inlineEditor,
  node,
  onInlineEditorCancel,
  onInlineEditorChange,
  onInlineEditorSubmit,
  onOpenEntryMenu,
  onSelectEntry,
  onSelectFile,
  selectedEntryPath,
  selectedFilePath
}: ExplorerTreeNodeProps): React.JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isRenamingEntry =
    inlineEditor?.type === 'rename' && inlineEditor.targetEntryPath === node.path
  const isSelected =
    selectedEntryPath === node.path ||
    (node.type === 'file' && selectedFilePath === node.path)
  const rowStyle = { '--depth': depth } as CSSProperties
  const toggleExpanded = (): void => {
    setIsExpanded((currentValue) => !currentValue)
  }
  const openContextMenu = (event: MouseEvent): void => {
    if (!onOpenEntryMenu) {
      return
    }

    event.preventDefault()
    onOpenEntryMenu({
      clientX: event.clientX,
      clientY: event.clientY,
      entry: node
    })
  }

  if (node.type === 'directory') {
    const isCreatingInsideDirectory =
      inlineEditor?.type !== 'rename' &&
      inlineEditor?.targetDirectoryPath === node.path
    const isShowingChildren = isExpanded || isCreatingInsideDirectory

    return (
      <li>
        {isRenamingEntry && inlineEditor ? (
          <ExplorerInlineEditorRow
            depth={depth}
            editor={inlineEditor}
            onCancel={onInlineEditorCancel}
            onChange={onInlineEditorChange}
            onSubmit={onInlineEditorSubmit}
          />
        ) : (
          <div className="explorer-tree-row" style={rowStyle}>
            <button
              aria-expanded={isShowingChildren}
              aria-label={`${isShowingChildren ? 'Collapse' : 'Expand'} ${node.name}`}
              className="explorer-disclosure-button"
              onClick={toggleExpanded}
              type="button"
            >
              {isShowingChildren ? 'v' : '>'}
            </button>
            <button
              aria-expanded={isShowingChildren}
              aria-current={isSelected ? 'page' : undefined}
              aria-label={getRowAccessibleName(node)}
              className={
                isSelected ? 'explorer-row-button is-active' : 'explorer-row-button'
              }
              onContextMenu={openContextMenu}
              onClick={() => {
                onSelectEntry(selectedEntryPath === node.path ? null : node.path)
                toggleExpanded()
              }}
              type="button"
            >
              {node.name}
            </button>
          </div>
        )}
        {isShowingChildren ? (
          <ul className="explorer-tree" role="group">
            {isCreatingInsideDirectory && inlineEditor ? (
              <li>
                <ExplorerInlineEditorRow
                  depth={depth + 1}
                  editor={inlineEditor}
                  onCancel={onInlineEditorCancel}
                  onChange={onInlineEditorChange}
                  onSubmit={onInlineEditorSubmit}
                />
              </li>
            ) : null}
            {node.children.map((childNode) => (
              <ExplorerTreeNode
                depth={depth + 1}
                inlineEditor={inlineEditor}
                key={childNode.path}
                node={childNode}
                onInlineEditorCancel={onInlineEditorCancel}
                onInlineEditorChange={onInlineEditorChange}
                onInlineEditorSubmit={onInlineEditorSubmit}
                onOpenEntryMenu={onOpenEntryMenu}
                onSelectEntry={onSelectEntry}
                onSelectFile={onSelectFile}
                selectedEntryPath={selectedEntryPath}
                selectedFilePath={selectedFilePath}
              />
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <li>
      {isRenamingEntry && inlineEditor ? (
        <ExplorerInlineEditorRow
          depth={depth}
          editor={inlineEditor}
          onCancel={onInlineEditorCancel}
          onChange={onInlineEditorChange}
          onSubmit={onInlineEditorSubmit}
        />
      ) : (
        <div className="explorer-tree-row" style={rowStyle}>
          <span className="explorer-file-spacer" aria-hidden="true" />
          <button
            aria-current={isSelected ? 'page' : undefined}
            aria-label={getRowAccessibleName(node)}
            className={
              isSelected ? 'explorer-row-button is-active' : 'explorer-row-button'
            }
            onContextMenu={openContextMenu}
            onClick={() => {
              onSelectEntry(node.path)
              onSelectFile(node.path)
            }}
            type="button"
          >
            {node.name}
          </button>
        </div>
      )}
    </li>
  )
}

export const ExplorerTree = ({
  inlineEditor,
  nodes,
  onInlineEditorCancel,
  onInlineEditorChange,
  onInlineEditorSubmit,
  onOpenEntryMenu,
  onSelectEntry,
  onSelectFile,
  selectedEntryPath,
  selectedFilePath
}: ExplorerTreeRootProps): React.JSX.Element => (
  <ul className="explorer-tree explorer-tree-root">
    {inlineEditor &&
    inlineEditor.type !== 'rename' &&
    inlineEditor.targetDirectoryPath === null ? (
      <li>
        <ExplorerInlineEditorRow
          depth={0}
          editor={inlineEditor}
          onCancel={onInlineEditorCancel}
          onChange={onInlineEditorChange}
          onSubmit={onInlineEditorSubmit}
        />
      </li>
    ) : null}
    {nodes.map((node) => (
      <ExplorerTreeNode
        depth={0}
        inlineEditor={inlineEditor}
        key={node.path}
        node={node}
        onInlineEditorCancel={onInlineEditorCancel}
        onInlineEditorChange={onInlineEditorChange}
        onInlineEditorSubmit={onInlineEditorSubmit}
        onOpenEntryMenu={onOpenEntryMenu}
        onSelectEntry={onSelectEntry}
        onSelectFile={onSelectFile}
        selectedEntryPath={selectedEntryPath}
        selectedFilePath={selectedFilePath}
      />
    ))}
  </ul>
)
