# 优化 MDE editor render 的样式 - DONE

## Status

* 2026-05-02: Completed and released in `v1.3.16`.
* Completion summary: Markdown editor rendering now uses compact document typography for headings, body text, lists, blockquotes, dividers, inline code, and code blocks. Browser spellcheck is disabled for the editor body, idle BlockNote side-menu affordances are visually reduced, read-only previews hide side-menu affordances, and user manual screenshots were refreshed with stable workspace labels.
* Verification: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run docs:screenshots`, `npm run docs:build`, `npx npm@10.9.7 ci --dry-run`, and `npm audit`.
* Release verification: GitHub Release `v1.3.16` succeeded with macOS and Windows artifacts. The Deploy User Manual workflow built the Pages artifact but still cannot deploy until a repository administrator enables GitHub Pages with GitHub Actions as the source.

## 开发状态

* 2026-05-02: 已按 `auto-pick-tasks` 选中，开始分析 BlockNote editor surface、现有样式覆盖、read-only preview、搜索高亮和相关 UT/E2E 覆盖。

## 背景

MDE 的核心定位是面向真实本地 Markdown workspace 的编辑器和 AI Agent 工作台。用户会长期维护 requirements、bugs、specs、release notes、用户手册和技术文档，因此编辑器不能只像一个块编辑画布，也需要在日常阅读、审阅和维护文档时足够清晰、稳定、可扫描。

当前 MDE 已经具备 BlockNote 编辑、YAML frontmatter 独立渲染、Mermaid、搜索、AI 摘要/翻译和文档历史。下一步需要优化的是 Markdown 正文在编辑器里的视觉呈现，让它更接近成熟 Markdown preview 的阅读体验，同时保留块编辑能力。

## 对比贴图

### VS Code Markdown Extension

![VS Code Markdown Extension render](.mde/assets/image-1777694296515-282efa7d.png)

### MDE 当前效果

![MDE current editor render](.mde/assets/image-1777694318508-3932f15c.png)

## 观察结论

第一张图的 VS Code Markdown 预览更像一个文档阅读视图。它的标题层级、段落行高、分隔线、引用块和列表密度都比较克制，用户可以快速扫到文档结构和下一段内容。

第二张图的 MDE 当前效果更像一个正在编辑的 Notion/BlockNote 画布。它能编辑，但阅读密度偏低：H1 过大，段落和标题间距偏松，第一屏被少量内容占满；块编辑的 `+` 和拖拽手柄在正文旁边形成视觉噪音；引用块和列表的层级不够像 Markdown 文档；中英文混排的技术词还出现拼写波浪线，影响文档审阅。

这不是要把 MDE 做成只读 preview，而是要让默认编辑状态也更像“可编辑的 Markdown 文档”，而不是“放大的块笔记页”。

## 目标

* 提升 Markdown 文档在 MDE 中的阅读密度，让第一屏能展示更多有效结构。

* 建立更清晰的标题、正文、引用、列表、代码和分隔线层级。

* 降低块编辑 affordance 对阅读的干扰，只在需要编辑时出现。

* 保持 BlockNote 编辑、autosave、frontmatter、Mermaid、搜索高亮、文档历史预览和 AI 结果预览的现有行为。

* 所有新增用户可见文案都必须来自 app language packs，并通过 i18n text helper 访问。

## 非目标

* 不更换 BlockNote，不重做编辑器底层。

* 不新增完整的 Markdown preview pane。

* 不新增实时所见即源码编辑器。

* 不改变 Markdown 读写、frontmatter 拆分、Mermaid 保存和图片 asset 路径转换规则。

* 不改变当前 centered/full-width editor view 的用户入口；本需求只优化两种布局里的正文渲染。

## 推荐方向

### 1. 做一次文档排版密度校准

优先通过 `src/renderer/src/styles/theme.css` 中 `.markdown-editor-surface` 和 `.markdown-editor-surface .bn-editor` 作用域下的 CSS 覆盖完成，避免改动编辑器数据流。

建议目标：

* 正文字号控制在 `16px-17px`，行高控制在 `1.6-1.7`。

* H1 在桌面端控制在 `40px-46px`，移动端不超过 `34px`。

* H2 控制在 `26px-30px`，H3 控制在 `21px-24px`。

* H1/H2 使用更紧的行高和更克制的上下 margin，减少第一屏被标题吃掉的问题。

* 段落、列表、引用块之间保持稳定垂直节奏，不让每个 block 都像独立卡片。

* 不使用 viewport-width 驱动字体大小，避免超宽屏下字号继续放大。

### 2. 强化 Markdown 文档层级

VS Code 预览里，标题下方的细分隔线让文档结构更容易扫读。MDE 可以在保留简洁风格的前提下补上类似层级线索。

建议：

* H1 下方增加轻量分隔线，颜色使用 `var(--editor-border)` 或其弱化版本。

* H2 可使用更短或更浅的下边框，避免所有标题都像 H1。

* H3 及以下只通过字号、字重和间距表达层级，不加重边框。

* 段落正文不应被标题字号压得太弱；标题大但不能像封面页。

### 3. 优化引用块和列表

当前 MDE 中引用块更像 BlockNote block，而不是 Markdown blockquote。面向 requirements、specs 和设计文档时，引用常用于表达原则、假设、结论或重点，需要更像文档语义。

建议：

* Blockquote 使用 `3px-4px` 左边框，配合非常浅的背景或仅左边框。

* 引用块正文保持接近正文的字号，不要自动变成大号弱灰文字。

* 引用块内段落上下间距收紧，避免一句话占很高。

* 有序/无序列表缩进保持清晰，但不要过深。

* 列表项之间默认使用小间距；只有列表中包含多段内容时才自然拉开。

### 4. 降低块编辑控件的常驻存在感

MDE 当前贴图里，正文左侧的 `+` 和拖拽手柄在阅读过程中会抢注意力。它们是编辑 affordance，不应该成为文档渲染的一部分。

建议：

* 普通 idle 状态下隐藏或接近透明。

* 鼠标 hover 到当前 block、键盘焦点进入当前 block、或用户选中 block 时再显示。

* read-only 历史预览、AI 结果预览中完全隐藏编辑手柄。

* 控件出现时不改变正文布局宽度，避免 hover 造成文字抖动。

### 5. 控制编辑器 chrome 对正文的干扰

文档正文应该是视觉主角。顶部 editor action bar、titlebar、保存状态和历史预览提示需要保留，但不能压迫第一屏阅读。

建议：

* `markdown-editor-titlebar` 保持紧凑，不增加新说明性文字。

* action bar 继续使用图标按钮，保持透明背景和较小宽度。

* centered view 继续作为默认阅读友好的视图；full-width view 适合宽表格、Mermaid、长代码和图片，但正文段落仍应避免过长行宽。

* 历史 read-only preview 复用同一套正文排版，但隐藏编辑 affordance。

### 6. 处理技术文档中的拼写波浪线

贴图里 `frontmatter` 出现红色拼写波浪线。MDE 的主要用户会频繁写 Markdown、frontmatter、workspace、Codex、Claude Code、release notes 等技术词。持续出现拼写波浪线会降低文档审阅质量。

建议 v1 采用保守策略：

* Markdown 编辑正文默认关闭浏览器拼写检查，或至少在代码、链接、frontmatter、Mermaid、技术词密集区域关闭。

* 如果后续要提供 spellcheck 设置，所有设置项文案必须走 i18n。

* 不在 v1 做自定义技术词词典。

## 视觉规格建议

这些数值不是像素级设计稿，但可以作为实现时的 guardrail：

| 元素 | 建议 |
| --- | --- |
| 正文段落 | `16px-17px`, line-height `1.6-1.7`, margin `0.45em-0.7em` |
| H1 | `40px-46px`, line-height `1.12-1.18`, 下方轻分隔线 |
| H2 | `26px-30px`, line-height `1.2-1.25`, 可选轻分隔线 |
| H3 | `21px-24px`, line-height `1.25-1.3`, 无分隔线 |
| Blockquote | 左边框 `3px-4px`, 轻背景或透明背景，正文接近普通段落 |
| 列表 | 清晰缩进，列表项默认小间距，嵌套层级可辨认 |
| Inline code | monospace, 轻背景, 小圆角, 不改变行高太多 |
| Code block | monospace, 稳定 padding, 横向 overflow, 与正文宽度对齐 |
| 编辑手柄 | idle 隐藏或弱化，hover/focus 显示，read-only 隐藏 |

## 实现边界

推荐第一版尽量做成 CSS-only 或接近 CSS-only 的改动：

* 调整 `src/renderer/src/styles/theme.css` 中 editor render 相关样式。

* 优先使用 `.markdown-editor-surface` 作用域，避免影响 settings、explorer、AI panel 和 dialog。

* 如果必须覆盖 BlockNote 内部 DOM class，需要用 E2E 锁定关键渲染效果，降低后续 BlockNote 升级风险。

* 如果需要新增 `spellCheck={false}` 或 read-only class，这部分改动限定在 `MarkdownBlockEditor`。

* 不新增硬编码用户文案。

* 不触碰 Markdown serialization、frontmatter compose/split、Mermaid transform、image asset transform。

## 测试要求

这是生产 UI 改动，仍然需要按项目要求补齐自动化覆盖。

### Unit

如果实现只改 CSS，unit test 可以不新增，但需要在交付说明中明确“无新增运行时逻辑”。如果实现新增 class、prop、spellcheck 开关或 view-mode 逻辑，则需要更新 `tests/unit/MarkdownBlockEditor.test.tsx`，覆盖：

* 编辑器 surface 带有预期 class 或 prop。

* read-only/history preview 不暴露编辑能力。

* 新增用户可见文案从 `appLanguage` 获取。

### Integration

如果实现引入新的状态或模式，需要补 integration test，确保：

* 切换 centered/full-width 不破坏正文 surface。

* frontmatter、Mermaid 面板和正文渲染仍保持原有顺序。

* 搜索高亮仍只作用于正文 surface，并能滚动到当前匹配。

### E2E

更新 `tests/e2e/markdown-editor.e2e.test.ts` 或新增用例，覆盖：

* 打开包含 H1/H2/H3、段落、列表、引用、inline code、code block、Mermaid 和 frontmatter 的 fixture 文档。

* 在桌面视口下读取关键 computed style，验证 H1、H2、正文和引用块不再使用过大的默认 BlockNote 视觉。

* 在 normal editor、full-width editor 和 read-only history preview 中验证正文可见且布局不溢出。

* 验证编辑手柄不会在 read-only preview 中出现；普通编辑态下 hover/focus 仍可操作。

* 验证中英文混排文档不会因为样式调整出现按钮、标题或正文重叠。

## 验收标准

* 第一屏能同时展示文档标题、metadata/frontmatter 区域以及至少一个正文小节，而不是被超大标题和松散 block 间距占满。

* H1、H2、H3、正文、列表和引用的层级一眼可辨，接近 Markdown 文档阅读体验。

* BlockNote 的编辑手柄不再成为 idle 阅读状态的视觉焦点。

* 文档历史 read-only preview 和 AI read-only result 也使用优化后的正文排版。

* Frontmatter 面板仍保持低视觉权重，不重新抢回第一屏焦点。

* Mermaid、图片、链接、搜索高亮、autosave 和保存后的 Markdown 内容不发生回归。

* `npm run lint`、unit、integration、E2E 的相关用例通过。
