import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { TreeNode } from '../../../shared/fileTree'
import type { ExplorerTreeProps } from './explorerTypes'

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

const ExplorerTreeNode = ({
  depth,
  node,
  onSelectEntry,
  onSelectFile,
  selectedEntryPath,
  selectedFilePath
}: ExplorerTreeNodeProps): React.JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSelected =
    selectedEntryPath === node.path ||
    (node.type === 'file' && selectedFilePath === node.path)
  const rowStyle = { '--depth': depth } as CSSProperties
  const toggleExpanded = (): void => {
    setIsExpanded((currentValue) => !currentValue)
  }

  if (node.type === 'directory') {
    return (
      <li>
        <div className="explorer-tree-row" style={rowStyle}>
          <button
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
            className="explorer-disclosure-button"
            onClick={toggleExpanded}
            type="button"
          >
            {isExpanded ? 'v' : '>'}
          </button>
          <button
            aria-expanded={isExpanded}
            aria-current={isSelected ? 'page' : undefined}
            aria-label={getRowAccessibleName(node)}
            className={
              isSelected ? 'explorer-row-button is-active' : 'explorer-row-button'
            }
            onClick={() => {
              onSelectEntry(node.path)
              toggleExpanded()
            }}
            type="button"
          >
            {node.name}
          </button>
        </div>
        {isExpanded ? (
          <ul className="explorer-tree" role="group">
            {node.children.map((childNode) => (
              <ExplorerTreeNode
                depth={depth + 1}
                key={childNode.path}
                node={childNode}
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
      <div className="explorer-tree-row" style={rowStyle}>
        <span className="explorer-file-spacer" aria-hidden="true" />
        <button
          aria-current={isSelected ? 'page' : undefined}
          aria-label={getRowAccessibleName(node)}
          className={
            isSelected ? 'explorer-row-button is-active' : 'explorer-row-button'
          }
          onClick={() => {
            onSelectEntry(node.path)
            onSelectFile(node.path)
          }}
          type="button"
        >
          {node.name}
        </button>
      </div>
    </li>
  )
}

export const ExplorerTree = ({
  nodes,
  onSelectEntry,
  onSelectFile,
  selectedEntryPath,
  selectedFilePath
}: ExplorerTreeRootProps): React.JSX.Element => (
  <ul className="explorer-tree explorer-tree-root">
    {nodes.map((node) => (
      <ExplorerTreeNode
        depth={0}
        key={node.path}
        node={node}
        onSelectEntry={onSelectEntry}
        onSelectFile={onSelectFile}
        selectedEntryPath={selectedEntryPath}
        selectedFilePath={selectedFilePath}
      />
    ))}
  </ul>
)
