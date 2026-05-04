# Internal Component Naming Reference - DONE

## Status

* 2026-05-04: Auto-pick started. Autonomy gate passed: the requirement defines the target manual page, ID format, mapping file, concrete component scope, test coverage, and no-release rule clearly enough to complete from repository context without external input.
* 2026-05-04: Completed. Added the internal Chinese component naming reference, the renderer `componentIds.ts` mapping, production `data-component-id` bindings for the listed concrete components, and unit/integration/E2E coverage that keeps the manual, mapping, and renderer source in sync. No product release was created because this is an internal metadata and documentation requirement with no user-visible behavior change.
* 2026-05-04: Verification passed: `npm run typecheck`; `npm run lint`; `npx vitest run --project unit tests/unit/componentIds.test.ts tests/unit/AiActionMenu.test.tsx tests/unit/ExplorerTree.test.tsx --testTimeout=30000`; `npx vitest run --project integration tests/integration/componentNames.integration.test.ts --testTimeout=30000`; `npx playwright test tests/e2e/markdown-editor.e2e.test.ts -g "exposes internal component ids on key app regions"`; `npm run test:unit`; `npm run test:integration`; `npm run docs:build`; the Playwright functional portion of `npm run test:e2e` passed all 46 `tests/e2e/markdown-editor.e2e.test.ts` tests.
* 2026-05-04: Verification caveat: the trailing editor performance smoke step in `npm run test:e2e` failed under current machine load. The same `node scripts/run-editor-performance-e2e.mjs smoke` command also failed in a temporary clean worktree at current `HEAD` without this requirement's changes, with the same open-editor budget stages over limit, so the failure was classified as an existing/environmental performance gate issue rather than a regression from this task.

## 背景

MDE 的界面已经包含工作区管理、Explorer、Markdown 编辑器、当前文档搜索、工作区搜索、链接选择器、Mermaid 预览、AI 结果面板、设置和更新等多个区域。开发、测试、设计评审和用户手册截图维护时，经常需要描述同一个界面部件；如果每个人使用不同叫法，沟通、测试用例命名和后续文档维护都会变得不稳定。

这个需求为整个项目建立一份内部使用的界面组件标准命名参考。命名范围应覆盖从全局布局区域到按钮级控件的主要用户界面部件，但文档目标是内部协作，不是普通用户教程。

## 目标

* 为 MDE 现有界面组件建立统一标准名，最小粒度覆盖到常用按钮、菜单项、标签、输入框和面板。
* 标准名服务内部开发、测试、设计评审、E2E 截图维护和需求沟通。
* 将命名参考放在用户手册源码中的合适位置，便于和截图、手册页面一起维护。
* 在手册首页提供轻量入口，但不把它放进普通用户的推荐阅读路径。
* 让后续测试用例、截图说明、需求文档和代码评审可以引用同一套组件名。
* 为每个标准组件提供稳定 `data-component-id`，并把命名表和实际组件代码关联起来。

## 非目标

* 不重命名 React 组件、CSS class、test id、i18n key 或 IPC channel。
* 不改变任何生产 UI、交互、文案或布局；新增 `data-component-id` 只能作为稳定元数据属性。
* 不为每个 DOM 节点建立设计系统级 token。
* 不把内部术语包装成普通用户必须阅读的教程。
* 不新增或更新手册截图，除非后续实现改成带视觉标注的形式。

## 文档位置

新增内部参考页：

* `user-manual/zh-CN/component-names.md`

更新中文手册首页：

* `user-manual/zh-CN/index.md`

首页入口应放在推荐阅读路径之后或页面底部，使用类似“内部协作参考”的小节。这个入口应明显弱于普通用户阅读路径，避免用户误以为这是使用 MDE 的必要步骤。

`user-manual/.vitepress/config.ts` 不需要默认把该页面加入侧边栏。除非后续确认内部参考页应长期公开出现在导航中，否则保持它只能从首页底部入口或直接链接访问。

## 命名格式

每个组件条目应至少包含：

| 字段 | 要求 |
| --- | --- |
| Standard Name | 英文 Pascal Case 或清晰短语，作为内部标准引用名 |
| Component ID | 对应代码中的 `data-component-id` 值 |
| 中文名 | 中文协作叫法，便于中文需求和评审使用 |
| 位置 | 所属界面区域或页面 |
| 代码位置 | 渲染该组件的主要文件或组件名 |
| 说明 | 组件用途、边界和必要备注 |

标准名应稳定、短、可搜索。优先命名用户能看到或测试会定位的界面部件，而不是内部实现细节。

## Component ID 要求

每个列入命名表的标准组件都必须在实际渲染代码中带有 `data-component-id`。该属性用于把内部命名表、E2E 截图、测试定位、设计评审和代码实现关联起来。

ID 格式：

* 使用小写 kebab-case，按界面区域加命名空间，例如 `explorer.new-markdown-file-button`、`editor.markdown-editing-surface`、`ai.result-panel`。
* 命名空间应优先使用产品区域：`app`、`workspace`、`explorer`、`editor`、`search`、`link`、`flowchart`、`ai`、`settings`、`updates`。
* ID 应表达组件类型或功能，不包含用户文件名、绝对路径、语言文案、状态值、随机数或索引。
* ID 是组件类型标识，不要求每个 DOM 实例全局唯一。列表行、树节点和菜单项等重复组件可以共享同一个 `data-component-id`。
* 重复组件如需区分实例，应继续优先使用可访问名称、现有 test id、相对路径等已有测试定位方式；只有确有必要时才新增额外属性，且不得包含个人路径或敏感数据。

代码要求：

* 组件代码中必须显式写入 `data-component-id`，例如 `<button data-component-id="explorer.new-markdown-file-button" ...>`。
* 如果同一语义组件被拆成多个 React 组件，应在最接近用户可交互或可见边界的元素上放置 `data-component-id`。
* 对按钮、菜单项、输入框、tab、dialog、panel、toolbar、tree row 和 list row，应优先把 `data-component-id` 放在语义 HTML 元素或带 role 的容器上。
* 不应为了加 ID 包一层无语义 DOM。
* `data-component-id` 不替代 `aria-label`、可访问名称、i18n 文案或现有 `data-testid`。测试可以引用它，但无障碍语义仍以 ARIA 和可见文案为准。
* 必须建立组件名称和 ID 的常量映射文件：`src/renderer/src/componentIds.ts`。渲染代码应从该文件引用 ID，不应在 JSX 中分散手写 `data-component-id` 字符串。

文档要求：

* `user-manual/zh-CN/component-names.md` 的每一行都必须写明 `Component ID`。
* `Component ID` 必须能在源码中搜索到对应 `data-component-id`。
* 对形态类通用控件，例如 `Icon Button`、`Primary Button`，如果它们不是单一 DOM 组件，应说明它们是命名规则，不要求单独存在一个通用 `data-component-id`；具体功能按钮仍必须有自己的 ID。

## Component Name ID Mapping

`src/renderer/src/componentIds.ts` 是组件名称和 `data-component-id` 的代码级来源。它应导出一个只读对象映射，至少包含每个 concrete component 的标准名和组件 ID。不要使用数组作为主映射结构。

推荐结构：

```ts
export const COMPONENT_NAME_ID_MAP = {
  appShell: {
    componentId: "app.shell",
    standardName: "App Shell",
  },
  explorerNewMarkdownFileButton: {
    componentId: "explorer.new-markdown-file-button",
    standardName: "New Markdown File Button",
  },
} as const;
```

对象 key 应使用稳定 camelCase 代码名，表达同一个 concrete component，例如 `appShell`、`explorerNewMarkdownFileButton`。实现可以在此基础上派生便于 JSX 使用的常量对象，例如 `COMPONENT_IDS.explorer.newMarkdownFileButton`。无论最终导出形状如何，都必须满足：

* `standardName` 与 `user-manual/zh-CN/component-names.md` 中的 `Standard Name` 一致。
* `componentId` 与手册中的 `Component ID` 以及渲染代码中的 `data-component-id` 一致。
* 主映射必须是对象，不得是数组；测试如需遍历可以使用 `Object.values(COMPONENT_NAME_ID_MAP)`。
* `COMPONENT_NAME_ID_MAP` 的顶层对象 key 必须按字母升序排序。
* concrete component ID 在映射中唯一。
* concrete standard name 在映射中唯一。
* 新增、重命名或删除 concrete component 时，同步更新映射文件、组件命名表和相关测试。
* 通用控件形态如果只作为命名规则而不是 concrete component，不进入 concrete mapping，或必须用明确字段标记为非 concrete，避免被一致性测试误判为缺失源码绑定。

## 命名原则

* 使用产品语义命名，不直接照搬 CSS class 或文件名。
* 组件名描述职责边界，例如 `Workspace Manager Dialog`、`Explorer Toolbar`、`Editor Action Button`。
* 同类控件使用统一后缀：
  * `Pane`：主界面分栏。
  * `Dialog`：模态弹窗。
  * `Panel`：页面内面板。
  * `Toolbar`：一组工具按钮。
  * `Button`：单一按钮。
  * `Menu` / `Menu Item`：菜单和菜单项。
  * `Tab`：模式切换标签。
  * `Field`：输入控件。
  * `Row`：列表或树中的一行。
  * `Card`：可独立预览或承载结果的小型内容块。
* 按钮级组件应区分通用按钮形态和具体功能按钮，例如 `Icon Button` 是形态，`New Markdown File Button` 是功能。
* 同一个组件在不同场景复用时，应记录主标准名，避免产生多个近义名。
* 不为仅用于布局的无语义 wrapper 单独命名，除非它是测试、截图或设计评审的稳定参照。
* 标准名、中文名和 `data-component-id` 应形成稳定三元组：文档中改名时必须同步评估 ID 是否仍准确；仅修正文案不应随意改 ID。

## 组件范围

### 全局框架

应覆盖：

* `App Shell`
* `Explorer Pane`
* `Editor Pane`
* `Explorer Resize Handle`
* `Drop Target Overlay`
* `Empty Editor State`

### 工作区管理

应覆盖：

* `Workspace Manager Trigger`
* `Workspace Manager Dialog`
* `Open Workspace Action`
* `Open Markdown File Action`
* `Recent Resource List`
* `Recent Resource Row`
* `Recent Resource Search Field`
* `Open Resource In New Window Button`
* `Forget Recent Resource Button`

### Explorer

应覆盖：

* `Explorer Header`
* `Explorer Toolbar`
* `Workspace Search Button`
* `New Markdown File Button`
* `New Folder Button`
* `Recover Deleted Documents Button`
* `Show Hidden Entries Button`
* `Refresh Explorer Button`
* `Explorer Tree`
* `Explorer Tree Row`
* `Directory Disclosure Button`
* `Explorer Inline Name Field`
* `Explorer Context Menu`
* `Explorer Context Menu Item`
* `Delete Confirmation Popover`
* `Recent Files Panel`
* `Recent File Row`
* `Deleted Documents Panel`
* `Deleted Document Row`
* `Recent Files Resize Handle`

### Markdown 编辑器

应覆盖：

* `Markdown Editor Shell`
* `Editor Titlebar`
* `Document Path Label`
* `Save State Indicator`
* `Editor Actions Toolbar`
* `Editor Action Button`
* `Collapsed Editor Actions Menu`
* `Markdown Editing Surface`
* `History Preview Banner`
* `Restore This Version Button`
* `Exit History Preview Button`
* `Frontmatter Summary`
* `Frontmatter Panel`
* `Frontmatter Mode Button`
* `Frontmatter Raw YAML Field`
* `Code Language Selector`

### 搜索

应覆盖：

* `Editor Search Bar`
* `Editor Search Field`
* `Editor Search History List`
* `Search History Tag`
* `Pinned Search Keyword`
* `Pin Search Button`
* `Workspace Search Dialog`
* `Workspace Search Field`
* `Workspace Search History Tags`
* `Workspace Search Result Row`
* `Search Result Snippet`

### 链接

应覆盖：

* `Link Picker Dialog`
* `Link Picker Close Button`
* `Existing Link Tab`
* `New Document Tab`
* `Link Target Field`
* `Link Suggestions List`
* `Link Suggestion Row`
* `Link Directory Tree`
* `Link Directory Row`
* `New Document Name Field`
* `Create And Insert Button`

### Mermaid 流程图

应覆盖：

* `Flowchart Preview Card`
* `Flowchart Preview Button`
* `Flowchart Error State`
* `Flowchart Preview Dialog`
* `Flowchart Dialog Toolbar`
* `Flowchart Viewport`
* `Zoom In Button`
* `Zoom Out Button`
* `Reset View Button`
* `Preview Layout Toggle`
* `Close Flowchart Preview Button`

### AI

应覆盖：

* `AI Summary Button`
* `AI Translate Menu`
* `Translation Language Menu Item`
* `Custom Translation Language Field`
* `AI Result Panel`
* `AI Result Header`
* `AI Result Close Button`
* `AI Result Path Label`
* `Refine Summary Bar`
* `Refine Summary Field`
* `Regenerate Summary Button`

### 设置和更新

应覆盖：

* `Settings Button`
* `Theme Selector Button`
* `Settings Dialog`
* `Settings Nav`
* `Settings Nav Item`
* `Settings Panel`
* `AI CLI Selector`
* `Default Model Field`
* `Language Selector`
* `Custom Language Pack Field`
* `Generate Language Pack Button`
* `Theme Mode Toggle`
* `Theme Colorway Group`
* `Theme Colorway Option`
* `Check Updates Button`
* `Update Dialog`
* `Download And Install Button`
* `Restart To Update Button`

### 通用控件类型

应覆盖并说明何时使用：

* `Icon Button`
* `Primary Button`
* `Secondary Button`
* `Danger Button`
* `Toggle Button`
* `Disclosure Button`
* `Close Button`
* `Text Field`
* `Search Field`
* `Select Field`
* `Segmented Tab`
* `Status Message`
* `Error Message`
* `Spinner`
* `Popover`
* `Context Menu`
* `List Row`
* `Tree Row`

## 内容要求

* 文档语言以中文为主，标准名保留英文，便于测试和代码评审引用。
* 每个区域开头应说明该区域的组件边界。
* 对于已有截图覆盖的区域，可以在备注中写明对应手册页面或截图文件名，但不需要重新生成截图。
* 如果某个组件名来自当前实现但后续可能拆分，应在说明中标记“当前版本”。
* 如果某个控件是形态名而不是具体功能名，应在说明中明确“用于命名规则，不直接指代单个产品功能”。
* 不写用户操作教程，不重复已有用户手册说明。

## 实现要求

* 为命名表覆盖的现有组件补充 `data-component-id`。
* 新增 `src/renderer/src/componentIds.ts`，集中维护 `standardName` 和 `componentId` 的映射。
* JSX 中的 `data-component-id` 应引用 `componentIds.ts` 导出的常量，而不是重复写裸字符串。
* 优先从当前源码中的主要渲染点补充：
  * `src/renderer/src/app/App.tsx`
  * `src/renderer/src/explorer/ExplorerPane.tsx`
  * `src/renderer/src/explorer/ExplorerTree.tsx`
  * `src/renderer/src/editor/MarkdownBlockEditor.tsx`
  * `src/renderer/src/editor/FrontmatterPanel.tsx`
  * `src/renderer/src/editor/MermaidFlowchartPanel.tsx`
  * `src/renderer/src/ai/AiActionMenu.tsx`
  * `src/renderer/src/ai/AiResultPanel.tsx`
  * `src/renderer/src/app/UpdateDialog.tsx`
* 对于 BlockNote 或第三方库内部生成、无法直接控制的 DOM，不要求给第三方内部节点加 ID；应在 MDE 自己拥有的外层容器或操作入口上加 ID。
* 新增属性不得改变 CSS 选择器优先级、布局、交互状态、可访问名称或用户可见文案。
* 新增属性不应包含个人路径、工作区路径、文件名、AI 内容、搜索关键字或其他运行时用户数据。

## 测试要求

### Unit tests

* `componentIds.ts` 应覆盖命名表列出的 concrete component IDs。
* 验证 `componentIds.ts` 中的 `componentId` 唯一、符合命名格式，并且不为空。
* 验证 `componentIds.ts` 中的 `standardName` 唯一，并且不为空。
* 验证 `COMPONENT_NAME_ID_MAP` 顶层对象 key 按字母升序排序。
* 渲染层单元测试应抽样验证关键按钮和面板带有预期 `data-component-id`，至少覆盖 Explorer、编辑器、搜索、链接、AI 和设置区域。

### Integration tests

* 文档一致性测试应读取 `user-manual/zh-CN/component-names.md` 中的 `Standard Name` 和 `Component ID`，并验证它们存在于 `componentIds.ts` 的 mapping 中。
* 源码一致性测试应验证每个 concrete ID 能在 `src/renderer/src/` 源码中找到对应 `data-component-id` 常量引用。
* 如果通用控件类型被标记为命名规则而不是 concrete component，应在文档中显式标记，并从 concrete ID 一致性校验中排除。

### E2E tests

* 现有 E2E 不需要全部改用 `data-component-id`。
* 至少增加或更新一个轻量 E2E 断言，验证主窗口关键区域和一个按钮能通过 `data-component-id` 定位，例如 `app.shell`、`explorer.pane`、`editor.pane`、`explorer.new-markdown-file-button`。
* E2E 仍应优先保留面向用户语义的 role/name 断言；`data-component-id` 用于内部结构关联和截图维护，不取代无障碍测试。

## 验收标准

* 新增 `user-manual/zh-CN/component-names.md`，覆盖本需求列出的主要组件区域和按钮级控件。
* `user-manual/zh-CN/index.md` 增加内部协作参考入口，且不影响推荐阅读路径。
* 命名表中的每个 concrete component 都包含 `Component ID`。
* 新增 `src/renderer/src/componentIds.ts`，并包含 concrete component 的 `standardName` 和 `componentId` 映射。
* `COMPONENT_NAME_ID_MAP` 顶层对象 key 按字母升序排列。
* 对应组件代码包含匹配的 `data-component-id`。
* 组件代码通过 `componentIds.ts` 常量设置 `data-component-id`，不分散手写裸 ID 字符串。
* 不修改生产语言包、截图或既有测试选择器；新增 `data-component-id` 不改变用户可见行为。
* 命名表中的标准名在同一文档内不重复、不互相冲突。
* concrete `data-component-id` 在命名表中不重复、不冲突，并符合命名格式。
* 文档可以通过 `npm run docs:build` 构建。
* `npm run lint`、`npm run typecheck`、`npm run test:unit`、`npm run test:integration`、`npm run test:e2e` 在实现完成前通过。

## 发布和文档

* 这是内部文档需求，完成后不需要创建产品 release，除非同一批变更还包含用户可见产品行为。
* 完成后在本文档补充 `Status`，记录完成摘要和验证命令，并移动到 `docs/requirements/done/`。
* 如果后续决定该内部参考不应随公开手册发布，需要另立需求把它迁移到内部 docs 区域或调整 VitePress 发布范围。
