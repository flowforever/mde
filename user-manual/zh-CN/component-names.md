# 内部组件命名参考

这份参考用于开发、测试、设计评审、E2E 截图维护和需求沟通。它不是普通用户教程；普通使用流程仍以首页推荐阅读路径为准。

`Standard Name` 是内部英文标准名，`Component ID` 对应代码中的 `data-component-id`。通用控件类型只作为命名规则时，不进入 concrete component mapping。

## 全局框架

全局框架覆盖主窗口、左右分栏、拖拽覆盖层和空编辑状态。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| App Shell | `app.shell` | 应用主壳 | 主窗口 | `apps/desktop/src/renderer/src/app/App.tsx` | 承载 Explorer、编辑器和全局拖拽事件的根容器。 |
| Explorer Pane | `explorer.pane` | Explorer 分栏 | 左侧栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 工作区、文件树、最近文件和设置入口所在分栏。 |
| Editor Pane | `editor.pane` | 编辑器分栏 | 右侧主区 | `apps/desktop/src/renderer/src/app/App.tsx` | Markdown 编辑器、AI 结果和历史面板所在区域。 |
| Explorer Resize Handle | `explorer.resize-handle` | Explorer 宽度拖拽柄 | 主窗口分栏之间 | `apps/desktop/src/renderer/src/app/App.tsx` | 调整 Explorer 宽度的分隔控件。 |
| Drop Target Overlay | `app.drop-target-overlay` | 拖拽目标覆盖层 | 主窗口覆盖层 | `apps/desktop/src/renderer/src/app/App.tsx` | 拖入外部资源时显示的覆盖提示。 |
| Empty Editor State | `editor.empty-state` | 空编辑器状态 | 编辑器分栏 | `apps/desktop/src/renderer/src/app/App.tsx` | 未打开文件时的占位状态。 |

## Automation Center

Automation Center 覆盖独立自动化窗口、任务队列和右侧流程线详情。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Automation Archived Toggle | `automation.archived-toggle` | 自动化归档开关 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 控制是否显示已归档自动化流程。 |
| Automation Bucket Filter Button | `automation.bucket-filter-button` | 自动化状态过滤按钮 | 自动化任务堆栈 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 在 Task Stack 中选择 Ready、Running、Needs me 或 Done。 |
| Automation Center Window | `automation.center-window` | 自动化中心窗口 | 独立自动化窗口 | `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx` | Automation Center 渲染根容器。 |
| Automation Decision Approve Button | `automation.decision-approve-button` | 自动化决策批准按钮 | 自动化流程线 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 在 Needs me 决策中批准并继续同一个自动化运行。 |
| Automation Decision Panel | `automation.decision-panel` | 自动化决策面板 | 自动化流程线 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 显示当前任务的待处理决策提示。 |
| Automation Decision Status Message | `automation.decision-status-message` | 自动化决策状态消息 | 自动化中心主任务区 | `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx` | 提交人工决策失败时显示本地化的用户可读状态消息。 |
| Automation Diagnostic List | `automation.diagnostic-list` | 自动化诊断列表 | 自动化中心主任务区 | `apps/desktop/src/renderer/src/automation/SignalStack.tsx` | 自动化设置与运行诊断列表。 |
| Automation Diagnostic Management Button | `automation.diagnostic-management-button` | 自动化诊断管理按钮 | 自动化中心主任务区 | `apps/desktop/src/renderer/src/automation/SignalStack.tsx` | 从设置诊断进入对应 Automation Flows 管理位置。 |
| Automation Blocked Start Diagnostic Row | `automation.blocked-start-diagnostic-row` | 自动化阻塞启动诊断行 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 阻止当前任务启动的单条诊断。 |
| Automation Blocked Start Diagnostics Panel | `automation.blocked-start-diagnostics-panel` | 自动化阻塞启动诊断面板 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 显示阻止当前任务启动的诊断列表。 |
| Automation Editor Close Button | `automation.editor-close-button` | 自动化编辑器关闭按钮 | 兼容残留自动化编辑模式 | `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` | 旧内嵌自动化编辑器的关闭按钮；当前生产入口使用普通 Markdown 编辑器。 |
| Automation Editor Host | `automation.editor-host` | 自动化编辑器容器 | 兼容残留自动化编辑模式 | `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` | 旧内嵌自动化编辑器容器；当前生产入口使用普通 Markdown 编辑器。 |
| Automation Editor Save Button | `automation.editor-save-button` | 自动化编辑器保存按钮 | 兼容残留自动化编辑模式 | `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` | 旧内嵌自动化编辑器的保存按钮；当前生产入口使用普通 Markdown 编辑器。 |
| Automation Executor Selector | `automation.executor-selector` | 自动化执行器选择器 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 在多个可用执行器之间选择本次任务启动目标。 |
| Automation Flow Enabled Section | `automation.flow-enabled-section` | 已启用自动化流程分组 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 收纳包含 automation-flow 的工作区过滤项。 |
| Automation Flow Filter Toggle | `automation.flow-filter-toggle` | 自动化流程多选开关 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 将单个自动化流程加入或移出多选过滤范围。 |
| Automation Flow Lifecycle Button | `automation.flow-lifecycle-button` | 自动化流程启停按钮 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 直接启用或停用单个 automation-flow。 |
| Automation Flow Not Enabled Section | `automation.flow-not-enabled-section` | 未启用自动化流程分组 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 收纳没有 automation-flow 的工作区过滤项。 |
| Automation Flow Row | `automation.flow-row` | 自动化流程行 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 单个自动化流程的列表行。 |
| Automation Flow Toolbar | `automation.flow-toolbar` | 自动化流程工具栏 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 与现有 Explorer 左侧 panel 一致的流程操作工具栏。 |
| Automation Global Flow Section | `automation.global-flow-section` | 全局自动化流程分组 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 收纳全局 automation-flow 过滤项。 |
| Automation Signal Stack | `automation.signal-stack` | 自动化信号队列 | 自动化中心主任务区 | `apps/desktop/src/renderer/src/automation/SignalStack.tsx` | 自动化任务状态队列。 |
| Automation Task Stack | `automation.task-stack` | 自动化任务堆栈 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 与 prototype 对齐的 Needs me、Running、Ready、Done 状态入口组。 |
| Automation Template Picker | `automation.template-picker` | 自动化模板选择器 | 兼容残留自动化编辑模式 | `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` | 旧内嵌模板编辑器控件；当前 Automation Center 不再提供模板管理入口。 |
| Automation Validation Panel | `automation.validation-panel` | 自动化验证面板 | 兼容残留自动化编辑模式 | `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` | 旧内嵌自动化编辑器验证区域；当前流程 Markdown 通过普通编辑器打开。 |
| Automation Flowline | `automation.flowline` | 自动化流程线 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 选中任务的流程线详情区。 |
| Automation Flowline Close Button | `automation.flowline-close-button` | 自动化流程线关闭按钮 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 清除当前选中的流程线详情。 |
| Automation Flowline Phase | `automation.flowline-phase` | 自动化流程线阶段 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 流程线中由任务/运行数据生成的阶段项。 |
| Automation Execution Record Row | `automation.execution-record-row` | 自动化执行记录行 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 展示选中任务的一次执行记录，包括状态、执行器和执行根目录。 |
| Automation Execution Records Panel | `automation.execution-records-panel` | 自动化执行记录面板 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 汇总选中任务已有的执行记录。 |
| Automation Execution Root Label | `automation.execution-root-label` | 自动化执行根目录标签 | 自动化中心任务卡片、右侧详情区和运行详情 | `apps/desktop/src/renderer/src/automation/SignalStack.tsx`, `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx`, `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 当任务使用不同于当前工作区的执行根目录时显示该路径。 |
| Automation Primary Executor Label | `automation.primary-executor-label` | 自动化主执行器标签 | 自动化中心任务卡片和右侧详情区 | `apps/desktop/src/renderer/src/automation/SignalStack.tsx`, `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 显示当前任务的主执行器。 |
| Automation Return Workspace Button | `automation.return-workspace-button` | 返回工作区按钮 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 从 Automation Center 切回原工作区窗口。 |
| Automation Run History Detail Button | `automation.run-history-detail-button` | 自动化运行记录详情按钮 | 自动化中心右侧运行记录 | `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 打开某条运行记录的解析结果和过程详情。 |
| Automation Run History Detail Close Button | `automation.run-history-detail-close-button` | 自动化运行记录详情关闭按钮 | 自动化中心右侧运行记录详情弹窗 | `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 关闭运行记录详情弹窗。 |
| Automation Run History Detail Dialog | `automation.run-history-detail-dialog` | 自动化运行记录详情弹窗 | 自动化中心右侧运行记录 | `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 展示 automation-flow 解析结果、过程和运行状态。 |
| Automation Run History Native Session Button | `automation.run-history-native-session-button` | 自动化运行记录原生会话按钮 | 自动化中心右侧运行记录 | `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 打开某条运行记录对应的 Codex/Claude 原生会话。 |
| Automation Run History Panel | `automation.run-history-panel` | 自动化运行记录面板 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 列出 automation-flow 的历史运行记录。 |
| Automation Run History Row | `automation.run-history-row` | 自动化运行记录行 | 自动化中心右侧运行记录 | `apps/desktop/src/renderer/src/automation/AutomationRunHistory.tsx` | 单条 automation-flow 运行记录。 |
| Automation Scope Filter Management Button | `automation.scope-filter-management-button` | 自动化范围管理按钮 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 跳转到全局或工作区自动化流程管理位置。 |
| Automation Scope Filter Toggle | `automation.scope-filter-toggle` | 自动化范围过滤开关 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 将全局或工作区范围加入或移出过滤条件。 |
| Automation Selected Executor Start Button | `automation.selected-executor-start-button` | 自动化所选执行器启动按钮 | 自动化中心右侧详情区 | `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` | 使用当前选择的执行器启动任务数据。 |
| Automation Sidebar Resize Handle | `automation.sidebar-resize-handle` | 自动化侧边栏宽度调节柄 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx` | 与现有 Explorer 一致的左右拖拽调宽入口。 |
| Automation Signal Task Row | `automation.signal-task-row` | 自动化信号任务卡片 | 信号队列 | `apps/desktop/src/renderer/src/automation/SignalStack.tsx` | task-first 队列中的单个投影任务卡片。 |
| Automation Status Light | `automation.status-light` | 自动化状态灯 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 用颜色和无障碍标签表示流程状态。 |
| Automation Workspace Filter Card | `automation.workspace-filter-card` | 自动化工作区过滤卡片 | 自动化工作区过滤面板 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 单个工作区及其自动化流程列表容器。 |
| Automation Workspace Filter Panel | `automation.workspace-filter-panel` | 自动化工作区过滤面板 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 与 prototype 对齐的工作区流程过滤分组。 |
| Automation Workspace Filters | `automation.workspace-filters` | 自动化工作区过滤器 | 自动化中心左侧过滤区 | `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` | 工作区、流程、归档状态过滤入口。 |

## 工作区管理

工作区管理覆盖打开工作区、打开单个 Markdown 文件和最近资源列表。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Workspace Manager Trigger | `workspace.manager-trigger` | 工作区管理入口 | Explorer 顶部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 打开工作区管理弹窗的按钮。 |
| Workspace Manager Dialog | `workspace.manager-dialog` | 工作区管理弹窗 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 选择工作区、文件和最近资源的弹窗。 |
| Open Workspace Action | `workspace.open-workspace-action` | 打开工作区动作 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 从系统选择器打开目录工作区。 |
| Open Markdown File Action | `workspace.open-markdown-file-action` | 打开 Markdown 文件动作 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 从系统选择器打开单个 Markdown 文件。 |
| Recent Resource List | `workspace.recent-resource-list` | 最近资源列表 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 最近工作区和最近单文件资源列表。 |
| Recent Resource Row | `workspace.recent-resource-row` | 最近资源行 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 最近资源列表中的单行。 |
| Recent Resource Search Field | `workspace.recent-resource-search-field` | 最近资源搜索框 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 过滤最近资源的搜索输入框。 |
| Open Resource In New Window Button | `workspace.open-resource-in-new-window-button` | 新窗口打开资源按钮 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 在新窗口打开某个最近资源。 |
| Forget Recent Resource Button | `workspace.forget-recent-resource-button` | 移除最近资源按钮 | 工作区弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 从最近资源记录中移除条目。 |

## Explorer

Explorer 覆盖文件树、工具栏、上下文菜单、最近文件和已删除文档恢复入口。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Explorer Header | `explorer.header` | Explorer 标题 | Explorer 顶部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 左侧栏标题区域。 |
| Automation Home Button | `explorer.automation-home-button` | 自动化中心入口按钮 | Explorer 顶部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 打开或聚焦 Automation Center 独立窗口。 |
| Explorer Toolbar | `explorer.toolbar` | Explorer 工具栏 | Explorer 文件区顶部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 搜索、新建、恢复、显示隐藏项和刷新按钮组。 |
| Workspace Search Button | `explorer.workspace-search-button` | 工作区搜索按钮 | Explorer 工具栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 打开工作区全文搜索。 |
| New Markdown File Button | `explorer.new-markdown-file-button` | 新建 Markdown 文件按钮 | Explorer 工具栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 在当前目录新建 Markdown 文件。 |
| New Folder Button | `explorer.new-folder-button` | 新建文件夹按钮 | Explorer 工具栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 在当前目录新建文件夹。 |
| Recover Deleted Documents Button | `explorer.recover-deleted-documents-button` | 恢复已删除文档按钮 | Explorer 工具栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 显示或隐藏已删除文档恢复区。 |
| Show Hidden Entries Button | `explorer.show-hidden-entries-button` | 显示隐藏条目按钮 | Explorer 工具栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 切换 `.mde` 等隐藏条目的显示。 |
| Refresh Explorer Button | `explorer.refresh-button` | 刷新 Explorer 按钮 | Explorer 工具栏 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 刷新当前工作区文件树。 |
| Explorer Tree | `explorer.tree` | Explorer 文件树 | Explorer 文件区 | `apps/desktop/src/renderer/src/explorer/ExplorerTree.tsx` | 工作区目录树根节点列表。 |
| Explorer Tree Row | `explorer.tree-row` | Explorer 树行 | Explorer 文件树 | `apps/desktop/src/renderer/src/explorer/ExplorerTree.tsx` | 文件或目录的可选择行。 |
| Directory Disclosure Button | `explorer.directory-disclosure-button` | 目录展开按钮 | Explorer 文件树 | `apps/desktop/src/renderer/src/explorer/ExplorerTree.tsx` | 展开或折叠目录。 |
| Explorer Inline Name Field | `explorer.inline-name-field` | Explorer 内联命名框 | Explorer 文件树 | `apps/desktop/src/renderer/src/explorer/ExplorerTree.tsx` | 新建或重命名时的内联输入行。 |
| Explorer Context Menu | `explorer.context-menu` | Explorer 右键菜单 | Explorer 文件树 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 文件和目录的上下文操作菜单。 |
| Explorer Context Menu Item | `explorer.context-menu-item` | Explorer 右键菜单项 | Explorer 右键菜单 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 复制、粘贴、重命名、隐藏和删除等菜单项。 |
| Delete Confirmation Popover | `explorer.delete-confirmation-popover` | 删除确认浮层 | Explorer 文件树 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 删除文件或目录前的确认控件。 |
| Explorer Automation Flows Panel | `explorer.automation-flows-panel` | Explorer 自动化流程面板 | Explorer 底部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 当前工作区自动化流程和执行器的管理区域。 |
| Add Automation Executor Button | `explorer.add-automation-executor-button` | 新增自动化执行器按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 为工作区或全局自动化流程新增 Markdown executor。 |
| Add Automation Flow Button | `explorer.add-automation-flow-button` | 新增自动化流程按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 新建工作区自动化流程 Markdown。 |
| Apply Global Flow Button | `explorer.apply-global-flow-button` | 应用全局流程按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 将全局自动化流程应用到当前工作区。 |
| Delete Automation Flow Button | `explorer.delete-automation-flow-button` | 删除自动化流程按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 删除工作区或全局自动化流程及其 Markdown executor 目录。 |
| Refresh Automation Skills Button | `explorer.refresh-automation-skills-button` | 刷新自动化 Skills 按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 手动刷新 Skill catalog 并重新加载自动化流程投影。 |
| Rename Automation Flow Button | `explorer.rename-automation-flow-button` | 重命名自动化流程按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 进入自动化流程内联重命名状态。 |
| Explorer Automation Flow Row | `explorer.automation-flow-row` | Explorer 自动化流程行 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 单个工作区或全局自动化流程行。 |
| Explorer Automation Flow Menu | `explorer.automation-flow-menu` | Explorer 自动化流程菜单 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 单个自动化流程的新增执行器、跳转或移除操作。 |
| Explorer Automation Executor Row | `explorer.automation-executor-row` | Explorer 自动化执行器行 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 单个 Markdown 或 Skill 执行器行。 |
| Jump Global Automation Flow Button | `explorer.jump-global-automation-flow-button` | 跳转全局自动化流程按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 打开全局流程在 `~/.mde` 伪工作区中的 Markdown。 |
| Remove Applied Global Flow Button | `explorer.remove-applied-global-flow-button` | 移除已应用全局流程按钮 | 自动化流程面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 从当前工作区移除全局自动化流程引用。 |
| Recent Files Panel | `explorer.recent-files-panel` | 最近文件面板 | Explorer 底部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 当前工作区最近打开的文件区域。 |
| Recent File Row | `explorer.recent-file-row` | 最近文件行 | 最近文件面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 最近文件列表中的单个文件按钮。 |
| Deleted Documents Panel | `explorer.deleted-documents-panel` | 已删除文档面板 | Explorer 底部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 可恢复删除文档列表。 |
| Deleted Document Row | `explorer.deleted-document-row` | 已删除文档行 | 已删除文档面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 可恢复删除文档列表中的一行。 |
| Recent Files Resize Handle | `explorer.recent-files-resize-handle` | 最近文件高度拖拽柄 | Explorer 底部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 调整最近文件面板高度的分隔控件。 |

## Markdown 编辑器

Markdown 编辑器覆盖文件状态、编辑面、frontmatter、历史预览和链接选择器入口。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Markdown Editor Shell | `editor.markdown-editor-shell` | Markdown 编辑器外壳 | 编辑器分栏 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 当前 Markdown 文档编辑器根容器。 |
| Editor Titlebar | `editor.titlebar` | 编辑器标题栏 | Markdown 编辑器顶部 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 文件路径、保存状态和历史预览动作区域。 |
| Document Path Label | `editor.document-path-label` | 文档路径标签 | 编辑器标题栏 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 当前文档相对路径显示。 |
| Save State Indicator | `editor.save-state-indicator` | 保存状态指示器 | 编辑器标题栏 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 保存中或未保存变更状态。 |
| Editor Actions Toolbar | `editor.actions-toolbar` | 编辑器动作工具栏 | 编辑器分栏顶部 | `apps/desktop/src/renderer/src/app/App.tsx` | 视图、历史、AI 和搜索等编辑器动作按钮组。 |
| Editor Action Button | `editor.action-button` | 编辑器动作按钮 | 编辑器动作工具栏 | `apps/desktop/src/renderer/src/app/App.tsx` | 通用编辑器动作按钮类型，用于无更具体功能 ID 的按钮。 |
| Collapsed Editor Actions Menu | `editor.collapsed-actions-menu` | 折叠编辑器动作菜单 | 编辑器动作工具栏 | `apps/desktop/src/renderer/src/app/App.tsx` | 小宽度时展开或折叠溢出动作。 |
| Markdown Editing Surface | `editor.markdown-editing-surface` | Markdown 编辑面 | Markdown 编辑器正文 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | MDE 自有的 BlockNote 外层编辑容器。 |
| History Preview Banner | `editor.history-preview-banner` | 历史预览横幅 | Markdown 编辑器顶部 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 只读历史版本预览提示。 |
| Restore This Version Button | `editor.restore-this-version-button` | 恢复此版本按钮 | 编辑器标题栏 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 从历史预览恢复当前版本。 |
| Exit History Preview Button | `editor.exit-history-preview-button` | 退出历史预览按钮 | 编辑器标题栏 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 关闭只读历史预览。 |
| Frontmatter Summary | `editor.frontmatter-summary` | Frontmatter 摘要 | Markdown 编辑器正文顶部 | `apps/desktop/src/renderer/src/editor/FrontmatterPanel.tsx` | YAML frontmatter 折叠摘要按钮。 |
| Frontmatter Panel | `editor.frontmatter-panel` | Frontmatter 面板 | Markdown 编辑器正文顶部 | `apps/desktop/src/renderer/src/editor/FrontmatterPanel.tsx` | YAML frontmatter 的字段和源码编辑区域。 |
| Frontmatter Mode Button | `editor.frontmatter-mode-button` | Frontmatter 模式按钮 | Frontmatter 面板 | `apps/desktop/src/renderer/src/editor/FrontmatterPanel.tsx` | 在字段视图和源码视图之间切换。 |
| Frontmatter Raw YAML Field | `editor.frontmatter-raw-yaml-field` | Frontmatter YAML 字段 | Frontmatter 面板 | `apps/desktop/src/renderer/src/editor/FrontmatterPanel.tsx` | 原始 YAML 的只读或可编辑字段。 |
| Code Language Selector | 第三方内部（不分配） | 代码块语言选择器 | BlockNote 代码块 | `@blocknote/*` | 当前版本由 BlockNote 内部渲染，MDE 不包额外 DOM；需要定位时使用 Markdown Editing Surface 和用户语义。 |

## 搜索

搜索覆盖当前编辑器搜索、搜索历史和工作区全文搜索。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Editor Search Bar | `search.editor-search-bar` | 编辑器搜索条 | 编辑器动作工具栏 | `apps/desktop/src/renderer/src/app/App.tsx` | 当前文档搜索输入和历史浮层的外壳。 |
| Editor Search Field | `search.editor-search-field` | 编辑器搜索框 | 编辑器搜索条 | `apps/desktop/src/renderer/src/app/App.tsx` | 当前文档搜索输入框。 |
| Editor Search History List | `search.editor-search-history-list` | 编辑器搜索历史列表 | 编辑器搜索条 | `apps/desktop/src/renderer/src/app/App.tsx` | 当前文档搜索历史和 pin 关键字列表。 |
| Search History Tag | `search.search-history-tag` | 搜索历史标签 | 搜索历史列表 | `apps/desktop/src/renderer/src/app/App.tsx`、`apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 可点击复用的搜索历史词条。 |
| Pinned Search Keyword | `search.pinned-search-keyword` | Pin 搜索关键字 | 编辑器搜索历史列表 | `apps/desktop/src/renderer/src/app/App.tsx` | 固定在编辑器搜索历史顶部的关键字行。 |
| Pin Search Button | `search.pin-search-button` | Pin 搜索按钮 | 编辑器搜索历史列表 | `apps/desktop/src/renderer/src/app/App.tsx` | 固定、取消固定或删除搜索关键字。 |
| Workspace Search Dialog | `search.workspace-search-dialog` | 工作区搜索弹窗 | 主窗口覆盖层 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 工作区全文搜索弹窗。 |
| Workspace Search Field | `search.workspace-search-field` | 工作区搜索框 | 工作区搜索弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 输入工作区搜索关键字。 |
| Workspace Search History Tags | `search.workspace-search-history-tags` | 工作区搜索历史标签组 | 工作区搜索弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 工作区搜索历史标签列表。 |
| Workspace Search Result Row | `search.workspace-search-result-row` | 工作区搜索结果行 | 工作区搜索弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 搜索命中结果按钮。 |
| Search Result Snippet | `search.result-snippet` | 搜索结果片段 | 工作区搜索结果行 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 高亮显示命中内容的片段区域。 |

## 链接

链接选择器覆盖插入已有文档链接和创建新文档链接。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Link Picker Dialog | `link.picker-dialog` | 链接选择器弹窗 | Markdown 编辑器 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | Slash 命令插入链接时打开的弹窗。 |
| Link Picker Close Button | `link.picker-close-button` | 链接选择器关闭按钮 | 链接选择器弹窗 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 关闭链接选择器。 |
| Existing Link Tab | `link.existing-link-tab` | 已有链接标签 | 链接选择器弹窗 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 切换到已有文档链接模式。 |
| New Document Tab | `link.new-document-tab` | 新文档标签 | 链接选择器弹窗 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 切换到新建文档并插入链接模式。 |
| Link Target Field | `link.target-field` | 链接目标输入框 | 已有链接模式 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 输入或过滤链接目标。 |
| Link Suggestions List | `link.suggestions-list` | 链接建议列表 | 已有链接模式 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 匹配 Markdown 文件的建议列表。 |
| Link Suggestion Row | `link.suggestion-row` | 链接建议行 | 链接建议列表 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 单个可插入的链接建议。 |
| Link Directory Tree | `link.directory-tree` | 链接目录树 | 新文档模式 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 选择新文档所在目录。 |
| Link Directory Row | `link.directory-row` | 链接目录行 | 链接目录树 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 目录树中的可选择目录。 |
| New Document Name Field | `link.new-document-name-field` | 新文档名称输入框 | 新文档模式 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 输入新建 Markdown 文档名。 |
| Create And Insert Button | `link.create-and-insert-button` | 创建并插入按钮 | 新文档模式 | `apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx` | 创建新文档并插入链接。 |

## Mermaid 流程图

Mermaid 流程图覆盖缩略预览、错误状态和可缩放预览弹窗。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Flowchart Preview Card | `flowchart.preview-card` | 流程图预览卡片 | Markdown 编辑器正文 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 单个 Mermaid 图表预览容器。 |
| Flowchart Preview Button | `flowchart.preview-button` | 流程图预览按钮 | 流程图预览卡片 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 点击打开大图预览。 |
| Flowchart Error State | `flowchart.error-state` | 流程图错误状态 | 流程图预览卡片 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | Mermaid 渲染错误显示区。 |
| Flowchart Preview Dialog | `flowchart.preview-dialog` | 流程图预览弹窗 | 主窗口覆盖层 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 可缩放、可拖拽的流程图预览弹窗。 |
| Flowchart Dialog Toolbar | `flowchart.dialog-toolbar` | 流程图弹窗工具栏 | 流程图预览弹窗 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 缩放、重置、布局切换和关闭按钮组。 |
| Flowchart Viewport | `flowchart.viewport` | 流程图视口 | 流程图预览弹窗 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 承载可拖拽缩放 SVG 的视口。 |
| Zoom In Button | `flowchart.zoom-in-button` | 放大按钮 | 流程图弹窗工具栏 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 放大流程图预览。 |
| Zoom Out Button | `flowchart.zoom-out-button` | 缩小按钮 | 流程图弹窗工具栏 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 缩小流程图预览。 |
| Reset View Button | `flowchart.reset-view-button` | 重置视图按钮 | 流程图弹窗工具栏 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 重置缩放和平移。 |
| Preview Layout Toggle | `flowchart.preview-layout-toggle` | 预览布局切换按钮 | 流程图弹窗工具栏 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 在居中弹窗和全页预览之间切换。 |
| Close Flowchart Preview Button | `flowchart.close-flowchart-preview-button` | 关闭流程图预览按钮 | 流程图弹窗工具栏 | `apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx` | 关闭流程图预览弹窗。 |

## AI

AI 区域覆盖编辑器动作按钮、翻译菜单、只读结果面板和摘要 refinement。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AI Summary Button | `ai.summary-button` | AI 摘要按钮 | 编辑器动作工具栏 | `apps/desktop/src/renderer/src/ai/AiActionMenu.tsx` | 对当前 Markdown 生成摘要。 |
| AI Translate Menu | `ai.translate-menu` | AI 翻译菜单 | 编辑器动作工具栏 | `apps/desktop/src/renderer/src/ai/AiActionMenu.tsx` | 展示默认和自定义翻译语言。 |
| Translation Language Menu Item | `ai.translation-language-menu-item` | 翻译语言菜单项 | AI 翻译菜单 | `apps/desktop/src/renderer/src/ai/AiActionMenu.tsx` | 触发某个语言的翻译。 |
| Custom Translation Language Field | `ai.custom-translation-language-field` | 自定义翻译语言输入框 | AI 翻译菜单 | `apps/desktop/src/renderer/src/ai/AiActionMenu.tsx` | 输入新的翻译目标语言。 |
| AI Result Panel | `ai.result-panel` | AI 结果面板 | 编辑器分栏 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 展示 AI 摘要或翻译结果的只读面板。 |
| AI Result Header | `ai.result-header` | AI 结果头部 | AI 结果面板 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 结果标题、来源和关闭按钮区域。 |
| AI Result Close Button | `ai.result-close-button` | AI 结果关闭按钮 | AI 结果头部 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 关闭当前 AI 结果。 |
| AI Result Path Label | `ai.result-path-label` | AI 结果路径标签 | AI 结果面板 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 显示生成结果保存路径。 |
| Refine Summary Bar | `ai.refine-summary-bar` | 摘要细化输入条 | AI 结果面板 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 给摘要追加 refine 指令的表单。 |
| Refine Summary Field | `ai.refine-summary-field` | 摘要细化输入框 | 摘要细化输入条 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 输入摘要 refine 指令。 |
| Regenerate Summary Button | `ai.regenerate-summary-button` | 重新生成摘要按钮 | 摘要细化输入条 | `apps/desktop/src/renderer/src/ai/AiResultPanel.tsx` | 使用 refine 指令重新生成摘要。 |

## Agent Chat

Agent Chat 区域覆盖编辑器入口、右侧会话面板、上下文预览、消息列表、附件和变更文件摘要。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Agent Chat Action Button | `agent-chat.action-button` | Agent Chat 入口按钮 | 编辑器动作工具栏 | `apps/desktop/src/renderer/src/app/App.tsx` | 在 Codex sustained protocol 可用时打开右侧 Agent Chat 面板。 |
| Agent Chat Attach Image Button | `agent-chat.attach-image-button` | Agent Chat 添加图片按钮 | Agent Chat 输入区 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 通过键盘或鼠标打开图片选择器。 |
| Agent Chat Attachment Chip | `agent-chat.attachment-chip` | Agent Chat 附件标签 | Agent Chat 输入区 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 显示已缓存的图片附件并支持移除。 |
| Agent Chat Attachment Remove Button | `agent-chat.attachment-remove-button` | Agent Chat 移除附件按钮 | Agent Chat 附件标签 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 移除单个已缓存图片附件。 |
| Agent Chat Changed File Row | `agent-chat.changed-file-row` | Agent Chat 变更文件行 | Agent Chat 变更文件摘要 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 表示一次 turn 后的单个新增、修改或删除文件。 |
| Agent Chat Changed Files | `agent-chat.changed-files` | Agent Chat 变更文件摘要 | Agent Chat 面板 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 展示一次 Agent turn 后检测到的工作区文件变更。 |
| Agent Chat Close Button | `agent-chat.close-button` | Agent Chat 关闭按钮 | Agent Chat 面板标题栏 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 关闭右侧 Agent Chat 面板。 |
| Agent Chat Composer | `agent-chat.composer` | Agent Chat 输入区 | Agent Chat 面板底部 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 输入消息、粘贴图片并发送到当前会话。 |
| Agent Chat Context Document Toggle | `agent-chat.context-document-toggle` | Agent Chat 当前文档开关 | Agent Chat 上下文预览 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 控制当前 Markdown 文档是否随消息发送。 |
| Agent Chat Context Preview | `agent-chat.context-preview` | Agent Chat 上下文预览 | Agent Chat 面板 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 显示当前文档、权限模式和选区摘要。 |
| Agent Chat Context Selection Pin Button | `agent-chat.context-selection-pin-button` | Agent Chat 固定选区按钮 | Agent Chat 上下文预览 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 固定当前编辑器选区，供后续消息继续引用。 |
| Agent Chat Context Selection Toggle | `agent-chat.context-selection-toggle` | Agent Chat 选区开关 | Agent Chat 上下文预览 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 控制当前或固定选区是否随消息发送。 |
| Agent Chat Message Box | `agent-chat.message-box` | Agent Chat 消息框 | Agent Chat 输入区 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 容纳消息输入框、图片按钮和发送/停止主按钮。 |
| Agent Chat Message Field | `agent-chat.message-field` | Agent Chat 消息输入框 | Agent Chat 输入区 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 输入发送给当前会话的消息。 |
| Agent Chat Message Item | `agent-chat.message-item` | Agent Chat 消息项 | Agent Chat 消息列表 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 显示一条用户或助手消息。 |
| Agent Chat Message List | `agent-chat.message-list` | Agent Chat 消息列表 | Agent Chat 面板 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 展示用户和助手消息。 |
| Agent Chat New Session Button | `agent-chat.new-session-button` | Agent Chat 新建会话按钮 | Agent Chat 会话栏 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 创建新的 MDE draft 会话。 |
| Agent Chat Panel | `agent-chat.panel` | Agent Chat 面板 | 编辑器右侧 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | Codex Agent Chat 的右侧面板容器。 |
| Agent Chat Pinned Selection Remove Button | `agent-chat.pinned-selection-remove-button` | Agent Chat 移除固定选区按钮 | Agent Chat 上下文预览 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 清除已固定的编辑器选区。 |
| Agent Chat Resize Handle | `agent-chat.resize-handle` | Agent Chat 宽度调整柄 | 编辑器与 Agent Chat 面板之间 | `apps/desktop/src/renderer/src/app/App.tsx` | 通过拖拽或键盘调整右侧 Agent Chat 面板宽度。 |
| Agent Chat Send Button | `agent-chat.send-button` | Agent Chat 发送/停止按钮 | Agent Chat 消息框 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 空闲时发送当前输入和附件，发送中请求停止当前会话。 |
| Agent Chat Session Picker | `agent-chat.session-picker` | Agent Chat 会话选择器 | Agent Chat 会话栏 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 在当前工作区的 Agent Chat 会话之间切换。 |
| Agent Chat Thinking Status | `agent-chat.thinking-status` | Agent Chat 思考状态 | Agent Chat 面板 | `apps/desktop/src/renderer/src/agentChat/AgentChatPanel.tsx` | 显示当前会话正在等待 Agent 响应。 |

## 设置和更新

设置和更新覆盖左侧入口、设置弹窗、主题、语言、AI CLI 和更新动作。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Settings Button | `settings.button` | 设置按钮 | Explorer 底部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 打开设置弹窗的图标按钮。 |
| Theme Selector Button | `settings.theme-selector-button` | 主题选择按钮 | Explorer 底部 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 打开主题设置并显示当前主题。 |
| Settings Dialog | `settings.dialog` | 设置弹窗 | 主窗口覆盖层 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | AI、语言、主题和更新设置入口。 |
| Settings Nav | `settings.nav` | 设置导航 | 设置弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 设置弹窗左侧导航。 |
| Settings Nav Item | `settings.nav-item` | 设置导航项 | 设置导航 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 设置面板切换按钮。 |
| Settings Panel | `settings.panel` | 设置内容面板 | 设置弹窗 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 当前设置分类的内容区域。 |
| AI CLI Selector | `settings.ai-cli-selector` | AI CLI 选择器 | AI 设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 选择用于 AI 操作的 CLI。 |
| Default Model Field | `settings.default-model-field` | 默认模型输入框 | AI 设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 配置当前 AI CLI 的默认模型。 |
| Language Selector | `settings.language-selector` | 应用语言选择器 | 偏好设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 切换应用语言包。 |
| Custom Language Pack Field | `settings.custom-language-pack-field` | 自定义语言包输入框 | 偏好设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 输入要生成的自定义应用语言。 |
| Generate Language Pack Button | `settings.generate-language-pack-button` | 生成语言包按钮 | 偏好设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 调用 AI 生成应用语言包。 |
| Theme Mode Toggle | `settings.theme-mode-toggle` | 主题模式开关 | 主题设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 切换跟随系统外观。 |
| Theme Colorway Group | `settings.theme-colorway-group` | 主题色组 | 主题设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 主题色板 radio group。 |
| Theme Colorway Option | `settings.theme-colorway-option` | 主题色选项 | 主题色组 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 单个可选主题。 |
| Check Updates Button | `settings.check-updates-button` | 检查更新按钮 | 更新设置面板 | `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` | 手动检查新版本。 |
| Update Dialog | `updates.dialog` | 更新弹窗 | 主窗口覆盖层 | `apps/desktop/src/renderer/src/app/UpdateDialog.tsx` | 展示可用更新、下载进度和安装动作。 |
| Download And Install Button | `updates.download-and-install-button` | 下载并安装按钮 | 更新弹窗 | `apps/desktop/src/renderer/src/app/UpdateDialog.tsx` | macOS 下载并打开安装包。 |
| Restart To Update Button | `updates.restart-to-update-button` | 重启更新按钮 | 更新弹窗 | `apps/desktop/src/renderer/src/app/UpdateDialog.tsx` | Windows 更新就绪后重启安装。 |

## 通用控件类型

这些名称用于描述控件形态，不直接指代单个产品功能；具体功能按钮仍使用上面各区域的 concrete `Component ID`。

| Standard Name | Component ID | 中文名 | 位置 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Icon Button | 命名规则（不进入 concrete mapping） | 图标按钮 | 全局 | 多处 | 只有图标或以图标为主的按钮形态。 |
| Primary Button | 命名规则（不进入 concrete mapping） | 主按钮 | 全局 | 多处 | 当前上下文中的主要动作按钮。 |
| Secondary Button | 命名规则（不进入 concrete mapping） | 次按钮 | 全局 | 多处 | 当前上下文中的次要动作按钮。 |
| Danger Button | 命名规则（不进入 concrete mapping） | 危险按钮 | 全局 | 多处 | 删除、移除等破坏性动作按钮。 |
| Toggle Button | 命名规则（不进入 concrete mapping） | 切换按钮 | 全局 | 多处 | 表示开关或 pressed 状态的按钮。 |
| Disclosure Button | 命名规则（不进入 concrete mapping） | 展开按钮 | 全局 | 多处 | 展开或折叠内容的按钮形态。 |
| Close Button | 命名规则（不进入 concrete mapping） | 关闭按钮 | 全局 | 多处 | 关闭弹窗、面板或结果的按钮形态。 |
| Text Field | 命名规则（不进入 concrete mapping） | 文本输入框 | 全局 | 多处 | 普通文本输入控件形态。 |
| Search Field | 命名规则（不进入 concrete mapping） | 搜索输入框 | 全局 | 多处 | 用于过滤或搜索的输入控件形态。 |
| Select Field | 命名规则（不进入 concrete mapping） | 下拉选择框 | 全局 | 多处 | 选择一个离散选项的控件形态。 |
| Segmented Tab | 命名规则（不进入 concrete mapping） | 分段标签 | 全局 | 多处 | 小范围模式切换的标签按钮形态。 |
| Status Message | 命名规则（不进入 concrete mapping） | 状态消息 | 全局 | 多处 | 非错误的即时状态反馈。 |
| Error Message | 命名规则（不进入 concrete mapping） | 错误消息 | 全局 | 多处 | 用户可见错误反馈。 |
| Spinner | 命名规则（不进入 concrete mapping） | 加载指示器 | 全局 | 多处 | 进行中状态的旋转图标。 |
| Popover | 命名规则（不进入 concrete mapping） | 浮层 | 全局 | 多处 | 贴近触发点的临时内容。 |
| Context Menu | 命名规则（不进入 concrete mapping） | 上下文菜单 | 全局 | 多处 | 右键或更多操作菜单形态。 |
| List Row | 命名规则（不进入 concrete mapping） | 列表行 | 全局 | 多处 | 列表中的单行项目形态。 |
| Tree Row | 命名规则（不进入 concrete mapping） | 树行 | 全局 | 多处 | 树结构中的单行项目形态。 |
