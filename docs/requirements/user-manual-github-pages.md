# 用户手册与 GitHub Pages 发布 - BLOCKED

## Status

* 2026-05-02: Implementation shipped in `v1.3.15`. The release includes the VitePress user manual, generated screenshots, GitHub Pages workflow, README guidance, release workflow updates, and package lockfile synchronization for GitHub Actions.
* Verification completed for the shipped code: `npm run docs:screenshots`, `npm run docs:build`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npx npm@10.9.7 ci --dry-run`, and `npm audit`.
* GitHub Release `v1.3.15` succeeded and uploaded macOS and Windows artifacts.
* The Deploy User Manual workflow currently builds and uploads the Pages artifact, then fails at deployment with `HttpError: Not Found` because GitHub Pages is not enabled for `flowforever/mde`. The current `gh` token only has `READ` permission on the repository, so Pages cannot be enabled from this session.
* This requirement remains active until a repository administrator enables GitHub Pages with GitHub Actions as the source and reruns the Deploy User Manual workflow successfully.

## 开发状态

* 2026-05-02: 已按 `auto-pick-tasks` 选中，开始分析用户手册源码、截图生成、VitePress/GitHub Pages 发布、release skill 和 AGENTS 维护规则的实现范围。

## 背景

MDE 目前已经具备 Markdown 编辑、工作区管理、Recent Files、当前文档搜索、工作区全局搜索、内部/外部链接、Mermaid flowchart、AI Summary/Translation、多主题、i18n、自定义语言包、检查更新、多窗口等用户能力。

这些能力散落在需求文档、发布说明和界面文案中，但没有一份面向最终用户的使用手册。新用户无法从一个稳定入口了解：

* 如何打开工作区或单个 Markdown 文件。

* 如何创建、编辑、搜索、链接和管理 Markdown 文档。

* AI、主题、语言、更新等设置在哪里配置。

* 生成的摘要、翻译、图片和后续 sidecar 数据会保存到哪里。

同时，MDE 的 `docs/` 目录已经用于需求、bug、开发计划和内部工程记录，不适合作为完整公开用户手册的发布根目录。

## 目标

为 MDE 产出第一版用户手册，并建立可持续维护的用户文档发布流程。

目标效果：

* 根目录新增 `user-manual/`，作为用户手册源码和站点配置目录。

* 第一版用户手册覆盖当前已发布的主要用户功能。

* 手册包含真实应用截图，截图必须通过 E2E 自动化流程生成，不能依赖手工截图。

* 用户手册可以构建为静态站点，并通过 GitHub Pages 发布。

* 发布新版本时，用户手册更新成为 release checklist 的一部分。

* `AGENTS.md` 明确用户手册维护规则，避免后续功能发布时遗漏文档。

## 非目标

* 不在 v1 手册里重写开发者文档、需求文档、bug 归档或内部实现说明。

* 不把 `docs/requirements/`、`docs/bugs/`、`docs/superpowers/` 发布到 GitHub Pages。

* 不在 v1 里实现复杂的在线文档搜索、评论、用户反馈或多版本文档切换。

* 不要求第一版手册覆盖未来未发布功能，例如文档版本历史或 CLI chat panel。

## 目录结构

推荐在仓库根目录新增：

```text
user-manual/
  index.md
  zh-CN/
    index.md
    quick-start.md
    workspace.md
    editor.md
    search.md
    links.md
    ai.md
    settings.md
    troubleshooting.md
  public/
    screenshots/
      zh-CN/
  .vitepress/
    config.ts
```

说明：

* `user-manual/` 是公开用户手册，不放内部需求或开发记录。

* `docs/` 继续作为内部工程文档目录。

* v1 优先完成中文手册；英文目录可以先有入口和占位策略，但不能发布空洞内容。

* 截图放在 `user-manual/public/screenshots/`，由 E2E 流程生成并提交到仓库。

## 第一版手册内容

### 快速开始

说明用户第一次打开 MDE 后的基本路径：

* 打开文件夹工作区。

* 打开单个 Markdown 文件。

* 使用最近工作区和最近文件。

* 在已有窗口和新窗口中打开资源。

* 拖拽文件或文件夹到 MDE。

### 工作区与文件管理

覆盖左侧 Explorer 的主要操作：

* 创建 Markdown 文件。

* 创建文件夹。

* 刷新工作区。

* 展开和折叠目录。

* 显示或隐藏隐藏文件。

* 右键菜单中的重命名、删除、新建文件、新建文件夹。

* 删除确认行为。

* Recent Files 的用途和数量限制。

### 编辑 Markdown

覆盖当前编辑器能力：

* 打开 Markdown 文档并编辑。

* 自动保存行为。

* 未保存状态提示。

* 居中视图和全宽视图切换。

* Markdown round-trip 的已知限制。

* 粘贴图片后图片资源的保存位置。

* Mermaid flowchart 的显示方式和渲染失败状态。

如果 YAML frontmatter 渲染增强已经在实现本需求前发布，手册需要加入 frontmatter 章节；否则只在 Troubleshooting 或限制说明中解释当前行为。

### 搜索

覆盖两个搜索入口：

* 当前文档搜索：入口按钮、快捷键、匹配高亮、回车切换匹配项。

* 工作区全局搜索：入口按钮、快捷键、结果列表、点击结果后打开文件并定位高亮。

需要明确搜索范围是 Markdown 文件和当前工作区内容。

### 链接

覆盖 editor link 行为：

* `/` 菜单中的 Link 命令。

* 搜索已有 Markdown 文件并插入相对链接。

* 从链接弹窗创建新 Markdown 文档。

* 同工作区 Markdown 链接在当前窗口打开。

* 已知其他工作区内的 Markdown 链接在新窗口打开。

* HTTP/HTTPS 外部链接通过系统默认浏览器打开。

* 出于安全原因不支持 `javascript:` 链接。

### AI Summary 和 Translation

覆盖当前 AI 功能：

* 需要本机安装 Codex 或 Claude Code CLI。

* AI CLI 不可用时为什么看不到或不能使用 AI 功能。

* Summary 的入口、结果面板、只读状态和再生成输入。

* Translation 的入口、内置语言、自定义语言、删除自定义语言。

* 生成结果保存到 `.mde/translations/`。

* 原文未变化时复用已缓存结果。

* 设置页中 AI CLI 和默认 model name 的配置方式。

### 设置

覆盖 Settings 内的主要 section：

* Preference：应用语言切换、自定义语言包生成。

* Theme：跟随系统、light/dark 主题选择、主题色系。

* AI：选择本地 AI CLI 和默认模型。

* Check Update：查看当前版本、检查 GitHub release 更新、更新失败提示。

### 常见问题

至少覆盖：

* 为什么 AI 功能不可用。

* 为什么某些 Markdown 内容保存后格式有变化。

* 为什么搜索不到内容。

* 为什么链接没有打开目标文档。

* 为什么更新检查失败。

* 生成的摘要、翻译和图片在哪里。

## 截图要求

用户手册必须包含真实应用截图。截图必须由 E2E 自动化生成，保证可重复、可更新。

推荐新增专用截图流程：

```text
tests/e2e/manualScreenshots.spec.ts
```

推荐新增 npm scripts：

```json
{
  "docs:screenshots": "playwright test tests/e2e/manualScreenshots.spec.ts",
  "docs:dev": "vitepress dev user-manual",
  "docs:build": "vitepress build user-manual",
  "docs:preview": "vitepress preview user-manual"
}
```

截图流程要求：

* 使用固定测试 workspace fixture，内容覆盖普通 Markdown、链接、Mermaid、搜索命中和 AI 结果展示所需文档。

* 固定窗口尺寸、语言、主题和系统外观，避免截图在不同机器上漂移。

* 截图前等待编辑器、文件树、弹窗、搜索结果和 Mermaid 渲染稳定。

* 截图输出到 `user-manual/public/screenshots/zh-CN/`。

* 截图文件名稳定，例如 `quick-start-open-workspace.png`、`editor-search.png`、`insert-link.png`、`settings-theme.png`。

* 截图不应包含用户本机绝对路径、真实个人文件名、token、账号信息或其它敏感信息。

* AI 相关截图应使用可控 mock 或 fixture 状态，不依赖真实外部 AI CLI 调用。

* 截图 E2E 可以只负责生成文档资产；关键用户行为仍需要保留普通 E2E 断言测试。

首批截图建议：

* 空状态和打开工作区入口。

* Workspace manager 和 recent resources。

* Explorer 文件树和右键菜单。

* Markdown 编辑器打开文档后的主界面。

* 当前文档搜索。

* 工作区全局搜索。

* Link 弹窗和新建文档流程。

* Mermaid flowchart 展示。

* AI Summary 或 Translation 结果面板。

* Settings 的 Preference、Theme、AI、Check Update。

## GitHub Pages 发布

用户手册应通过 GitHub Actions 构建并发布到 GitHub Pages。

推荐新增 workflow：

```text
.github/workflows/deploy-user-manual.yml
```

触发条件：

* `user-manual/**` 变化。

* 截图 E2E 或 docs 构建配置变化。

* 手动 `workflow_dispatch`。

构建要求：

* 使用项目现有 Node/npm 工具链。

* 执行 `npm ci`。

* 执行 `npm run docs:build`。

* 使用 GitHub Pages artifact 发布 `user-manual/.vitepress/dist`。

* 不发布 `docs/requirements`、`docs/bugs` 或其它内部文档目录。

README 需要加入用户手册链接。App 内 Help 入口可以作为后续需求，但本需求需要预留稳定 Pages URL 作为未来入口。

## Release Skill 更新

更新 `skills/release-new-version/SKILL.md`，把用户手册纳入发布流程。

要求：

* 修正 skill frontmatter 为标准 YAML：

```yaml
---
name: release-new-version
description: Use when preparing, tagging, pushing, or verifying a new MDE release version, including version calculation, release notes, annotated tags, GitHub Actions release checks, and user manual updates.
---
```

* 在 Preflight 中检查本次 release 是否有用户可见行为变化。

* 在 Workflow 中，在准备 release notes 和创建 tag 之前更新 `user-manual/`，或明确说明本次 release 无用户手册影响。

* 在 Release Notes 中加入 Documentation 或 User Manual 说明。

* 当 `user-manual/` 或 docs site 配置变化时，运行 `npm run docs:build`。

* 推送后检查用户手册 Pages workflow 状态，例如 `gh run list --workflow "Deploy User Manual" --limit 5`。

* 安全规则中明确：不要在用户手册未更新或未说明无影响时创建 release tag。

## AGENTS.md 更新

更新根目录 `AGENTS.md`，新增用户手册维护规则。

建议新增章节：

```md
## User Manual

User-facing feature and bug-fix changes must update `user-manual/` in the same change when behavior, UI flows, settings, AI actions, search, links, workspace handling, update behavior, or troubleshooting guidance changes.

Screenshots used by the manual must be generated through the E2E screenshot workflow and must not contain personal paths, secrets, real account data, or machine-specific state.

When a production release includes user-visible behavior changes, update the user manual before tagging, include the documentation change in release notes, and verify the docs build when the manual or site configuration changed.

Do not publish internal engineering docs under `docs/requirements`, `docs/bugs`, or `docs/superpowers` as part of the public user manual.
```

## 测试要求

Unit tests：

* 如果新增 docs site 配置 helper 或导航生成逻辑，需要覆盖导航、语言路径和 base path 处理。

* 如果只新增 Markdown 内容和 VitePress 配置，可以不新增 unit tests，但需要说明原因。

Integration tests：

* 如果新增脚本处理截图路径、手册索引或 release notes 文档检测，需要覆盖输入输出。

* 如果只新增静态 Markdown 内容，可以不新增 integration tests，但需要说明原因。

E2E tests：

* 新增手册截图生成 E2E 流程，覆盖首批关键截图。

* 现有用户行为 E2E 仍需通过，截图生成不能替代行为断言。

Verification：

* `npm run lint`

* `npm run typecheck`

* `npm run test:unit`

* `npm run test:integration`

* `npm run test:e2e`

* `npm run docs:screenshots`

* `npm run docs:build`

## 验收标准

* 根目录存在 `user-manual/`，并能作为公开用户手册源码维护。

* 第一版中文用户手册覆盖快速开始、工作区、编辑器、搜索、链接、AI、设置、常见问题。

* 手册中的主要用户流程都有对应截图。

* 截图由 E2E 自动生成并保存到 `user-manual/public/screenshots/zh-CN/`。

* GitHub Pages workflow 能构建并发布用户手册站点。

* README 链接到用户手册站点或本地手册入口。

* `skills/release-new-version/SKILL.md` 已把用户手册更新纳入 release workflow。

* `AGENTS.md` 已明确用户手册维护、截图生成和 public/internal docs 边界。

* release notes 模板或实际 release notes 能体现用户手册更新情况。

* 所有相关验证命令通过；如某类测试不适用，必须在交付说明中写明原因。
