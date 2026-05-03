# 全局搜索最近搜索列表 - READY

## Status

* 2026-05-03: Auto-pick started. Autonomy gate passed: the required behavior, UI constraints, i18n requirement, test plan, and referenced prototype are present in this document and can be implemented from existing global-search code and tests without external credentials or human input.
* Released in `v1.4.14`.
* Completed the workspace search history tag layout with a 16-entry cap, type-to-filter behavior, hidden empty-match state, and focus-preserving tag clicks.
* Added global search result preview keyword highlighting and removed the platform-native blue clear control from both workspace search and current-editor search fields.
* Updated the Chinese user manual search guide and refreshed screenshots through the E2E screenshot workflow.
* Verification completed: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, `npm run docs:screenshots`, `npm run docs:build`, pre-push verification, Release workflow `25282501006`, and User Manual workflow `25282501003`.

## 背景

当前全局搜索弹层中的最近搜索记录使用简单纵向列表展示。列表项只有关键词文本，单条记录占一整行，导致 Spotlight 式弹层的横向空间没有被充分利用。记录数量增加后，用户需要更多垂直滚动和视觉扫描成本。

现状截图：

![image.png](.mde/assets/image-1777804483537-88fc326c.png)

![image.png](.mde/assets/image-1777804463954-63e8defe.png)

## 目标

按照原型中的 B 方案，把全局搜索最近搜索记录改为 tag 模式：

* 提高最近搜索记录的信息密度和扫描效率。

* 保持当前 Spotlight 式全局搜索弹层，不重做搜索入口、搜索结果列表和弹层主体结构。

* 最近搜索最多展示和保存 16 条。

* 空输入状态和输入中状态都能展示对应的最近搜索 tag。

原型：`docs/superpowers/prototypes/global-search-history-layout.html`

## 交互规则

### 空输入状态

* 打开全局搜索弹层且搜索框为空时，在输入框下方展示最近搜索 tag 区域。

* tag 区域标题为最近搜索，右侧显示最多 16 条。

* 最近搜索 tag 使用可换行布局，最多展示 16 个搜索记录。

* 下方结果区域继续显示现有说明文案：搜索当前工作区中的 Markdown 文件。

### 输入中状态

* 用户输入搜索词后，最近搜索 tag 区域仍保留在输入框下方。

* tag 列表只展示匹配当前输入的最近搜索记录，匹配规则沿用现有搜索历史过滤逻辑。

* 如果没有匹配的最近搜索记录，不展示空的 tag 区域，避免占用结果空间。

* 搜索结果区域继续展示加载、无结果、错误或结果列表等现有状态。

### 点击 tag

* 点击 tag 后，将 tag 文本填入全局搜索输入框。

* 点击 tag 后立即执行工作区搜索。

* 点击 tag 不改变搜索结果打开逻辑；用户点击搜索结果后仍打开对应文件，并在编辑器中高亮搜索词。

* 点击 tag 后应保持输入框焦点，方便用户继续编辑搜索词。

## 视觉要求

* 使用现有全局搜索弹层宽度规则：`min(720px, calc(100vw - 48px))`。

* 保留现有弹层顶部偏移、遮罩、边框、圆角和阴影。

* tag 样式沿用现有 `panel` 主题变量，不新增强装饰、大卡片或新的主色。

* tag 需要支持 hover、focus-visible 和 active 状态。

* tag 文本过长时应单行省略，不能撑破弹层宽度。

* 在窄屏下 tag 自动换行，弹层不能出现横向滚动。

## 实现约束

* 最近搜索历史数据结构保持为字符串数组。

* 将最近搜索保存和展示上限调整为 16。

* 不改变全局搜索快捷键、入口按钮、搜索执行 API、结果排序或结果打开行为。

* 所有新增用户可见文案必须进入 app language pack，通过 i18n helper 读取。

* 生产代码不硬编码中文或英文 UI 文案。

## 验收标准

* 空输入打开全局搜索时，能看到最多 16 个最近搜索 tag。

* 输入搜索词时，只展示匹配当前输入的最近搜索 tag。

* 无匹配历史时，不显示空的最近搜索 tag 区域。

* 点击最近搜索 tag 后，输入框填入该搜索词并执行工作区搜索。

* 点击搜索结果后，仍能打开对应 Markdown 文件并保留编辑器搜索高亮。

* 最近搜索历史去重、大小写过滤、空白裁剪逻辑保持现有行为。

* 亮色和暗色主题下 tag 文本、边框、hover/focus 状态可读。

* 桌面宽度和窄屏宽度下都没有文字重叠、横向溢出或弹层宽度异常。

## 测试计划

* Unit：覆盖最近搜索历史上限从 16 条截断、去重、过滤和空白裁剪。

* Integration：覆盖全局搜索弹层中最近搜索 tag 的空输入、输入中过滤、无匹配隐藏和点击 tag 执行搜索。

* E2E：覆盖打开工作区、打开全局搜索、查看 tag 历史、点击 tag 搜索、打开结果并在编辑器中高亮。

* Manual/visual：用 Playwright 截图检查实际弹层宽度、16 个 tag 换行、亮色/暗色主题和窄屏布局。

## 非目标

* 不重做全局搜索结果列表。

* 不改变搜索范围、搜索算法或匹配预览生成逻辑。

* 不引入搜索历史分组、置顶、删除单条历史或清空历史功能。

* 不改变当前文档搜索的历史列表样式。
