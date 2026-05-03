# YAML Frontmatter 面板轻量化优化

## Status

- 2026-05-03: Development started. Scope is to make the existing frontmatter panel lighter in collapsed, fields, source, and invalid YAML states while preserving raw YAML round trips.
- 2026-05-03: Completed and released in `v1.4.4`.
- 2026-05-03: Follow-up alignment fix released in `v1.4.5`; the collapsed summary text now aligns with the Markdown editor body text while the chevron stays in the left gutter.
- Completion summary: The YAML frontmatter panel now uses a lightweight collapsed metadata row, aligns with the editor body, offers a structured Fields view plus raw Source editing, defaults invalid YAML to source/warning mode, and preserves raw frontmatter round trips.
- Verification notes: Local `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run docs:build`, `npm run build`, and `npm audit --audit-level=high` passed. Release workflow `25270773056` passed. User Manual deploy workflow `25270773078` passed. GitHub Release `v1.4.4` published with 12 artifacts.

## 背景

MDE 已经支持把文件开头的 YAML frontmatter 从正文中拆出，并在编辑器正文上方用独立面板展示。当前实现解决了 frontmatter 被当成 Markdown 正文渲染的问题，但面板视觉上仍然偏重：

* 折叠态显示 `Frontmatter 2 fields` 这类系统标签，信息价值有限。
* 长字段摘要容易和正文争夺第一屏注意力。
* 展开态偏像一个单独的 metadata 卡片或代码块，而不是编辑器 header 下方的辅助信息。

这会让 frontmatter 继续抢占正文标题和 `Overview` 的阅读节奏。

## 目标

把 frontmatter 面板优化成更轻量的编辑器辅助信息：

* 默认折叠态只展示内容缩略文本，不展示 `Frontmatter 2 fields`。
* 展开态用轻量 key/value 字段视图展示 metadata。
* `Source` 作为单一切换入口，用于查看或编辑原始 YAML。
* 无效 YAML 时进入 source/warning 状态，保证原文不丢失。
* 面板整体视觉权重低于正文标题和正文内容。

设计原型：

* `docs/superpowers/prototypes/frontmatter-panel-design-concepts.html`

## UI 要求

### 折叠态

折叠态只显示内容缩略文本，不显示通用标签和字段数量。

推荐形式：

```text
› name: auto-pick-tasks, description: …
```

要求：

* 使用单行展示。
* 长内容必须省略，不能撑宽布局或换行挤压正文。
* 字号、颜色、间距应接近文件路径下方的辅助信息，而不是正文块。
* 点击整行可展开。

### 展开字段态

展开后显示结构化字段：

```text
⌄ name: auto-pick-tasks, description: …

name          auto-pick-tasks
description   Use when Codex should continuously pick READY task documents...

Source
```

要求：

* 展开态仍保留顶部内容缩略，帮助用户确认当前 metadata。
* 字段名使用低权重 monospace 或 muted 样式。
* 字段值使用小字号正文样式，可换行。
* 不使用厚重背景、卡片嵌套或强强调按钮。
* `Source` 是唯一操作入口，不再同时显示 `Edit fields` 和 `View YAML`。

### Source 态

点击 `Source` 后切换为原始 YAML 视图：

```text
⌄ name: auto-pick-tasks, description: …

YAML source                         Fields
name: auto-pick-tasks
description: Use when Codex should...
```

要求：

* `Fields` 用于返回结构化字段态。
* YAML 内容使用 monospace。
* Source 态可以复用现有 raw YAML 编辑能力，但视觉上仍应保持轻量。
* 如果进入编辑模式，保存和取消行为必须沿用现有 frontmatter 保存语义。

### 无效 YAML 态

当 frontmatter 包裹存在但 YAML 解析失败：

* 默认展开为 source 视图。
* 显示原始 YAML。
* 显示 warning：`Frontmatter parse failed; raw YAML will be preserved.`
* 保存正文时必须原样保留 raw YAML，除非用户主动修改 source。

## 行为要求

* 只在文档存在开头 YAML frontmatter 时显示该区域。
* frontmatter 不进入 BlockNote 正文 blocks。
* 折叠/展开/source 状态不能影响正文 Markdown 序列化。
* 未编辑 frontmatter 时，保存正文必须原样保留 raw YAML，包括顺序、注释、缩进和换行。
* 编辑 source 后，保存用户输入的 raw YAML。
* 删除 source 内容时，沿用现有逻辑移除 frontmatter 包裹。
* 所有用户可见文本必须来自语言包和 i18n helper，不能在组件中硬编码。

## 非目标

* 不实现复杂 YAML 表单编辑器。
* 不自动格式化 YAML。
* 不新增 AI 改写 metadata 入口。
* 不改变 workspace search、AI 摘要/翻译或 frontmatter split/compose 的既有语义。

## 验收标准

* 打开带 frontmatter 的 Markdown 文件时，折叠态只显示内容缩略文本。
* 折叠态不出现 `Frontmatter 2 fields` 或类似系统标签。
* 点击折叠行后显示轻量 key/value 字段视图。
* 展开字段态提供单一 `Source` 切换入口。
* `Source` 态显示 raw YAML，并能切回 `Fields`。
* invalid YAML 显示 warning 和 raw YAML，不丢失正文和 metadata。
* 第一屏能同时看到文档标题和至少一段正文内容，frontmatter 不抢主视觉。
* 保存正文后，未编辑的 frontmatter 保持原样。
* 编辑 source 后，磁盘文件反映新的 raw YAML。

## 测试要求

### Unit Tests

* `FrontmatterPanel` 折叠态渲染内容缩略文本。
* `FrontmatterPanel` 折叠态不渲染字段数量标签。
* 展开态渲染 key/value 字段和 `Source`。
* Source 态渲染 raw YAML 和 `Fields`。
* invalid YAML 态渲染 warning 和 raw YAML。

### Integration Tests

* 打开带 frontmatter 的文档后，BlockNote 正文仍从正文内容开始。
* 保存正文时，未编辑 frontmatter 被无损拼回文件头。
* 编辑 source 后保存，文件头部 YAML 更新。

### E2E Tests

* 打开 `skills/auto-pick-tasks/SKILL.md` 这类带 frontmatter 的文档。
* 验证折叠态只显示 metadata 内容缩略。
* 展开字段态、Source 态、invalid YAML 态均可见且布局不遮挡正文标题。
* 编辑 source 并保存后，重新打开文档仍保留更新后的 frontmatter。

## 验证命令

实现完成后至少运行：

* `npm run lint`
* `npm run test:unit`
* `npm run test:integration`
* `npm run test:e2e`
