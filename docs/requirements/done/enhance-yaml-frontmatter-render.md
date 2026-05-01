# YAML Frontmatter Render 增强 - DONE

## Status

* Released in `v1.3.10`.
* Completed YAML frontmatter parsing at the editor boundary so BlockNote receives only Markdown body content.
* Added a compact, expandable metadata panel with raw YAML editing, invalid YAML warnings, and lossless recomposition on save.
* Workspace search now labels frontmatter matches as metadata, and AI summary/translation flows default to body-only Markdown.
* Verification completed: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e`.

## 开发状态

* 2026-05-01: 已按 auto-pick-tasks 选中，开始分析 frontmatter 拆分/保存数据流、轻量 metadata UI、UT/IT/E2E 覆盖和发布验证。

## 背景

在 `skills/auto-pick-tasks/SKILL.md` 中，文件开头包含标准 YAML frontmatter：

```yaml
---
name: auto-pick-tasks
description: Use when Codex should continuously pick READY task documents from docs/bugs or docs/requirements, implement one task at a time, release completed production work, and move released task docs to done.
---
```

当前编辑器渲染效果有明显问题：frontmatter 被当成正文内容渲染，并且视觉权重接近大标题。截图里第一屏最醒目的是 `name: auto-pick-tasks description: ...` 这段 metadata，而真正的文档标题 `Auto Pick Tasks` 被挤到后面。

这会让用户误以为 frontmatter 是正文标题，也会破坏文档阅读节奏。

## 目标

MDE 应该把文件开头的 YAML frontmatter 当成文档 metadata，而不是正文 Markdown。

目标效果：

* 正文的第一个标题仍然是文档主要标题。

* YAML frontmatter 以低视觉权重展示在正文上方。

* frontmatter 内容必须可读、可复制、可编辑，并在保存时无损保留。

* 无效 YAML 也不能丢失，不能因为解析失败导致文档内容损坏。

## 推荐 UI

### 默认显示

在编辑器正文上方、文档标题区域下方显示一个 `Frontmatter` 面板。

默认状态建议为折叠或轻量摘要，不占据正文主视觉：

```text
Frontmatter  2 fields     name: auto-pick-tasks   description: Use when...
```

视觉要求：

* 高度紧凑，不超过 1-2 行。

* 字号小于正文标题，不能使用 H1/H2 样式。

* 使用中性背景、细边框、轻量 metadata 样式。

* 长字段值必须截断或换行限制，不能把第一屏撑满。

* 默认不应该抢走 `# Auto Pick Tasks` 的视觉焦点。

### 展开状态

用户点击 `Frontmatter` 面板后展开。

展开后推荐两种视图：

* 结构化视图：按 key/value 展示，适合快速扫描。

```text
name          auto-pick-tasks
description   Use when Codex should continuously pick READY task documents...
```

* Raw YAML 视图：用 monospace 展示原始 YAML，适合复制和编辑。

v1 可以优先做 Raw YAML 视图，因为它最容易保证无损保存。结构化视图可以作为后续增强。

### 编辑状态

v1 推荐使用原始 YAML 编辑：

* 展开面板后提供 `编辑` 操作。

* 编辑区域使用 monospace、多行输入，保留缩进和换行。

* 保存文档时，把编辑后的 frontmatter 重新拼回 Markdown 文件头部。

* 取消编辑时恢复到进入编辑前的 frontmatter 内容。

不建议 v1 做复杂的 key/value 表单编辑，因为 YAML 支持数组、对象、多行字符串和复杂缩进，表单化容易丢信息。

### 空状态

没有 frontmatter 的文档，不显示 metadata 面板。

不要为了功能存在感给所有 Markdown 文件加一个空面板。用户只有在文档真的有 frontmatter 时才需要看到它。

### 无效 YAML 状态

如果文件开头符合 frontmatter 包裹格式，但 YAML 内容无法解析：

* 仍然显示 Frontmatter 面板。

* 面板进入 warning 状态，提示 `Frontmatter 解析失败，将按原文保留`。

* 展开后显示 raw YAML。

* 保存正文时必须原样保留这段 frontmatter，除非用户主动编辑它。

## 行为要求

### 识别规则

只识别文档开头的 frontmatter：

* 文件起始位置是 `---` 独占一行。

* 之后存在另一个 `---` 独占一行作为结束标记。

* 两个标记之间的内容视为 YAML frontmatter。

* 正文中的 `---` 仍然按普通 Markdown 分隔线处理。

实现时应兼容文件开头的 BOM 和常见换行符。

### 编辑器数据流

frontmatter 不应该进入 BlockNote 正文 blocks。

推荐数据流：

1. 读取 Markdown 文件。
2. 拆分为 `frontmatter` 和 `bodyMarkdown`。
3. 只把 `bodyMarkdown` 交给 BlockNote 解析和渲染。
4. 在 `MarkdownBlockEditor` 外层渲染 `FrontmatterPanel`。
5. 保存时先序列化正文，再把 frontmatter 拼回文件开头。

这样可以避免 frontmatter 被 BlockNote 误判为标题、段落或分隔线，也能避免 BlockNote 的 Markdown round-trip 改写 YAML。

### 保存策略

* 如果用户没有编辑 frontmatter，保存正文时必须原样保留 frontmatter，包括字段顺序、注释、缩进和换行。

* 如果用户编辑了 frontmatter，保存用户编辑后的 raw YAML。

* 如果用户删除了 frontmatter 内容，保存后文件不再包含 frontmatter 包裹。

* 保存时不能自动格式化 YAML，除非后续单独设计格式化能力。

### 搜索和 AI

v1 建议：

* 文档正文搜索默认不匹配 frontmatter。

* workspace 全局搜索可以匹配 frontmatter，但搜索结果需要标注这是 metadata 命中。

* AI 摘要、翻译、润色默认只处理正文，不处理 frontmatter。

* 如果后续需要 AI 改写 metadata，必须单独提供明确入口。

## 设计要求

开发这个 UI 前必须使用 `huashu-design` skill。

需要设计的界面：

* 折叠态 Frontmatter 摘要面板。

* 展开态 raw YAML 面板。

* 编辑态 raw YAML 输入区。

* 无效 YAML warning 状态。

* 长 description、多字段、多行 YAML 的显示效果。

设计原则：

* frontmatter 是 metadata，不是正文主角。

* 默认显示要轻，不要干扰阅读。

* 展开后要适合编辑，不要做成装饰性卡片。

* 必须匹配当前 MDE 编辑器的桌面工具气质。

## 测试要求

Unit tests：

* 识别文件开头的 YAML frontmatter。

* 不把正文中的 `---` 识别为 frontmatter。

* 拆分 frontmatter 和正文。

* 没编辑 frontmatter 时保存能原样拼回。

* 编辑 frontmatter 后保存新内容。

* 删除 frontmatter 后保存为无 frontmatter 文件。

* 无效 YAML 不丢失。

Integration tests：

* 打开带 frontmatter 的 Markdown 文件时，BlockNote 正文从真正的正文开始。

* 保存正文修改后，frontmatter 保持在文件开头。

* invalid frontmatter 显示 warning，但正文仍可编辑保存。

E2E tests：

* 打开 `skills/auto-pick-tasks/SKILL.md`，第一屏不再把 `name/description` 渲染成大标题。

* 页面主标题仍然是 `Auto Pick Tasks`。

* 用户可以展开 Frontmatter 面板查看 raw YAML。

* 编辑正文并保存后，文件头部 YAML frontmatter 仍然存在。

* 编辑 frontmatter 并保存后，磁盘文件反映修改。

## 验收标准

* YAML frontmatter 不再作为正文大字号内容渲染。

* 带 frontmatter 的文档打开后，正文阅读体验正常。

* frontmatter 默认以轻量 metadata 面板展示。

* frontmatter 可展开查看和编辑。

* 保存正文不会破坏 frontmatter。

* 无效 YAML 不会导致内容丢失。

* 所有用户可见文案来自语言包，并通过 i18n helper 获取。

* 发布前通过 `npm run lint`、`npm run typecheck`、`npm run test:unit`、`npm run test:integration`、`npm run test:e2e`。

## v1 非目标

* 完整 YAML schema 校验。

* 自动格式化 YAML。

* 复杂 key/value 表单编辑器。

* AI 自动改写 frontmatter。
