export interface EditorComponentIds {
  readonly editor: {
    readonly documentPathLabel: string
    readonly exitHistoryPreviewButton: string
    readonly frontmatterModeButton: string
    readonly frontmatterPanel: string
    readonly frontmatterRawYamlField: string
    readonly frontmatterSummary: string
    readonly historyPreviewBanner: string
    readonly markdownEditingSurface: string
    readonly markdownEditorShell: string
    readonly restoreThisVersionButton: string
    readonly saveStateIndicator: string
    readonly titlebar: string
  }
  readonly flowchart: {
    readonly closeFlowchartPreviewButton: string
    readonly dialogToolbar: string
    readonly errorState: string
    readonly previewButton: string
    readonly previewCard: string
    readonly previewDialog: string
    readonly previewLayoutToggle: string
    readonly resetViewButton: string
    readonly viewport: string
    readonly zoomInButton: string
    readonly zoomOutButton: string
  }
  readonly link: {
    readonly createAndInsertButton: string
    readonly directoryRow: string
    readonly directoryTree: string
    readonly existingLinkTab: string
    readonly newDocumentNameField: string
    readonly newDocumentTab: string
    readonly pickerCloseButton: string
    readonly pickerDialog: string
    readonly suggestionRow: string
    readonly suggestionsList: string
    readonly targetField: string
  }
}

export const EDITOR_COMPONENT_IDS: EditorComponentIds = Object.freeze({
  editor: Object.freeze({
    documentPathLabel: 'editor.document-path-label',
    exitHistoryPreviewButton: 'editor.exit-history-preview-button',
    frontmatterModeButton: 'editor.frontmatter-mode-button',
    frontmatterPanel: 'editor.frontmatter-panel',
    frontmatterRawYamlField: 'editor.frontmatter-raw-yaml-field',
    frontmatterSummary: 'editor.frontmatter-summary',
    historyPreviewBanner: 'editor.history-preview-banner',
    markdownEditingSurface: 'editor.markdown-editing-surface',
    markdownEditorShell: 'editor.markdown-editor-shell',
    restoreThisVersionButton: 'editor.restore-this-version-button',
    saveStateIndicator: 'editor.save-state-indicator',
    titlebar: 'editor.titlebar'
  }),
  flowchart: Object.freeze({
    closeFlowchartPreviewButton: 'flowchart.close-flowchart-preview-button',
    dialogToolbar: 'flowchart.dialog-toolbar',
    errorState: 'flowchart.error-state',
    previewButton: 'flowchart.preview-button',
    previewCard: 'flowchart.preview-card',
    previewDialog: 'flowchart.preview-dialog',
    previewLayoutToggle: 'flowchart.preview-layout-toggle',
    resetViewButton: 'flowchart.reset-view-button',
    viewport: 'flowchart.viewport',
    zoomInButton: 'flowchart.zoom-in-button',
    zoomOutButton: 'flowchart.zoom-out-button'
  }),
  link: Object.freeze({
    createAndInsertButton: 'link.create-and-insert-button',
    directoryRow: 'link.directory-row',
    directoryTree: 'link.directory-tree',
    existingLinkTab: 'link.existing-link-tab',
    newDocumentNameField: 'link.new-document-name-field',
    newDocumentTab: 'link.new-document-tab',
    pickerCloseButton: 'link.picker-close-button',
    pickerDialog: 'link.picker-dialog',
    suggestionRow: 'link.suggestion-row',
    suggestionsList: 'link.suggestions-list',
    targetField: 'link.target-field'
  })
})
