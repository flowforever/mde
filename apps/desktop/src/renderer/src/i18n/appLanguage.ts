export const APP_LANGUAGE_STORAGE_KEY = "mde.appLanguagePreference";
export const APP_CUSTOM_LANGUAGE_PACKS_STORAGE_KEY =
  "mde.customAppLanguagePacks";

export interface AppLanguagePackEntry {
  readonly key: AppTextKey;
  readonly text: string;
}

export interface AppLanguagePack {
  readonly id: string;
  readonly label: string;
  readonly locale: string;
  readonly messages: AppLanguageMessages;
}

export type AppLanguageMessages = Record<string, string>;

const EN_MESSAGES = {
  "ai.addTranslationLanguage": "Add translation language",
  "ai.aiResult": "AI result",
  "ai.cachedReadOnly": "Cached · read-only",
  "ai.closeResult": "Close AI result",
  "ai.customTranslationLanguage": "Custom translation language",
  "ai.generatedReadOnly": "Generated with {toolName} · read-only",
  "ai.otherLanguage": "Other language",
  "ai.refineSummary": "Refine summary",
  "ai.refineSummaryInstruction": "Refine summary instruction",
  "ai.regenerateSummary": "Regenerate summary",
  "ai.regenerateSummaryPlaceholder": "Ask MDE to regenerate the summary...",
  "ai.regenerating": "Regenerating",
  "ai.removeCustomLanguage": "Remove custom language",
  "ai.removeCustomLanguageNamed": "Remove custom language {language}",
  "ai.savedTo": "Saved to {path}",
  "ai.summary": "Summary",
  "ai.summarizeMarkdown": "Summarize Markdown",
  "ai.translation": "Translation",
  "ai.translationWithLanguage": "Translation: {language}",
  "ai.translationLanguages": "Translation languages",
  "ai.translateMarkdown": "Translate Markdown",
  "ai.addCustomTranslationLanguage": "Add custom translation language",
  "agentChat.attachImage": "Attach image",
  "agentChat.changeTypeAdded": "Added",
  "agentChat.changeTypeDeleted": "Deleted",
  "agentChat.changeTypeModified": "Modified",
  "agentChat.changedFiles": "Changed files",
  "agentChat.close": "Close Agent Chat",
  "agentChat.composerPlaceholder": "Ask about this Markdown...",
  "agentChat.contextPreview": "Context",
  "agentChat.diagnostic": "Agent Chat diagnostic",
  "agentChat.maxPermission": "Max permission",
  "agentChat.messageField": "Message Agent Chat",
  "agentChat.newSession": "New session",
  "agentChat.noMessages": "No messages yet",
  "agentChat.removeAttachment": "Remove attachment {fileName}",
  "agentChat.send": "Send",
  "agentChat.session": "Session",
  "agentChat.stop": "Stop",
  "agentChat.thinking": "Thinking...",
  "agentChat.title": "Agent Chat",
  "automation.archiveFlow": "Archive automation-flow",
  "automation.archivedFilter": "Archived",
  "automation.activeFlows": "Active flows",
  "automation.addFlowForWorkspace": "Add flow for {workspace}",
  "automation.automationFlowsLabel": "automation-flows",
  "automation.bucketEmpty": "No tasks in this bucket.",
  "automation.bugReportsSource": "Bug reports",
  "automation.centerTitle": "Automation Center",
  "automation.chooseTemplateForWorkspace":
    "Choose a template to start automation for this workspace.",
  "automation.closeEditor": "Close automation-flow editor",
  "automation.createFlow": "Create automation-flow",
  "automation.decisionAction": "Approve and resume",
  "automation.decisionPrompt": "Decision required",
  "automation.disableFlow": "Disable automation-flow",
  "automation.done": "Done",
  "automation.doneDescription": "Reports and verification history.",
  "automation.editFlow": "Edit automation-flow",
  "automation.enableFlow": "Enable automation-flow",
  "automation.editorAssetsUnavailable":
    "Automation-flow editor does not attach image assets.",
  "automation.emptyTasks": "No automation tasks yet.",
  "automation.flowActions": "Flow actions",
  "automation.flowEditor": "Automation-flow editor",
  "automation.flowId": "Flow id",
  "automation.flowToolbar": "Automation-flow toolbar",
  "automation.flowsCount": "flows",
  "automation.flowline": "Flowline",
  "automation.flowlineEmpty": "Select a task to inspect its Flowline.",
  "automation.loadingProjection": "Loading automation tasks...",
  "automation.needsMe": "Needs me",
  "automation.needsMeDescription":
    "Only active runs paused for human input.",
  "automation.newAutomationFlow": "New automation-flow",
  "automation.noSelectedSource": "No automation-flow source selected.",
  "automation.noActiveFlows": "No active flows",
  "automation.noWorkspace": "No workspace",
  "automation.personalAutomationFlows": "personal automation-flows",
  "automation.personalPromptsSource": "Personal prompts",
  "automation.projectionError": "Unable to load automation tasks.",
  "automation.ready": "Ready",
  "automation.readyDescription": "Automation-flow-owned candidates.",
  "automation.requirementsSource": "Requirements",
  "automation.resizeSidebar": "Resize Automation Center sidebar",
  "automation.restoreFlow": "Restore automation-flow",
  "automation.returnToWorkspace": "Return to workspace",
  "automation.running": "Running",
  "automation.runningDescription": "Tasks currently executing.",
  "automation.saveFlow": "Save automation-flow",
  "automation.saveFlowFailed": "Unable to save automation-flow.",
  "automation.showArchivedFlows": "Show archived flows",
  "automation.signalStack": "Signal Stack",
  "automation.selectedSources": "Selected workspace automation-flow sources",
  "automation.setupDiagnostics": "Setup diagnostics",
  "automation.statusArchived": "Flow is archived",
  "automation.statusDisabled": "Flow is disabled",
  "automation.statusEnabled": "Flow is enabled",
  "automation.statusSetup": "Flow needs setup",
  "automation.stopFlow": "Stop automation-flow",
  "automation.startTask": "Start automation task",
  "automation.taskStack": "Task stack",
  "automation.tasksCountLabel": "tasks",
  "automation.templatePicker": "Template",
  "automation.validationDiagnostics": "Validation diagnostics",
  "automation.validationPassed": "Validation passed.",
  "automation.workspaceFilterPanel": "Workspaces · flow filters",
  "automation.workspaceFlows": "Workspace flows",
  "automation.workspaceUnknown": "Current workspace",
  "automation.taskFirstQueue": "Task-first queue",
  "automation.taskFirstQueueDescription":
    "Workspace is a filter. Every task card is emitted by an automation-flow.",
  "automation.taskDocsSource": "Task docs",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.delete": "Delete",
  "common.done": "Done",
  "common.hide": "Hide",
  "common.later": "Later",
  "common.loadingFile": "Loading file...",
  "common.rename": "Rename",
  "common.search": "Search",
  "common.show": "Show",
  "dropTarget.ariaLabel": "Drop files or folders to open",
  "dropTarget.description": "Markdown files open here when they belong to this workspace. External resources open in a new window.",
  "dropTarget.title": "Drop to open",
  "editor.actions": "Editor actions",
  "editor.closeMarkdownSearch": "Close current Markdown search",
  "editor.collapseActions": "Collapse editor actions",
  "editor.emptyTitle": "Select a folder to begin",
  "editor.expandActions": "Show all editor actions",
  "editor.frontmatter": "Frontmatter",
  "editor.frontmatterApply": "Apply frontmatter",
  "editor.frontmatterEmpty": "No frontmatter fields",
  "editor.frontmatterEdit": "Edit frontmatter",
  "editor.frontmatterFields": "Fields",
  "editor.frontmatterInvalid": "invalid YAML",
  "editor.frontmatterManyFields": "{count} fields",
  "editor.frontmatterOneField": "1 field",
  "editor.frontmatterParseFailed":
    "Frontmatter parse failed; raw YAML will be preserved.",
  "editor.frontmatterRawYaml": "Raw frontmatter YAML",
  "editor.frontmatterSource": "Source",
  "editor.imageAssetRepairMany":
    "Restored {count} missing image assets.",
  "editor.imageAssetRepairOne": "Restored 1 missing image asset.",
  "editor.label": "Editor",
  "editor.linkCreateAndInsert": "Create and insert",
  "editor.linkDialogClose": "Close link picker",
  "editor.linkDialogKicker": "Markdown link",
  "editor.linkDialogTitle": "Insert link",
  "editor.linkDirectoryTree": "Directory tree",
  "editor.linkExistingDocument": "Existing link",
  "editor.linkNewDocument": "New document",
  "editor.linkNewDocumentDefaultName": "Untitled.md",
  "editor.linkNewDocumentName": "New document name",
  "editor.linkNewDocumentNameRequired": "Enter a document name",
  "editor.linkNoSuggestions": "No matching Markdown files",
  "editor.linkRootDirectory": "Workspace root",
  "editor.linkSlashDescription": "Insert a Markdown or web link",
  "editor.linkSlashTitle": "Link",
  "editor.linkSuggestions": "Link suggestions",
  "editor.linkTarget": "Link target",
  "editor.linkTargetPlaceholder": "Search docs or paste https://...",
  "editor.lineSpacing": "Editor line spacing",
  "editor.lineSpacingCompact": "Compact",
  "editor.lineSpacingMenu": "Line spacing",
  "editor.lineSpacingRelaxed": "Relaxed",
  "editor.lineSpacingStandard": "Standard",
  "editor.markdownSearch": "Search current Markdown",
  "editor.markdownSearchWithShortcut": "Search current Markdown ({shortcut})",
  "editor.deletePinnedSearchKeyword": "Delete pinned editor search keyword {query}",
  "editor.pinSearchHistoryItem": "Pin editor search history item {query}",
  "editor.resizeExplorerSidebar": "Resize explorer sidebar",
  "editor.saving": "Saving...",
  "editor.searchHistory": "Editor search history",
  "editor.searchPlaceholder": "Search",
  "editor.unpinSearchHistoryItem": "Unpin editor search history item {query}",
  "editor.unsavedChanges": "Unsaved changes",
  "editor.usePinnedSearchKeyword": "Use pinned editor search keyword {query}",
  "editor.useSearchHistoryItem": "Use editor search history item {query}",
  "editor.useCenteredView": "Use centered editor view",
  "editor.useFullWidthView": "Use full-width editor view",
  "errors.aiCliUnavailable":
    "Install Codex or Claude Code CLI to use AI actions",
  "errors.aiToolsUnavailable":
    "No supported AI CLI detected. Install Codex or Claude Code to enable AI actions.",
  "errors.editorApiUnavailable":
    "Editor API unavailable. Restart the app and try again.",
  "errors.languagePackGenerationFailed": "Unable to generate language pack",
  "errors.markdownParseFailed": "Unable to parse Markdown",
  "errors.markdownSerializeFailed": "Unable to serialize Markdown",
  "errors.openDroppedPathFailed": "Unable to open dropped path",
  "errors.openDroppedUnsupportedPath":
    "Drop a Markdown file or folder to open it in MDE.",
  "errors.openFileFailed": "Unable to open file",
  "errors.openHistoryFailed": "Unable to open document history",
  "errors.openLaunchPathFailed": "Unable to open launch path",
  "errors.openEditorLinkFailed": "Unable to open link",
  "errors.openMarkdownBeforeAi": "Open a Markdown file before using AI actions",
  "errors.openMarkdownBeforeImagePaste":
    "Open a Markdown file before pasting images",
  "errors.openWorkspaceBeforeFiles": "Open a workspace before reading files",
  "errors.openWorkspaceBeforeSearch": "Open a workspace before searching",
  "errors.openWorkspaceInNewWindowFailed":
    "Unable to open workspace in new window",
  "errors.openWorkspaceFailed": "Unable to open workspace",
  "errors.readOnlyAiResult": "AI result is read-only",
  "errors.restoreHistoryFailed": "Unable to restore document history",
  "errors.createFolderFailed": "Unable to create folder",
  "errors.createMarkdownFileFailed": "Unable to create Markdown file",
  "errors.copyEntryFailed": "Unable to copy entry",
  "errors.copyPathFailed": "Unable to copy path",
  "errors.deleteEntryFailed": "Unable to delete entry",
  "errors.installUpdateFailed": "Unable to install update",
  "errors.pasteEntryFailed": "Unable to paste entry",
  "errors.readFileFailed": "Unable to read file",
  "errors.refreshWorkspaceFailed": "Unable to refresh workspace",
  "errors.renameEntryFailed": "Unable to rename entry",
  "errors.saveFileFailed": "Unable to save file",
  "errors.searchWorkspaceFailed": "Unable to search workspace",
  "errors.summarizeMarkdownFailed": "Unable to summarize Markdown",
  "errors.switchWorkspaceFailed": "Unable to switch workspace",
  "errors.translateMarkdownFailed": "Unable to translate Markdown",
  "errors.workspaceSearchUnavailable":
    "Workspace search is unavailable. Restart the app and try again.",
  "explorer.collapseSidebar": "Collapse explorer sidebar",
  "explorer.confirmDelete": "Confirm delete",
  "explorer.collapseDirectory": "Collapse {name}",
  "explorer.copyAbsolutePath": "Copy absolute path",
  "explorer.copyEntry": "Copy",
  "explorer.copyRelativePath": "Copy relative path",
  "explorer.deleteEntryPrompt": "Delete {path}?",
  "explorer.directoryAccessibleName": "{name} folder",
  "explorer.empty": "Open a folder to browse Markdown files.",
  "explorer.expandDirectory": "Expand {name}",
  "explorer.expandSidebar": "Expand explorer sidebar",
  "explorer.files": "Files",
  "explorer.header": "Explorer",
  "explorer.hideHiddenEntries": "Hide hidden entries",
  "explorer.newFolder": "New folder",
  "explorer.newFolderDefaultName": "notes",
  "explorer.newFolderName": "New folder name",
  "explorer.newMarkdownFile": "New Markdown file",
  "explorer.newMarkdownFileDefaultName": "Untitled.md",
  "explorer.newMarkdownFileName": "New Markdown file name",
  "explorer.markdownFileAccessibleName": "{name} Markdown file",
  "explorer.noRecentFiles": "No recent files",
  "explorer.openRecentFile": "Open recent file {path}",
  "explorer.openAutomationCenter": "Open Automation Center",
  "explorer.pasteEntry": "Paste",
  "explorer.recentFileList": "Recent file list",
  "explorer.recentFiles": "Recent Files",
  "explorer.refresh": "Refresh explorer",
  "explorer.resizeRecentFilesPanel": "Resize recent files panel",
  "explorer.renameEntryName": "Rename {name}",
  "explorer.searchWorkspaceContents": "Search workspace contents",
  "explorer.showHiddenEntries": "Show hidden entries",
  "explorer.toolbar": "Workspace actions",
  "flowchart.label": "Flowcharts",
  "flowchart.closePreview": "Close flowchart preview",
  "flowchart.openPreview": "Open flowchart preview {index}",
  "flowchart.previewDialog": "Flowchart preview",
  "flowchart.renderFailed": "Unable to render flowchart",
  "flowchart.resetView": "Reset view",
  "flowchart.resetZoom": "Reset zoom",
  "flowchart.source": "Mermaid source {index}",
  "flowchart.useCenteredPreview": "Use centered preview",
  "flowchart.useFullPagePreview": "Use full-page preview",
  "flowchart.zoomIn": "Zoom in",
  "flowchart.zoomOut": "Zoom out",
  "globalSearch.close": "Close workspace search",
  "globalSearch.contentMode": "Content search mode",
  "globalSearch.contentModeWithShortcut": "Content search mode ({shortcut})",
  "globalSearch.description": "Search Markdown files in the current workspace.",
  "globalSearch.history": "Workspace search history",
  "globalSearch.historyLimit": "Up to {count}",
  "globalSearch.lineColumn": "Line {lineNumber}, column {columnNumber}",
  "globalSearch.matchingHistory": "Matching recent searches",
  "globalSearch.metadataMatch": "metadata",
  "globalSearch.modeGroup": "Workspace search mode",
  "globalSearch.noResults": "No results",
  "globalSearch.openPathResult": "Open path result {path}",
  "globalSearch.openResult": "Open search result {path} line {lineNumber}",
  "globalSearch.pathDescription": "Search Markdown file paths in the current workspace.",
  "globalSearch.pathInput": "Search workspace paths",
  "globalSearch.pathMode": "Path search mode",
  "globalSearch.pathModeWithShortcut": "Path search mode ({shortcut})",
  "globalSearch.pathPlaceholder": "Search paths",
  "globalSearch.pathResultType": "Markdown path",
  "globalSearch.placeholder": "Search workspace",
  "globalSearch.searching": "Searching...",
  "globalSearch.searchWithShortcut": "Search workspace contents ({shortcut})",
  "globalSearch.useHistoryItem": "Use workspace search history item {query}",
  "globalSearch.title": "Search workspace",
  "history.deletedDocuments": "Deleted Documents",
  "history.emptyAutosaveConfirm":
    "Autosave detected this operation would clear this document. Continue saving it as an empty document?",
  "history.event.aiWrite": "AI write before",
  "history.event.autosave": "Autosave before",
  "history.event.delete": "Delete before",
  "history.event.externalDelete": "External delete",
  "history.event.manualSave": "Manual save before",
  "history.event.rename": "Rename before",
  "history.event.restore": "Restore before",
  "history.exitPreview": "Exit preview",
  "history.filter.ai": "AI",
  "history.filter.all": "All",
  "history.filter.delete": "Delete",
  "history.filter.saves": "Saves",
  "history.noDeletedDocuments": "No deleted documents to recover",
  "history.noVersions": "No versions yet",
  "history.openDeletedDocument": "Preview deleted document {path}",
  "history.panelTitle": "Document history",
  "history.previewVersion": "Preview {event} from {time}",
  "history.readOnlyPreview": "Read-only version preview",
  "history.recoverDeletedDocuments": "Recover deleted documents",
  "history.restoreThisVersion": "Restore this version",
  "history.versionHistory": "Version history",
  "settings.aiCli": "AI CLI",
  "settings.aiDescription":
    "Choose the local AI CLI used for summary and translation actions.",
  "settings.aiTitle": "AI",
  "settings.changeTheme": "Change theme",
  "settings.close": "Close settings",
  "settings.controls": "Settings controls",
  "settings.customLanguageAction": "Generate language pack",
  "settings.customLanguageDescription":
    "Use a detected AI CLI to translate MDE interface text into another language.",
  "settings.customLanguageName": "Custom app language",
  "settings.customLanguageOptionLabel": "{language} (Custom)",
  "settings.customLanguagePlaceholder": "Spanish, Japanese, German...",
  "settings.defaultModelName": "Default model name",
  "settings.followSystemAppearance": "Follow system appearance",
  "settings.followSystemDescription": "Use the current OS light or dark mode.",
  "settings.generatingLanguagePack": "Generating language pack...",
  "settings.language": "Language",
  "settings.languageDescription":
    "Choose the language used by menus and prompts.",
  "settings.languagePackReady": "{language} language pack is ready.",
  "settings.languageSection": "App language",
  "settings.modelHint":
    "Only installed CLIs are shown. Leave model blank to use the CLI default.",
  "settings.nav": "Settings sections",
  "settings.noAiToolsForLanguage":
    "Install Codex or Claude Code to generate custom language packs.",
  "settings.open": "Open settings",
  "settings.preferenceDescription":
    "Choose app language and generate custom language packs.",
  "settings.preferenceTitle": "Preference",
  "settings.panelLabel": "{panel} settings",
  "settings.updateCustomLanguageAction": "Update selected language pack",
  "settings.updateCustomLanguageDescription":
    "Refresh the selected custom language pack with AI using the latest app text.",
  "settings.updatingLanguagePack": "Updating language pack...",
  "workspace.resourceTypeFile": "file",
  "workspace.resourceTypeWorkspace": "workspace",
  "settings.subtitle": "Configure editor behavior, AI tools, and app updates.",
  "settings.systemThemeDescription":
    "Choose the {family} theme used by system appearance.",
  "settings.themeColorways": "Theme colorways",
  "settings.themeDescription": "Choose editor appearance.",
  "settings.themeFooterLabel": "Theme",
  "settings.themeTitle": "Theme",
  "settings.title": "Settings",
  "settings.updateDescription":
    "Review the installed MDE version and check GitHub releases.",
  "settings.updateTitle": "Check Update",
  "settings.updatesUnavailable":
    "Update checks are unavailable in this runtime.",
  "settings.currentVersion": "Current version",
  "settings.checkForUpdates": "Check for updates",
  "settings.checkingForUpdates": "Checking...",
  "settings.checkUpdatesFailed": "Unable to check for updates",
  "settings.upToDate": "MDE is up to date.",
  "settings.updateAvailable": "MDE {version} is available.",
  "theme.columnDark": "Dark",
  "theme.columnDarkPanel": "Dark panel",
  "theme.columnLightPanel": "Light panel",
  "theme.description.apricot": "Soft apricot paper for warm writing.",
  "theme.description.atelier": "Warm studio paper and charcoal rail.",
  "theme.description.basalt": "Graphite dark with mineral teal.",
  "theme.description.binder": "Cool research-note light mode.",
  "theme.description.blueHour": "Cool technical night mode.",
  "theme.description.canopy": "Green paper paired with a deep canopy rail.",
  "theme.description.carbon": "Neutral dark for focused work.",
  "theme.description.cedar": "Warm low-light writing.",
  "theme.description.ember": "Low-glow dark with warm markers.",
  "theme.description.glacier": "Clear blue light mode with a pale rail.",
  "theme.description.ink": "Deep ink with brass highlights.",
  "theme.description.ivory": "Ivory paper with restrained brass markers.",
  "theme.description.lagoon": "Pale lagoon editor with a deep teal rail.",
  "theme.description.ledger": "Ledger paper with an ink-dark brass rail.",
  "theme.description.lilac": "Quiet violet notes with a pale side rail.",
  "theme.description.manuscript": "Warm paper editor with a soft rail.",
  "theme.description.mint": "Fresh pale workspace with mint ink.",
  "theme.description.moss": "Soft green-gray dark mode.",
  "theme.description.paperBlue": "Soft blue paper for technical notes.",
  "theme.description.plum": "Muted violet for late research.",
  "theme.description.porcelain": "Crisp technical light mode.",
  "theme.description.quarry": "Gray stone workspace with a charcoal rail.",
  "theme.description.sagePaper": "Soft green paper for reading.",
  "theme.description.terracotta": "Warm clay editor with a charcoal rail.",
  "theme.familyDark": "dark",
  "theme.familyLight": "light",
  "theme.groupBlue": "Blue",
  "theme.groupBrass": "Brass",
  "theme.groupEmber": "Ember",
  "theme.groupGreen": "Green",
  "theme.groupNeutral": "Neutral",
  "theme.groupTeal": "Teal",
  "theme.groupViolet": "Violet",
  "theme.groupWarm": "Warm",
  "theme.label.apricot": "Apricot",
  "theme.label.atelier": "Atelier",
  "theme.label.basalt": "Basalt",
  "theme.label.binder": "Binder",
  "theme.label.blueHour": "Blue Hour",
  "theme.label.canopy": "Canopy",
  "theme.label.carbon": "Carbon",
  "theme.label.cedar": "Cedar",
  "theme.label.ember": "Ember",
  "theme.label.glacier": "Glacier",
  "theme.label.ink": "Ink",
  "theme.label.ivory": "Ivory",
  "theme.label.lagoon": "Lagoon",
  "theme.label.ledger": "Ledger",
  "theme.label.lilac": "Lilac",
  "theme.label.manuscript": "Manuscript",
  "theme.label.mint": "Mint",
  "theme.label.moss": "Moss",
  "theme.label.paperBlue": "Paper Blue",
  "theme.label.plum": "Plum",
  "theme.label.porcelain": "Porcelain",
  "theme.label.quarry": "Quarry",
  "theme.label.sagePaper": "Sage Paper",
  "theme.label.terracotta": "Terracotta",
  "theme.systemThemeLabel": "System {theme}",
  "updates.available": "Update available",
  "updates.bytesDownloaded": "{bytes} bytes downloaded",
  "updates.downloadAndInstall": "Download and Install",
  "updates.downloadingMac": "MDE is downloading the macOS installer.",
  "updates.downloadingWindows":
    "MDE is downloading the Windows update in the background.",
  "updates.failed": "MDE could not finish the update.",
  "updates.installMac":
    "Download the macOS installer, then use the opened install window to replace MDE.",
  "updates.installWindows":
    "MDE will download the Windows update in the background.",
  "updates.installerOpened":
    "The installer has opened. Quit MDE, drag MDE to Applications, replace the old app, then reopen MDE.",
  "updates.mdeUpdate": "MDE update",
  "updates.percentDownloaded": "{percent}% downloaded",
  "updates.preparingDownload": "Preparing download",
  "updates.ready": "The update is ready. Restart MDE to finish installation.",
  "updates.restartToUpdate": "Restart to Update",
  "workspace.actionOpenFileSubtitle": "Single file",
  "workspace.actionOpenFileTitle": "Open Markdown file",
  "workspace.actionOpenWorkspaceSubtitle": "Folder workspace",
  "workspace.actionOpenWorkspaceTitle": "Open new workspace",
  "workspace.closePopup": "Close workspace popup",
  "workspace.manager": "Workspace manager",
  "workspace.manage": "Manage workspaces",
  "workspace.noMatchingResources": "No matching workspaces or files",
  "workspace.noRecentResources": "No recent workspaces or files",
  "workspace.openFileInNewWindow": "Open {resourceType} {name} in new window",
  "workspace.openResourceInNewWindow": "Open {resourceType} in new window",
  "workspace.openWorkspace": "Open workspace",
  "workspace.opening": "Opening...",
  "workspace.recent": "Recent",
  "workspace.recentResources": "Recent workspaces and files",
  "workspace.resourceActions": "{name} actions",
  "workspace.removeRecentResource": "Remove recent {resourceType} {name}",
  "workspace.removeRecentResourceTitle": "Remove recent {resourceType}",
  "workspace.searchResources": "Search workspaces and files",
  "workspace.subtitle": "Choose a folder workspace or a single Markdown file.",
  "workspace.switchToResource": "Switch to {resourceType} {name}",
  "workspace.workspaces": "Workspaces",
} as const satisfies AppLanguageMessages;

export type AppTextKey = keyof typeof EN_MESSAGES;
export type AppTextParams = Readonly<Record<string, string | number>>;
export type AppText = (key: AppTextKey, params?: AppTextParams) => string;

const ZH_MESSAGES: Record<AppTextKey, string> = {
  "ai.addTranslationLanguage": "添加翻译语言",
  "ai.aiResult": "AI 结果",
  "ai.cachedReadOnly": "已缓存 · 只读",
  "ai.closeResult": "关闭 AI 结果",
  "ai.customTranslationLanguage": "自定义翻译语言",
  "ai.generatedReadOnly": "由 {toolName} 生成 · 只读",
  "ai.otherLanguage": "其他语言",
  "ai.refineSummary": "调整摘要",
  "ai.refineSummaryInstruction": "摘要调整要求",
  "ai.regenerateSummary": "重新生成摘要",
  "ai.regenerateSummaryPlaceholder": "输入要求，让 MDE 重新生成摘要...",
  "ai.regenerating": "正在重新生成",
  "ai.removeCustomLanguage": "移除自定义语言",
  "ai.removeCustomLanguageNamed": "移除自定义语言 {language}",
  "ai.savedTo": "已保存到 {path}",
  "ai.summary": "摘要",
  "ai.summarizeMarkdown": "总结 Markdown",
  "ai.translation": "翻译",
  "ai.translationWithLanguage": "翻译：{language}",
  "ai.translationLanguages": "翻译语言",
  "ai.translateMarkdown": "翻译 Markdown",
  "ai.addCustomTranslationLanguage": "添加自定义翻译语言",
  "agentChat.attachImage": "添加图片",
  "agentChat.changeTypeAdded": "新增",
  "agentChat.changeTypeDeleted": "删除",
  "agentChat.changeTypeModified": "修改",
  "agentChat.changedFiles": "变更文件",
  "agentChat.close": "关闭 Agent Chat",
  "agentChat.composerPlaceholder": "询问当前 Markdown...",
  "agentChat.contextPreview": "上下文",
  "agentChat.diagnostic": "Agent Chat 诊断",
  "agentChat.maxPermission": "最高权限",
  "agentChat.messageField": "输入 Agent Chat 消息",
  "agentChat.newSession": "新建会话",
  "agentChat.noMessages": "还没有消息",
  "agentChat.removeAttachment": "移除附件 {fileName}",
  "agentChat.send": "发送",
  "agentChat.session": "会话",
  "agentChat.stop": "停止",
  "agentChat.thinking": "思考中...",
  "agentChat.title": "Agent Chat",
  "automation.archiveFlow": "归档 automation-flow",
  "automation.archivedFilter": "已归档",
  "automation.activeFlows": "活跃 flows",
  "automation.addFlowForWorkspace": "为 {workspace} 添加 flow",
  "automation.automationFlowsLabel": "个 automation-flow",
  "automation.bucketEmpty": "此队列暂无任务。",
  "automation.bugReportsSource": "Bug 报告",
  "automation.centerTitle": "自动化中心",
  "automation.chooseTemplateForWorkspace":
    "选择模板，为这个工作区启动自动化。",
  "automation.closeEditor": "关闭 automation-flow 编辑器",
  "automation.createFlow": "创建 automation-flow",
  "automation.decisionAction": "批准并继续",
  "automation.decisionPrompt": "需要决策",
  "automation.disableFlow": "停用 automation-flow",
  "automation.done": "已完成",
  "automation.doneDescription": "报告和验证历史。",
  "automation.editFlow": "编辑 automation-flow",
  "automation.enableFlow": "启用 automation-flow",
  "automation.editorAssetsUnavailable":
    "Automation-flow 编辑器不附加图片资产。",
  "automation.emptyTasks": "暂无自动化任务。",
  "automation.flowActions": "Flow 操作",
  "automation.flowEditor": "Automation-flow 编辑器",
  "automation.flowId": "Flow ID",
  "automation.flowToolbar": "Automation-flow 工具栏",
  "automation.flowsCount": "个 flow",
  "automation.flowline": "Flowline",
  "automation.flowlineEmpty": "选择任务后查看它的 Flowline。",
  "automation.loadingProjection": "正在加载自动化任务...",
  "automation.needsMe": "需要我",
  "automation.needsMeDescription": "仅显示等待人工输入的活跃运行。",
  "automation.newAutomationFlow": "新建 automation-flow",
  "automation.noSelectedSource": "未选择 automation-flow 来源。",
  "automation.noActiveFlows": "暂无活跃 flow",
  "automation.noWorkspace": "无工作区",
  "automation.personalAutomationFlows": "个人 automation-flows",
  "automation.personalPromptsSource": "个人 prompts",
  "automation.projectionError": "无法加载自动化任务。",
  "automation.ready": "就绪",
  "automation.readyDescription": "由 automation-flow 认领的候选任务。",
  "automation.requirementsSource": "需求",
  "automation.resizeSidebar": "调整自动化中心侧边栏宽度",
  "automation.restoreFlow": "恢复 automation-flow",
  "automation.returnToWorkspace": "回到工作区",
  "automation.running": "运行中",
  "automation.runningDescription": "正在执行的任务。",
  "automation.saveFlow": "保存 automation-flow",
  "automation.saveFlowFailed": "无法保存 automation-flow。",
  "automation.showArchivedFlows": "显示已归档 flow",
  "automation.signalStack": "Signal Stack",
  "automation.selectedSources": "已选择当前工作区的 automation-flow 来源",
  "automation.setupDiagnostics": "设置诊断",
  "automation.statusArchived": "Flow 已归档",
  "automation.statusDisabled": "Flow 已停用",
  "automation.statusEnabled": "Flow 已启用",
  "automation.statusSetup": "Flow 需要设置",
  "automation.stopFlow": "停止 automation-flow",
  "automation.startTask": "启动自动化任务",
  "automation.taskStack": "任务栈",
  "automation.tasksCountLabel": "个任务",
  "automation.templatePicker": "模板",
  "automation.validationDiagnostics": "验证诊断",
  "automation.validationPassed": "验证通过。",
  "automation.workspaceFilterPanel": "工作区 · flow 过滤器",
  "automation.workspaceFlows": "工作区 flows",
  "automation.workspaceUnknown": "当前工作区",
  "automation.taskFirstQueue": "任务优先队列",
  "automation.taskFirstQueueDescription":
    "工作区只是过滤条件，每张任务卡都来自一个 automation-flow。",
  "automation.taskDocsSource": "任务文档",
  "common.cancel": "取消",
  "common.close": "关闭",
  "common.delete": "删除",
  "common.done": "完成",
  "common.hide": "隐藏",
  "common.later": "稍后",
  "common.loadingFile": "正在加载文件...",
  "common.rename": "重命名",
  "common.search": "搜索",
  "common.show": "显示",
  "dropTarget.ariaLabel": "拖放文件或文件夹以打开",
  "dropTarget.description":
    "当前工作区内的 Markdown 文件会在这里打开；外部资源会在新窗口打开。",
  "dropTarget.title": "松手打开",
  "editor.actions": "编辑器操作",
  "editor.closeMarkdownSearch": "关闭当前 Markdown 搜索",
  "editor.collapseActions": "收起编辑器操作",
  "editor.emptyTitle": "选择一个文件夹开始",
  "editor.expandActions": "显示全部编辑器操作",
  "editor.frontmatter": "Frontmatter",
  "editor.frontmatterApply": "应用 Frontmatter",
  "editor.frontmatterEmpty": "无 Frontmatter 字段",
  "editor.frontmatterEdit": "编辑 Frontmatter",
  "editor.frontmatterFields": "字段",
  "editor.frontmatterInvalid": "YAML 无效",
  "editor.frontmatterManyFields": "{count} 个字段",
  "editor.frontmatterOneField": "1 个字段",
  "editor.frontmatterParseFailed": "Frontmatter 解析失败，将按原文保留。",
  "editor.frontmatterRawYaml": "原始 Frontmatter YAML",
  "editor.frontmatterSource": "源码",
  "editor.imageAssetRepairMany": "已恢复 {count} 个缺失的图片资源。",
  "editor.imageAssetRepairOne": "已恢复 1 个缺失的图片资源。",
  "editor.label": "编辑器",
  "editor.linkCreateAndInsert": "创建并插入",
  "editor.linkDialogClose": "关闭链接选择器",
  "editor.linkDialogKicker": "Markdown 链接",
  "editor.linkDialogTitle": "插入链接",
  "editor.linkDirectoryTree": "目录树",
  "editor.linkExistingDocument": "已有链接",
  "editor.linkNewDocument": "新建文档",
  "editor.linkNewDocumentDefaultName": "Untitled.md",
  "editor.linkNewDocumentName": "新文档名称",
  "editor.linkNewDocumentNameRequired": "请输入文档名称",
  "editor.linkNoSuggestions": "没有匹配的 Markdown 文件",
  "editor.linkRootDirectory": "工作区根目录",
  "editor.linkSlashDescription": "插入 Markdown 或网页链接",
  "editor.linkSlashTitle": "Link",
  "editor.linkSuggestions": "链接建议",
  "editor.linkTarget": "链接目标",
  "editor.linkTargetPlaceholder": "搜索文档或粘贴 https://...",
  "editor.lineSpacing": "编辑器行距",
  "editor.lineSpacingCompact": "紧凑",
  "editor.lineSpacingMenu": "行距",
  "editor.lineSpacingRelaxed": "宽松",
  "editor.lineSpacingStandard": "标准",
  "editor.markdownSearch": "搜索当前 Markdown",
  "editor.markdownSearchWithShortcut": "搜索当前 Markdown（{shortcut}）",
  "editor.deletePinnedSearchKeyword": "删除已固定的编辑器搜索关键字 {query}",
  "editor.pinSearchHistoryItem": "固定编辑器搜索记录 {query}",
  "editor.resizeExplorerSidebar": "调整资源管理器宽度",
  "editor.saving": "正在保存...",
  "editor.searchHistory": "编辑器搜索记录",
  "editor.searchPlaceholder": "搜索",
  "editor.unpinSearchHistoryItem": "取消固定编辑器搜索记录 {query}",
  "editor.unsavedChanges": "未保存的改动",
  "editor.usePinnedSearchKeyword": "使用已固定的编辑器搜索关键字 {query}",
  "editor.useSearchHistoryItem": "使用编辑器搜索记录 {query}",
  "editor.useCenteredView": "使用居中编辑视图",
  "editor.useFullWidthView": "使用全宽编辑视图",
  "errors.aiCliUnavailable": "安装 Codex 或 Claude Code CLI 后才能使用 AI 操作",
  "errors.aiToolsUnavailable":
    "未检测到支持的 AI CLI。安装 Codex 或 Claude Code 后即可启用 AI 操作。",
  "errors.editorApiUnavailable": "编辑器 API 不可用。请重启应用后重试。",
  "errors.languagePackGenerationFailed": "无法生成语言包",
  "errors.markdownParseFailed": "无法解析 Markdown",
  "errors.markdownSerializeFailed": "无法序列化 Markdown",
  "errors.openDroppedPathFailed": "无法打开拖入的路径",
  "errors.openDroppedUnsupportedPath": "请拖入 Markdown 文件或文件夹。",
  "errors.openFileFailed": "无法打开文件",
  "errors.openHistoryFailed": "无法打开文档历史",
  "errors.openLaunchPathFailed": "无法打开启动路径",
  "errors.openEditorLinkFailed": "无法打开链接",
  "errors.openMarkdownBeforeAi": "先打开一个 Markdown 文件再使用 AI 操作",
  "errors.openMarkdownBeforeImagePaste": "先打开一个 Markdown 文件再粘贴图片",
  "errors.openWorkspaceBeforeFiles": "先打开工作区再读取文件",
  "errors.openWorkspaceBeforeSearch": "先打开工作区再搜索",
  "errors.openWorkspaceInNewWindowFailed": "无法在新窗口打开工作区",
  "errors.openWorkspaceFailed": "无法打开工作区",
  "errors.readOnlyAiResult": "AI 结果是只读的",
  "errors.restoreHistoryFailed": "无法恢复文档历史",
  "errors.createFolderFailed": "无法创建文件夹",
  "errors.createMarkdownFileFailed": "无法创建 Markdown 文件",
  "errors.copyEntryFailed": "无法复制条目",
  "errors.copyPathFailed": "无法复制路径",
  "errors.deleteEntryFailed": "无法删除条目",
  "errors.installUpdateFailed": "无法安装更新",
  "errors.pasteEntryFailed": "无法粘贴条目",
  "errors.readFileFailed": "无法读取文件",
  "errors.refreshWorkspaceFailed": "无法刷新工作区",
  "errors.renameEntryFailed": "无法重命名条目",
  "errors.saveFileFailed": "无法保存文件",
  "errors.searchWorkspaceFailed": "无法搜索工作区",
  "errors.summarizeMarkdownFailed": "无法总结 Markdown",
  "errors.switchWorkspaceFailed": "无法切换工作区",
  "errors.translateMarkdownFailed": "无法翻译 Markdown",
  "errors.workspaceSearchUnavailable": "工作区搜索不可用。请重启应用后重试。",
  "explorer.collapseSidebar": "收起资源管理器侧边栏",
  "explorer.confirmDelete": "确认删除",
  "explorer.collapseDirectory": "收起 {name}",
  "explorer.copyAbsolutePath": "复制绝对路径",
  "explorer.copyEntry": "复制",
  "explorer.copyRelativePath": "复制相对路径",
  "explorer.deleteEntryPrompt": "删除 {path}？",
  "explorer.directoryAccessibleName": "{name} 文件夹",
  "explorer.empty": "打开一个文件夹来浏览 Markdown 文件。",
  "explorer.expandDirectory": "展开 {name}",
  "explorer.expandSidebar": "展开资源管理器侧边栏",
  "explorer.files": "文件",
  "explorer.header": "资源管理器",
  "explorer.hideHiddenEntries": "隐藏被隐藏的条目",
  "explorer.newFolder": "新建文件夹",
  "explorer.newFolderDefaultName": "notes",
  "explorer.newFolderName": "新建文件夹名称",
  "explorer.newMarkdownFile": "新建 Markdown 文件",
  "explorer.newMarkdownFileDefaultName": "Untitled.md",
  "explorer.newMarkdownFileName": "新建 Markdown 文件名称",
  "explorer.markdownFileAccessibleName": "{name} Markdown 文件",
  "explorer.noRecentFiles": "暂无最近文件",
  "explorer.openRecentFile": "打开最近文件 {path}",
  "explorer.openAutomationCenter": "打开自动化中心",
  "explorer.pasteEntry": "粘贴",
  "explorer.recentFileList": "最近文件列表",
  "explorer.recentFiles": "最近文件",
  "explorer.refresh": "刷新资源管理器",
  "explorer.resizeRecentFilesPanel": "调整最近文件面板高度",
  "explorer.renameEntryName": "重命名 {name}",
  "explorer.searchWorkspaceContents": "搜索工作区内容",
  "explorer.showHiddenEntries": "显示被隐藏的条目",
  "explorer.toolbar": "工作区操作",
  "flowchart.label": "流程图",
  "flowchart.closePreview": "关闭流程图预览",
  "flowchart.openPreview": "打开流程图预览 {index}",
  "flowchart.previewDialog": "流程图预览",
  "flowchart.renderFailed": "无法渲染流程图",
  "flowchart.resetView": "重置视图",
  "flowchart.resetZoom": "重置缩放",
  "flowchart.source": "Mermaid 源码 {index}",
  "flowchart.useCenteredPreview": "使用居中预览",
  "flowchart.useFullPagePreview": "使用整页预览",
  "flowchart.zoomIn": "放大",
  "flowchart.zoomOut": "缩小",
  "globalSearch.close": "关闭工作区搜索",
  "globalSearch.contentMode": "正文搜索模式",
  "globalSearch.contentModeWithShortcut": "正文搜索模式（{shortcut}）",
  "globalSearch.description": "搜索当前工作区中的 Markdown 文件。",
  "globalSearch.history": "工作区搜索记录",
  "globalSearch.historyLimit": "最多 {count} 条",
  "globalSearch.lineColumn": "第 {lineNumber} 行，第 {columnNumber} 列",
  "globalSearch.matchingHistory": "匹配最近搜索",
  "globalSearch.metadataMatch": "元数据",
  "globalSearch.modeGroup": "工作区搜索模式",
  "globalSearch.noResults": "没有结果",
  "globalSearch.openPathResult": "打开路径结果 {path}",
  "globalSearch.openResult": "打开搜索结果 {path} 第 {lineNumber} 行",
  "globalSearch.pathDescription": "搜索当前工作区中的 Markdown 文件路径。",
  "globalSearch.pathInput": "搜索工作区路径",
  "globalSearch.pathMode": "路径搜索模式",
  "globalSearch.pathModeWithShortcut": "路径搜索模式（{shortcut}）",
  "globalSearch.pathPlaceholder": "搜索路径",
  "globalSearch.pathResultType": "Markdown 路径",
  "globalSearch.placeholder": "搜索工作区",
  "globalSearch.searching": "正在搜索...",
  "globalSearch.searchWithShortcut": "搜索工作区内容（{shortcut}）",
  "globalSearch.useHistoryItem": "使用工作区搜索记录 {query}",
  "globalSearch.title": "搜索工作区",
  "history.deletedDocuments": "已删除文档",
  "history.emptyAutosaveConfirm":
    "自动保存检测到这次操作会清空文档，是否继续保存为空文档？",
  "history.event.aiWrite": "AI 写入前",
  "history.event.autosave": "自动保存前",
  "history.event.delete": "删除前",
  "history.event.externalDelete": "外部删除",
  "history.event.manualSave": "手动保存前",
  "history.event.rename": "重命名前",
  "history.event.restore": "恢复前",
  "history.exitPreview": "退出预览",
  "history.filter.ai": "AI 修改",
  "history.filter.all": "全部",
  "history.filter.delete": "删除前",
  "history.filter.saves": "保存",
  "history.noDeletedDocuments": "没有可恢复的已删除文档",
  "history.noVersions": "暂无版本",
  "history.openDeletedDocument": "预览已删除文档 {path}",
  "history.panelTitle": "文档历史",
  "history.previewVersion": "预览 {time} 的{event}",
  "history.readOnlyPreview": "只读版本预览",
  "history.recoverDeletedDocuments": "恢复已删除文档",
  "history.restoreThisVersion": "恢复此版本",
  "history.versionHistory": "版本历史",
  "settings.aiCli": "AI CLI",
  "settings.aiDescription": "选择用于摘要和翻译操作的本地 AI CLI。",
  "settings.aiTitle": "AI",
  "settings.changeTheme": "切换主题",
  "settings.close": "关闭设置",
  "settings.controls": "设置控件",
  "settings.customLanguageAction": "生成语言包",
  "settings.customLanguageDescription":
    "使用检测到的 AI CLI 将 MDE 界面文案翻译成其他语言。",
  "settings.customLanguageName": "自定义应用语言",
  "settings.customLanguageOptionLabel": "{language}（自定义）",
  "settings.customLanguagePlaceholder": "西班牙语、日语、德语...",
  "settings.defaultModelName": "默认模型名称",
  "settings.followSystemAppearance": "跟随系统外观",
  "settings.followSystemDescription": "使用当前操作系统的浅色或深色模式。",
  "settings.generatingLanguagePack": "正在生成语言包...",
  "settings.language": "语言",
  "settings.languageDescription": "选择菜单和提示使用的语言。",
  "settings.languagePackReady": "{language} 语言包已准备好。",
  "settings.languageSection": "应用语言",
  "settings.modelHint": "这里只显示已安装的 CLI。模型留空时使用 CLI 默认值。",
  "settings.nav": "设置分区",
  "settings.noAiToolsForLanguage":
    "安装 Codex 或 Claude Code 后才能生成自定义语言包。",
  "settings.open": "打开设置",
  "settings.preferenceDescription": "选择应用语言并生成自定义语言包。",
  "settings.preferenceTitle": "偏好",
  "settings.panelLabel": "{panel}设置",
  "settings.updateCustomLanguageAction": "更新所选语言包",
  "settings.updateCustomLanguageDescription":
    "使用 AI 根据最新应用文案刷新当前选择的自定义语言包。",
  "settings.updatingLanguagePack": "正在更新语言包...",
  "workspace.resourceTypeFile": "file",
  "workspace.resourceTypeWorkspace": "workspace",
  "settings.subtitle": "配置编辑器行为、AI 工具和应用更新。",
  "settings.systemThemeDescription": "选择系统外观使用的 {family} 主题。",
  "settings.themeColorways": "主题配色",
  "settings.themeDescription": "选择编辑器外观。",
  "settings.themeFooterLabel": "主题",
  "settings.themeTitle": "主题",
  "settings.title": "设置",
  "settings.updateDescription": "查看已安装的 MDE 版本并检查 GitHub releases。",
  "settings.updateTitle": "检查更新",
  "settings.updatesUnavailable": "当前运行环境不支持检查更新。",
  "settings.currentVersion": "当前版本",
  "settings.checkForUpdates": "检查更新",
  "settings.checkingForUpdates": "正在检查...",
  "settings.checkUpdatesFailed": "无法检查更新",
  "settings.upToDate": "MDE 已是最新版本。",
  "settings.updateAvailable": "MDE {version} 可用。",
  "theme.columnDark": "深色",
  "theme.columnDarkPanel": "深色侧栏",
  "theme.columnLightPanel": "浅色侧栏",
  "theme.description.apricot": "适合暖色写作的柔和杏色纸面。",
  "theme.description.atelier": "暖色工作室纸面和炭黑侧栏。",
  "theme.description.basalt": "石墨深色搭配矿物蓝绿强调色。",
  "theme.description.binder": "冷静的研究笔记浅色模式。",
  "theme.description.blueHour": "冷色技术感夜间模式。",
  "theme.description.canopy": "绿色纸面搭配深色树冠侧栏。",
  "theme.description.carbon": "适合专注工作的中性深色。",
  "theme.description.cedar": "暖调弱光写作界面。",
  "theme.description.ember": "低亮度深色搭配暖色标记。",
  "theme.description.glacier": "清透蓝色浅色模式和淡色侧栏。",
  "theme.description.ink": "深墨底色搭配黄铜高光。",
  "theme.description.ivory": "象牙纸面搭配克制的黄铜标记。",
  "theme.description.lagoon": "浅潟湖色编辑区搭配深蓝绿侧栏。",
  "theme.description.ledger": "账簿纸面搭配墨黑黄铜侧栏。",
  "theme.description.lilac": "安静紫色笔记搭配浅色侧栏。",
  "theme.description.manuscript": "暖纸面编辑器和柔和侧栏。",
  "theme.description.mint": "清新的浅色工作区搭配薄荷色墨迹。",
  "theme.description.moss": "柔和绿灰色深色模式。",
  "theme.description.paperBlue": "适合技术笔记的柔和蓝色纸面。",
  "theme.description.plum": "适合深夜研究的低饱和紫色。",
  "theme.description.porcelain": "清爽的技术浅色模式。",
  "theme.description.quarry": "灰石工作区搭配炭色侧栏。",
  "theme.description.sagePaper": "适合阅读的柔和绿色纸面。",
  "theme.description.terracotta": "暖陶土编辑区搭配炭色侧栏。",
  "theme.familyDark": "深色",
  "theme.familyLight": "浅色",
  "theme.groupBlue": "蓝色",
  "theme.groupBrass": "黄铜",
  "theme.groupEmber": "暖焰",
  "theme.groupGreen": "绿色",
  "theme.groupNeutral": "中性",
  "theme.groupTeal": "蓝绿",
  "theme.groupViolet": "紫色",
  "theme.groupWarm": "暖色",
  "theme.label.apricot": "杏色",
  "theme.label.atelier": "工作室",
  "theme.label.basalt": "玄武岩",
  "theme.label.binder": "装订本",
  "theme.label.blueHour": "蓝调时刻",
  "theme.label.canopy": "树冠",
  "theme.label.carbon": "碳黑",
  "theme.label.cedar": "雪松",
  "theme.label.ember": "余烬",
  "theme.label.glacier": "冰川",
  "theme.label.ink": "墨色",
  "theme.label.ivory": "象牙白",
  "theme.label.lagoon": "潟湖",
  "theme.label.ledger": "账簿",
  "theme.label.lilac": "丁香紫",
  "theme.label.manuscript": "手稿",
  "theme.label.mint": "薄荷",
  "theme.label.moss": "苔藓",
  "theme.label.paperBlue": "纸蓝",
  "theme.label.plum": "梅紫",
  "theme.label.porcelain": "瓷白",
  "theme.label.quarry": "采石场",
  "theme.label.sagePaper": "鼠尾草纸",
  "theme.label.terracotta": "赤陶",
  "theme.systemThemeLabel": "系统 {theme}",
  "updates.available": "有可用更新",
  "updates.bytesDownloaded": "已下载 {bytes} 字节",
  "updates.downloadAndInstall": "下载并安装",
  "updates.downloadingMac": "MDE 正在下载 macOS 安装器。",
  "updates.downloadingWindows": "MDE 正在后台下载 Windows 更新。",
  "updates.failed": "MDE 未能完成更新。",
  "updates.installMac": "下载 macOS 安装器，然后在打开的安装窗口中替换 MDE。",
  "updates.installWindows": "MDE 将在后台下载 Windows 更新。",
  "updates.installerOpened":
    "安装器已打开。退出 MDE，将 MDE 拖到 Applications 并替换旧应用，然后重新打开 MDE。",
  "updates.mdeUpdate": "MDE 更新",
  "updates.percentDownloaded": "已下载 {percent}%",
  "updates.preparingDownload": "准备下载",
  "updates.ready": "更新已准备好。重启 MDE 以完成安装。",
  "updates.restartToUpdate": "重启以更新",
  "workspace.actionOpenFileSubtitle": "单个文件",
  "workspace.actionOpenFileTitle": "打开 Markdown 文件",
  "workspace.actionOpenWorkspaceSubtitle": "文件夹工作区",
  "workspace.actionOpenWorkspaceTitle": "打开新工作区",
  "workspace.closePopup": "关闭工作区弹窗",
  "workspace.manager": "工作区管理",
  "workspace.manage": "管理工作区",
  "workspace.noMatchingResources": "没有匹配的工作区或文件",
  "workspace.noRecentResources": "暂无最近工作区或文件",
  "workspace.openFileInNewWindow": "在新窗口打开{resourceType} {name}",
  "workspace.openResourceInNewWindow": "在新窗口打开{resourceType}",
  "workspace.openWorkspace": "打开工作区",
  "workspace.opening": "正在打开...",
  "workspace.recent": "最近",
  "workspace.recentResources": "最近工作区和文件",
  "workspace.resourceActions": "{name} 操作",
  "workspace.removeRecentResource": "移除最近的{resourceType} {name}",
  "workspace.removeRecentResourceTitle": "移除最近的{resourceType}",
  "workspace.searchResources": "搜索工作区和文件",
  "workspace.subtitle": "选择文件夹工作区或单个 Markdown 文件。",
  "workspace.switchToResource": "切换到{resourceType} {name}",
  "workspace.workspaces": "工作区",
};

export const BUILT_IN_APP_LANGUAGE_PACKS = {
  en: {
    id: "en",
    label: "English",
    locale: "en",
    messages: EN_MESSAGES,
  },
  zh: {
    id: "zh",
    label: "中文",
    locale: "zh-CN",
    messages: ZH_MESSAGES,
  },
} as const satisfies Record<"en" | "zh", AppLanguagePack>;

const SUPPORTED_BUILT_IN_LANGUAGE_IDS = new Set(
  Object.keys(BUILT_IN_APP_LANGUAGE_PACKS),
);

const isBuiltInLanguageId = (languageId: string): languageId is "en" | "zh" =>
  SUPPORTED_BUILT_IN_LANGUAGE_IDS.has(languageId);

export const resolveSystemAppLanguageId = (
  locales?: string | readonly string[] | null,
): "en" | "zh" => {
  const candidateLocales = Array.isArray(locales)
    ? locales
    : locales
      ? [locales]
      : [];

  for (const locale of candidateLocales) {
    const normalizedLocale = String(locale).trim().toLocaleLowerCase();

    if (normalizedLocale.startsWith("zh")) {
      return "zh";
    }

    if (normalizedLocale.startsWith("en")) {
      return "en";
    }
  }

  return "en";
};

const getNavigatorLocales = (): readonly string[] => {
  try {
    const navigatorLanguages = globalThis.navigator?.languages;

    if (navigatorLanguages && navigatorLanguages.length > 0) {
      return navigatorLanguages;
    }

    return globalThis.navigator?.language
      ? [globalThis.navigator.language]
      : [];
  } catch {
    return [];
  }
};

export const readAppLanguagePreference = (
  storage: Pick<Storage, "getItem">,
  systemLocales:
    | string
    | readonly string[]
    | null
    | undefined = getNavigatorLocales(),
): string => {
  try {
    const storedLanguageId = storage.getItem(APP_LANGUAGE_STORAGE_KEY);

    if (
      storedLanguageId &&
      (isBuiltInLanguageId(storedLanguageId) ||
        storedLanguageId.startsWith("custom:"))
    ) {
      return storedLanguageId;
    }
  } catch {
    // Storage can be unavailable in restricted renderer contexts.
  }

  return resolveSystemAppLanguageId(systemLocales);
};

export const writeAppLanguagePreference = (
  storage: Pick<Storage, "setItem">,
  languageId: string,
): void => {
  try {
    storage.setItem(APP_LANGUAGE_STORAGE_KEY, languageId);
  } catch {
    // Storage can be unavailable in restricted renderer contexts.
  }
};

export const formatAppText = (
  template: string,
  params: AppTextParams = {},
): string =>
  Object.entries(params).reduce(
    (formattedText, [key, value]) =>
      formattedText.replaceAll(`{${key}}`, String(value)),
    template,
  );

export const createAppText =
  (languagePack: AppLanguagePack): AppText =>
  (key, params) =>
    formatAppText(languagePack.messages[key] ?? EN_MESSAGES[key], params);

export const createAppLanguagePackEntries = (
  languagePack: AppLanguagePack,
): readonly AppLanguagePackEntry[] =>
  (Object.keys(EN_MESSAGES) as AppTextKey[]).map((key) => ({
    key,
    text: languagePack.messages[key] ?? EN_MESSAGES[key],
  }));

export const isCustomAppLanguagePack = (
  languagePack: Pick<AppLanguagePack, "id">,
): boolean => languagePack.id.startsWith("custom:");

const createCustomLanguageId = (languageLabel: string): string => {
  const slug = languageLabel
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return `custom:${slug || "language"}`;
};

export const createCustomAppLanguagePack = (
  languageLabel: string,
  entries: readonly { readonly key: string; readonly text: string }[],
): AppLanguagePack => {
  const generatedMessages = entries.reduce<AppLanguageMessages>(
    (messages, entry) => ({
      ...messages,
      ...(entry.key in EN_MESSAGES ? { [entry.key]: entry.text } : {}),
    }),
    {},
  );

  return {
    id: createCustomLanguageId(languageLabel),
    label: languageLabel.trim(),
    locale: createCustomLanguageId(languageLabel).replace("custom:", ""),
    messages: {
      ...EN_MESSAGES,
      ...generatedMessages,
    },
  };
};

const isStoredAppLanguagePack = (value: unknown): value is AppLanguagePack => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<AppLanguagePack>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.startsWith("custom:") &&
    typeof candidate.label === "string" &&
    typeof candidate.locale === "string" &&
    Boolean(candidate.messages) &&
    typeof candidate.messages === "object" &&
    !Array.isArray(candidate.messages)
  );
};

export const readCustomAppLanguagePacks = (
  storage: Pick<Storage, "getItem"> = globalThis.localStorage,
): readonly AppLanguagePack[] => {
  try {
    const storedValue = storage.getItem(APP_CUSTOM_LANGUAGE_PACKS_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue) as unknown;

    return Array.isArray(parsedValue)
      ? parsedValue.filter(isStoredAppLanguagePack).map((pack) => ({
          ...pack,
          messages: {
            ...EN_MESSAGES,
            ...pack.messages,
          },
        }))
      : [];
  } catch {
    return [];
  }
};

export const writeCustomAppLanguagePacks = (
  storage: Pick<Storage, "setItem">,
  languagePacks: readonly AppLanguagePack[],
): void => {
  try {
    storage.setItem(
      APP_CUSTOM_LANGUAGE_PACKS_STORAGE_KEY,
      JSON.stringify(languagePacks),
    );
  } catch {
    // Storage can be unavailable in restricted renderer contexts.
  }
};

export const getAppLanguagePack = (
  languageId: string,
  customLanguagePacks: readonly AppLanguagePack[] = [],
): AppLanguagePack => {
  if (isBuiltInLanguageId(languageId)) {
    return BUILT_IN_APP_LANGUAGE_PACKS[languageId];
  }

  return (
    customLanguagePacks.find(
      (languagePack) => languagePack.id === languageId,
    ) ?? BUILT_IN_APP_LANGUAGE_PACKS.en
  );
};

export const getSelectableAppLanguagePacks = (
  customLanguagePacks: readonly AppLanguagePack[],
): readonly AppLanguagePack[] => [
  BUILT_IN_APP_LANGUAGE_PACKS.en,
  BUILT_IN_APP_LANGUAGE_PACKS.zh,
  ...customLanguagePacks,
];
