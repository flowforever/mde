export const WORKSPACE_CHANNELS = Object.freeze({
  consumeLaunchPath: "workspace:consume-launch-path",
  inspectPath: "workspace:inspect-path",
  launchPath: "workspace:launch-path",
  listDirectory: "workspace:list-directory",
  openExternalLink: "workspace:open-external-link",
  openFile: "workspace:open-file",
  openFileByPath: "workspace:open-file-by-path",
  openFileInNewWindow: "workspace:open-file-in-new-window",
  openPath: "workspace:open-path",
  openPathInNewWindow: "workspace:open-path-in-new-window",
  openWorkspace: "workspace:open",
  openWorkspaceByPath: "workspace:open-by-path",
  openWorkspaceFileInNewWindow: "workspace:open-workspace-file-in-new-window",
  openWorkspaceInNewWindow: "workspace:open-in-new-window",
});

export const FILE_CHANNELS = Object.freeze({
  copyWorkspaceEntry: "file:copy-workspace-entry",
  createFolder: "file:create-folder",
  createMarkdownFile: "file:create-markdown",
  deleteEntry: "file:delete-entry",
  listDeletedDocumentHistory: "file:list-deleted-document-history",
  listDocumentHistory: "file:list-document-history",
  pasteClipboardEntries: "file:paste-clipboard-entries",
  pasteExternalEntries: "file:paste-external-entries",
  readClipboardText: "file:read-clipboard-text",
  readDocumentHistoryVersion: "file:read-document-history-version",
  markdownFileExists: "file:markdown-file-exists",
  readMarkdownFile: "file:read-markdown",
  renameEntry: "file:rename-entry",
  restoreDeletedDocumentHistoryVersion:
    "file:restore-deleted-document-history-version",
  restoreDocumentHistoryVersion: "file:restore-document-history-version",
  saveImageAsset: "file:save-image-asset",
  searchWorkspaceMarkdown: "file:search-workspace-markdown",
  writeClipboardText: "file:write-clipboard-text",
  writeMarkdownFile: "file:write-markdown",
});

export const AI_CHANNELS = Object.freeze({
  detectTools: "ai:detect-tools",
  generateAppLanguagePack: "ai:generate-app-language-pack",
  summarizeMarkdown: "ai:summarize-markdown",
  translateMarkdown: "ai:translate-markdown",
});

export const AUTOMATION_CHANNELS = Object.freeze({
  archiveFlow: "automation:archive-flow",
  cancelRun: "automation:cancel-run",
  createFlowFromTemplate: "automation:create-flow-from-template",
  getProjection: "automation:get-projection",
  listCapabilityReports: "automation:list-capability-reports",
  listReports: "automation:list-reports",
  listTemplates: "automation:list-templates",
  loadFlowDefinition: "automation:load-flow-definition",
  openNativeSession: "automation:open-native-session",
  resumeRun: "automation:resume-run",
  restoreFlow: "automation:restore-flow",
  saveFlowDefinition: "automation:save-flow-definition",
  setFlowLifecycle: "automation:set-flow-lifecycle",
  startRun: "automation:start-run",
  submitDecision: "automation:submit-decision",
  updateFilters: "automation:update-filters",
  validateTemplateInput: "automation:validate-template-input",
});

export const UPDATE_CHANNELS = Object.freeze({
  checkForUpdates: "update:check-for-updates",
  downloadAndOpen: "update:download-and-open",
  downloadProgress: "update:download-progress",
  installWindows: "update:install-windows",
  updateAvailable: "update:available",
  updateReady: "update:ready",
});
