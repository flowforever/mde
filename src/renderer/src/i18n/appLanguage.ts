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
  "editor.actions": "Editor actions",
  "editor.closeMarkdownSearch": "Close current Markdown search",
  "editor.emptyTitle": "Select a folder to begin",
  "editor.frontmatter": "Frontmatter",
  "editor.frontmatterApply": "Apply frontmatter",
  "editor.frontmatterEdit": "Edit frontmatter",
  "editor.frontmatterInvalid": "invalid YAML",
  "editor.frontmatterManyFields": "{count} fields",
  "editor.frontmatterOneField": "1 field",
  "editor.frontmatterParseFailed":
    "Frontmatter parse failed; raw YAML will be preserved.",
  "editor.frontmatterRawYaml": "Raw frontmatter YAML",
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
  "editor.markdownSearch": "Search current Markdown",
  "editor.resizeExplorerSidebar": "Resize explorer sidebar",
  "editor.saving": "Saving...",
  "editor.searchPlaceholder": "Search",
  "editor.unsavedChanges": "Unsaved changes",
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
  "errors.openFileFailed": "Unable to open file",
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
  "errors.createFolderFailed": "Unable to create folder",
  "errors.createMarkdownFileFailed": "Unable to create Markdown file",
  "errors.deleteEntryFailed": "Unable to delete entry",
  "errors.installUpdateFailed": "Unable to install update",
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
  "explorer.recentFileList": "Recent file list",
  "explorer.recentFiles": "Recent Files",
  "explorer.refresh": "Refresh explorer",
  "explorer.resizeRecentFilesPanel": "Resize recent files panel",
  "explorer.renameEntryName": "Rename {name}",
  "explorer.searchWorkspaceContents": "Search workspace contents",
  "explorer.showHiddenEntries": "Show hidden entries",
  "explorer.toolbar": "Workspace actions",
  "flowchart.label": "Flowcharts",
  "flowchart.renderFailed": "Unable to render flowchart",
  "flowchart.source": "Mermaid source {index}",
  "globalSearch.close": "Close workspace search",
  "globalSearch.description": "Search Markdown files in the current workspace.",
  "globalSearch.lineColumn": "Line {lineNumber}, column {columnNumber}",
  "globalSearch.metadataMatch": "metadata",
  "globalSearch.noResults": "No results",
  "globalSearch.openResult": "Open search result {path} line {lineNumber}",
  "globalSearch.placeholder": "Search workspace",
  "globalSearch.searching": "Searching...",
  "globalSearch.title": "Search workspace",
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
  "editor.actions": "编辑器操作",
  "editor.closeMarkdownSearch": "关闭当前 Markdown 搜索",
  "editor.emptyTitle": "选择一个文件夹开始",
  "editor.frontmatter": "Frontmatter",
  "editor.frontmatterApply": "应用 Frontmatter",
  "editor.frontmatterEdit": "编辑 Frontmatter",
  "editor.frontmatterInvalid": "YAML 无效",
  "editor.frontmatterManyFields": "{count} 个字段",
  "editor.frontmatterOneField": "1 个字段",
  "editor.frontmatterParseFailed": "Frontmatter 解析失败，将按原文保留。",
  "editor.frontmatterRawYaml": "原始 Frontmatter YAML",
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
  "editor.linkSlashTitle": "链接",
  "editor.linkSuggestions": "链接建议",
  "editor.linkTarget": "链接目标",
  "editor.linkTargetPlaceholder": "搜索文档或粘贴 https://...",
  "editor.markdownSearch": "搜索当前 Markdown",
  "editor.resizeExplorerSidebar": "调整资源管理器宽度",
  "editor.saving": "正在保存...",
  "editor.searchPlaceholder": "搜索",
  "editor.unsavedChanges": "未保存的改动",
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
  "errors.openFileFailed": "无法打开文件",
  "errors.openLaunchPathFailed": "无法打开启动路径",
  "errors.openEditorLinkFailed": "无法打开链接",
  "errors.openMarkdownBeforeAi": "先打开一个 Markdown 文件再使用 AI 操作",
  "errors.openMarkdownBeforeImagePaste": "先打开一个 Markdown 文件再粘贴图片",
  "errors.openWorkspaceBeforeFiles": "先打开工作区再读取文件",
  "errors.openWorkspaceBeforeSearch": "先打开工作区再搜索",
  "errors.openWorkspaceInNewWindowFailed": "无法在新窗口打开工作区",
  "errors.openWorkspaceFailed": "无法打开工作区",
  "errors.readOnlyAiResult": "AI 结果是只读的",
  "errors.createFolderFailed": "无法创建文件夹",
  "errors.createMarkdownFileFailed": "无法创建 Markdown 文件",
  "errors.deleteEntryFailed": "无法删除条目",
  "errors.installUpdateFailed": "无法安装更新",
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
  "explorer.recentFileList": "最近文件列表",
  "explorer.recentFiles": "最近文件",
  "explorer.refresh": "刷新资源管理器",
  "explorer.resizeRecentFilesPanel": "调整最近文件面板高度",
  "explorer.renameEntryName": "重命名 {name}",
  "explorer.searchWorkspaceContents": "搜索工作区内容",
  "explorer.showHiddenEntries": "显示被隐藏的条目",
  "explorer.toolbar": "工作区操作",
  "flowchart.label": "流程图",
  "flowchart.renderFailed": "无法渲染流程图",
  "flowchart.source": "Mermaid 源码 {index}",
  "globalSearch.close": "关闭工作区搜索",
  "globalSearch.description": "搜索当前工作区中的 Markdown 文件。",
  "globalSearch.lineColumn": "第 {lineNumber} 行，第 {columnNumber} 列",
  "globalSearch.metadataMatch": "元数据",
  "globalSearch.noResults": "没有结果",
  "globalSearch.openResult": "打开搜索结果 {path} 第 {lineNumber} 行",
  "globalSearch.placeholder": "搜索工作区",
  "globalSearch.searching": "正在搜索...",
  "globalSearch.title": "搜索工作区",
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

  return candidateLocales.some((locale) =>
    String(locale).trim().toLocaleLowerCase().startsWith("zh"),
  )
    ? "zh"
    : "en";
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
