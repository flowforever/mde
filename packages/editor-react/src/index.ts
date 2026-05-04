export interface EditorReactPackageInfo {
  readonly packageName: '@mde/editor-react'
  readonly phase: 'runtime'
}

export { EDITOR_COMPONENT_IDS } from './componentIds'
export type { EditorComponentIds } from './componentIds'

export type { EditorText, EditorTextKey, EditorTextParams } from './text'

export { FrontmatterPanel } from './FrontmatterPanel'
export type { FrontmatterPanelProps } from './FrontmatterPanel'

export { MermaidFlowchartPanel } from './MermaidFlowchartPanel'
export type { MermaidFlowchartPanelProps } from './MermaidFlowchartPanel'

export { MarkdownBlockEditor } from './MarkdownBlockEditor'
export type {
  CreateVisibleLinkWorkspaceTree,
  MarkdownBlockEditorHandle,
  MarkdownBlockEditorProps
} from './MarkdownBlockEditor'

export {
  createSearchRanges,
  isEditorSearchMutationRelevant
} from './searchRanges'

export {
  chooseMarkdownContentsToSave,
  shouldClearLocalChangesAfterUnchangedSave,
  shouldRetryUnchangedSave
} from './saveLifecycle'
export type { MarkdownSaveCandidate } from './saveLifecycle'

export {
  replaceEditorDocumentWithoutUndoHistory,
  shouldImportMarkdownIntoEditor
} from './hydration'
export type { EditorHydrationAdapter } from './hydration'

export {
  createEditorCodeHighlighter,
  DARK_EDITOR_CODE_THEME,
  getEditorCodeThemeForThemeFamily,
  LIGHT_EDITOR_CODE_THEME
} from './codeHighlighter'
export type { EditorCodeTheme } from './codeHighlighter'

export {
  normalizeCodeBlockLanguageId,
  normalizeImportedCodeBlockLanguages,
  SUPPORTED_CODE_LANGUAGES
} from './codeBlockLanguages'
export type { SupportedCodeLanguage } from './codeBlockLanguages'

export {
  areSameInlineFlowchartTargets,
  getNextMissingInlineFlowchartTargets
} from './flowchartInlineTargets'
export type {
  InlineFlowchartTarget,
  InlineFlowchartTargets
} from './flowchartInlineTargets'

export {
  EDITOR_LINE_SPACING_OPTIONS,
  EDITOR_LINE_SPACING_STORAGE_KEY,
  EDITOR_VIEW_MODE_STORAGE_KEY,
  readEditorLineSpacing,
  readEditorViewMode,
  writeEditorLineSpacing,
  writeEditorViewMode
} from './layoutPreferences'
export type { EditorLineSpacing, EditorViewMode } from './layoutPreferences'

export {
  collectExpandedLinkDirectoryOptions,
  createInitialLinkDirectoryState
} from './linkDirectories'
export type {
  InitialLinkDirectoryState,
  LinkDirectoryOption
} from './linkDirectories'

export {
  createInitialLinkDialogState,
  ensureMarkdownExtension,
  getEditorLinkEntryName,
  joinWorkspacePath,
  moveLinkDialogSuggestionSelection,
  selectLinkDialogDirectory,
  setLinkDialogError,
  setLinkDialogMode,
  updateLinkDialogHref,
  updateLinkDialogNewDocumentName
} from './linkDialogState'
export type { LinkDialogState } from './linkDialogState'

export {
  exportBlocksToMarkdown,
  importMarkdownToBlocks,
  MARKDOWN_BLANK_LINE_MARKER,
  PASSTHROUGH_MARKDOWN_ASSET_RESOLVER,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage
} from './markdownTransforms'
export type { MarkdownBlockEditorAdapter } from './markdownTransforms'

export const editorReactPackageInfo: EditorReactPackageInfo = Object.freeze({
  packageName: '@mde/editor-react',
  phase: 'runtime'
})
