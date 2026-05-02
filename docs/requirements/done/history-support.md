# 文档历史支持 - READY

## 开发状态

* 2026-05-01: 已按 `auto-pick-tasks` 选中，开始分析文档版本历史的主进程存储、保存/重命名/删除/恢复接入点、autosave 清空保护、i18n 文案、UI 设计和验证范围。

## Status

* Released in `v1.3.13` on 2026-05-02.
* Completed local Markdown document history with `.mde/history` snapshots, current-file version history preview and restore, deleted-document recovery from the Explorer, and system Trash deletion for MDE-initiated deletes.
* The editor history button now sits beside the view toggle and toggles the restore/history panel. The Explorer recovery button toggles a separate Deleted Documents section without changing Recent Files state.
* Verification: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e` passed locally for `v1.3.13`; GitHub Release workflow `25245449966` completed successfully and published macOS and Windows assets.

## 目标

MDE 需要为用户编辑过的 Markdown 文档保存一份本地、可恢复的版本历史，避免因为自动保存、手动保存、AI 改写、重命名或删除导致内容不可找回。

这里的 `history` 不是现在左侧面板里的“最近打开文件”。现有历史只记录导航状态：某个 workspace 最后打开过哪个文件，以及最近打开过哪些文件。本需求关注的是文档内容历史：MDE 覆盖磁盘文件之前，这个 Markdown 文件原来的内容是什么。

## 当前行为

* Renderer 侧已有 workspace file history，存储在 `localStorage` 的 `mde.workspaceFileHistory`。

* 这份历史只记录：
  * `lastOpenedFilePath`
  * `recentFilePaths`

* 文档保存目前通过 `window.editorApi.writeMarkdownFile(...)` 进入主进程，然后主进程直接覆盖原 Markdown 文件。

* 自动保存会在编辑器空闲 5 秒后触发。

* MDE 已经有 workspace 内 sidecar 数据目录约定：
  * 粘贴图片保存到 `.mde/assets/`
  * AI 摘要和翻译保存到 `.mde/translations/`
  * 点号开头的目录在 explorer 中默认隐藏

## 产品需求

### 文档版本历史

* 在 MDE 覆盖一个 Markdown 文件之前，主进程必须先快照旧的磁盘内容。

* 以下操作发生前都应该记录历史：
  * 手动保存
  * 空闲自动保存
  * AI 摘要、翻译、润色等会创建或更新 Markdown 文档的写入
  * 重命名 Markdown 文件，或重命名包含 Markdown 文件的目录
  * 删除 Markdown 文件，或删除包含 Markdown 文件的目录

* 即使最新一次保存把文档写空或写坏，用户也应该能恢复到之前的版本。

* 历史必须按 workspace 和文档隔离，不能依赖某个 renderer session。

* 历史必须在 app 重启后继续可用。

* 历史不能依赖 Git。即使用户打开的是普通文件夹，也应该受到保护。

### 自动保存清空保护

自动保存不能静默把一个原本有内容的文档写成空文档。

判定规则：

* 当 autosave 准备写入的内容满足 `nextContents.trim().length === 0` 时，视为清空写入。

* 只有当前磁盘内容或已加载版本满足 `currentContents.trim().length > 0` 时，才需要触发保护。

* 如果文档本来就是空文档，或用户新建后从未写入内容，不需要确认。

行为要求：

* autosave 发现清空写入时，不立即覆盖文件。

* UI 显示一次明确确认，文案表达为“自动保存检测到这次操作会清空文档，是否继续保存为空文档？”。

* 用户确认后，执行保存，并在覆盖前正常记录历史。

* 用户取消后，编辑器恢复为当前磁盘内容或最后一次成功加载的非空内容，不保留空草稿，不覆盖磁盘文件。

* 用户取消后，本次清空操作视为被撤销；编辑器状态应回到未清空前的文档内容。如果恢复后的内容与磁盘内容一致，dirty 状态应清除。

* 用户取消后，不要每 5 秒重复弹确认。只有用户再次主动把文档清空并触发 autosave 时，才重新确认。

* 手动保存属于用户显式操作，v1 不强制走这个 autosave 确认流程，但仍必须先记录历史。

### 最近打开文件保持独立

* 现有最近打开文件列表继续作为导航功能存在。

* 不要把文档版本写进 `mde.workspaceFileHistory`。

* UI 文案应该区分两个概念：
  * `最近文件`：用于快速打开之前看过的文件
  * `版本历史`：用于恢复文档内容

### 存储位置

使用 workspace 内的 sidecar 存储：

```text
<workspace>/.mde/history/
  index.jsonl
  documents/
    <document-id>.json
  blobs/
    <sha256>.md
```

选择这个位置的原因：

* 项目已经有 `.mde/` sidecar 目录约定。

* workspace 被复制或备份时，文档历史也会跟着走。

* 完整 Markdown 快照简单、可靠、容易恢复。

* 通过内容 hash 存 blob，可以避免相同内容重复占空间。

约束：

* 不自动修改用户项目里的 `.gitignore`。

* `.mde/history` 在 MDE explorer 中默认隐藏。

* workspace Markdown 搜索必须排除 `.mde/history`。

* `.mde/history` 是 app 管理目录，普通创建、重命名、删除和编辑操作不应该把它当成用户文档暴露。

## 快照格式

Markdown 内容保存为完整文件快照，放在 `blobs/<sha256>.md`。

元数据追加写入 `index.jsonl`，这样写入成本低，也更容易从局部损坏中恢复：

```json
{
  "schemaVersion": 1,
  "id": "2026-05-01T12-30-45.123Z_abcd1234",
  "documentId": "doc_abc123",
  "path": "docs/intro.md",
  "event": "autosave",
  "createdAt": "2026-05-01T12:30:45.123Z",
  "appVersion": "1.3.8",
  "beforeHash": "sha256-before",
  "afterHash": "sha256-after",
  "blobHash": "sha256-before",
  "byteLength": 12345
}
```

推荐事件类型：

* `manual-save`
* `autosave`
* `ai-write`
* `rename`
* `delete`
* `restore`

通常情况下，snapshot blob 保存的是事件发生前的内容。对于 restore 事件，需要同时记录“恢复来源版本”和“被替换前内容”的 hash，避免用户误恢复后无法撤回。

## 文档身份

每个被追踪的文档需要一个稳定的 `documentId`。

推荐做法：

* 第一次捕获快照时创建 document record。

* document record 存在 `.mde/history/documents/<document-id>.json`。

* metadata 记录当前路径和历史路径，避免文档重命名后历史被拆成两个文档。

* 如果 MDE 遇到某个路径没有 document record，就在第一次需要快照时懒创建。

document record 示例：

```json
{
  "schemaVersion": 1,
  "documentId": "doc_abc123",
  "currentPath": "docs/intro.md",
  "previousPaths": ["notes/intro.md"],
  "createdAt": "2026-05-01T12:00:00.000Z",
  "updatedAt": "2026-05-01T12:30:45.123Z"
}
```

## 保留策略和磁盘占用

历史记录不能无限保存。v1 必须同时使用去重、时间、数量和 workspace 总空间限制，避免把用户磁盘塞满。

### 去重

* 如果旧磁盘内容的 hash 和该文档最后一次记录的 snapshot hash 相同，不新增版本。

* 相同 Markdown 内容只保存一份 blob，不重复写入 `blobs/`。

* 手动保存、自动保存、AI 写入都遵循 hash 去重。

### 自动保存节流

自动保存本身可以 5 秒触发一次，但历史记录不能 5 秒生成一条。

推荐策略：

* 每个文档最多每 5 分钟记录一条 `autosave` 历史。

* 如果 5 分钟内自动保存多次，只保留第一次有意义变化对应的旧版本。

* 手动保存、重命名、删除、恢复、AI 写入不受这个 5 分钟限制，只要内容真的发生变化就可以记录。

### 单文档保留窗口

默认按下面的方式保留每个文档的历史：

* 最近 7 天：保留所有有意义的版本。

* 第 8-30 天：每天保留至少 1 个代表版本，优先保留手动保存、恢复、AI 写入和删除事件，其次保留自动保存。

* 第 31-90 天：每周保留至少 1 个代表版本，优先级同上。

* 超过 90 天：默认清理，除非这是 delete 事件，或者用户之后增加“永久保留”能力。

数量上限：

* 每个文档最多保留 100 条历史记录。

* 超过 100 条时，从最旧、最低优先级的自动保存版本开始清理。

### Workspace 空间上限

默认给每个 workspace 的 `.mde/history` 设置空间上限：

* 软上限：256 MB。

* 硬上限：512 MB。

当历史目录超过软上限：

* 后台或下一次写入时触发清理。

* 清理顺序为：
  1. 已超过保留窗口的 autosave 版本。
  2. 超过单文档 100 条上限的旧 autosave 版本。
  3. 30 天以前的非关键版本。
  4. 90 天以前的手动保存和 AI 写入版本。

当历史目录接近或超过硬上限：

* 写入新快照前必须先尝试清理。

* 清理后仍然无法降到硬上限以内时，继续执行更激进的自动清理，不弹出选择式确认。

* 自动清理仍然无法为新快照腾出空间时：
  * autosave 不执行本次覆盖，等待下一次可用时再保存。
  * 手动保存、AI 改写、删除、恢复等高风险操作不覆盖原文件。
  * UI 只显示一个简单状态：历史保护空间不足，本次操作未完成，请释放磁盘空间后重试。
  * 不要求用户参与清理策略，也不要求用户理解历史目录结构。

安全默认值建议：

* 清理策略由 MDE 自动决定，用户不需要参与。

* 只有真实磁盘空间不足、权限错误或历史目录损坏到无法自动修复时，才显示非选择式错误提示。

### 用户设置

v1 可以先使用固定默认值，不必做完整设置页。

后续可以增加 Preference：

* 开关：启用/关闭文档版本历史。

* 每个 workspace 的历史空间上限。

* 单文档最大版本数。

* 清理当前文档历史。

* 清理整个 workspace 历史。

## 恢复 UX

增加一个文档级的 `版本历史` 入口。

### 入口

v1 至少提供两个入口：

* 当前文档入口：在编辑器标题栏右侧增加一个 icon button，tooltip 和 aria label 使用 `版本历史`。它只在当前已打开 Markdown 文档时可用。

* 文档操作菜单入口：在 explorer 文件右键菜单或文档更多操作菜单中增加 `查看版本历史`。这让用户不必先打开文件也能查看历史。

删除恢复入口：

* 如果文件已经被删除，原编辑器标题栏入口不可用。v1 应在 workspace 菜单或 explorer 空白区菜单提供 `恢复已删除文档`。

* `恢复已删除文档` 只展示该 workspace 下有 delete event 的文档历史，方便找回被删文件。

* 删除恢复列表不应该要求用户知道 `.mde/history` 的存在，也不应该暴露内部 documentId。

### 面板结构

版本历史使用右侧抽屉面板或居中 modal。优先推荐右侧抽屉，因为用户可以保持当前文档上下文。

面板内容：

* 顶部显示当前文档名和路径。

* 顶部提供关闭按钮。

* 左侧或上方是版本列表，最新在上。

* 右侧或下方是选中版本的只读 Markdown 预览。

* 面板底部提供主要操作：
  * `恢复此版本`
  * `恢复为新文件`（可以作为 v1 后续项）
  * `关闭`

版本列表每条记录展示：

* 事件类型
* 时间
* 相关路径变化
* 大致大小

事件类型建议显示为用户能理解的文案：

* `自动保存前`
* `手动保存前`
* `AI 写入前`
* `重命名前`
* `删除前`
* `恢复前`

### 状态和交互

* 没有历史时，面板显示空状态：`当前文档还没有可恢复的历史版本`。

* 选中版本后显示只读预览。

* 点击恢复时，用选中的快照替换当前文档内容。

* 恢复动作需要二次确认，确认文案只说明结果：`当前文档会被替换为所选版本。恢复前会先保存当前内容到历史。`

* 恢复前必须先为当前内容创建一条新的历史记录。

* 恢复成功后，编辑器打开恢复后的内容，并显示普通的保存成功状态。

* 如果用户从 `恢复已删除文档` 入口恢复，默认恢复到删除前的原路径；如果原路径已被新文件占用，自动恢复为相邻的新文件名，例如 `intro.restored.md`，不要让用户处理路径冲突。

* 所有用户可见文本必须来自语言包，并通过 i18n helper 获取。

后续 UX：

* Markdown diff 预览。

* 恢复为新文件。

* 清理当前文档或当前 workspace 的历史。

### 设计开发要求

开发版本历史相关 UI 前必须使用 `huashu-design` skill。

适用范围：

* 编辑器标题栏的 `版本历史` 入口。

* explorer 或文档操作菜单里的 `查看版本历史`。

* workspace 级 `恢复已删除文档` 入口。

* 版本历史右侧抽屉或 modal。

* 版本列表、只读预览、恢复确认、空状态、错误状态。

* autosave 清空确认和历史空间不足提示。

要求：

* 先用 `huashu-design` 产出可评审的高保真交互方案或 HTML 原型，再进入生产代码实现。

* 设计必须贴合当前 MDE 的桌面编辑器气质，避免做成营销页或装饰性 dashboard。

* 入口和恢复流程要以“不打扰但找得到”为原则，不能把清理策略或历史目录细节暴露给普通用户。

## 错误处理

历史功能不能让普通保存变得不可解释。

* 如果 `.mde/history` 无法创建或写入，高风险覆盖操作默认阻断，并给出用户可理解的错误。

* 如果只是因为内容 hash 相同而跳过快照，正常继续保存。

* 如果 `index.jsonl` 存在坏行，读取时忽略坏行，继续展示其它有效历史。

* 如果某条历史引用的 blob 丢失，UI 显示该版本不可用，不要崩溃。

* 如果 `.mde/history` 或其子路径是 symlink，拒绝写入。

* 如果无法证明历史路径在当前 workspace 内，拒绝写入。

* 如果磁盘空间不足，应先自动清理历史；清理后仍失败时，只显示简洁原因和下一步建议，不提供清理策略选择弹窗。

## 安全要求

* 所有历史读写都必须发生在主进程。

* Renderer API 只暴露意图级方法，例如：
  * `listDocumentHistory(filePath, workspaceRoot)`
  * `readDocumentHistoryVersion(versionId, workspaceRoot)`
  * `restoreDocumentHistoryVersion(versionId, workspaceRoot)`

* Renderer 不能拼接或传入任意历史文件路径。

* IPC 输入必须校验类型和预期形状。

* 复用现有 workspace path safety，并为 `.mde/history` 增加 symlink 测试。

* 永远不要把历史写到 active workspace 之外。

## 实现建议

推荐服务边界：

* 新增主进程 `documentHistoryService`。

* 在 `markdownFileService.writeMarkdownFile(...)` 写入前捕获旧内容快照。

* 为 rename 和 delete 流程增加显式 history capture helper。

* hash、metadata 规范化、JSONL 解析、retention pruning 都放进小而可测的函数。

* 现有 recent-file helper 保持不变，只在需要时调整文案避免概念混淆。

推荐实现顺序：

1. 主进程 snapshot 存储和 metadata 单元测试。
2. 保存路径集成：`writeMarkdownFile` 覆盖前记录历史。
3. rename/delete 集成。
4. restore IPC 和 renderer 预览 UI。
5. i18n 文案和 E2E 覆盖。
6. retention pruning 和 workspace 空间上限。
7. autosave 清空保护确认流程。

## 测试要求

Unit tests：

* hash 和 blob path 创建。

* JSONL 追加、读取，以及坏行容错。

* document identity 创建和 rename 后路径更新。

* 内容不变时去重。

* autosave 历史节流。

* autosave 清空写入判定：`nextContents.trim().length === 0` 且当前内容非空时需要确认。

* 单文档保留窗口和 100 条上限。

* workspace 软/硬空间上限清理策略。

Integration tests：

* `writeMarkdownFile` 覆盖前会保存旧内容快照。

* snapshot 失败时，高风险覆盖操作不会静默覆盖原文件。

* rename 保持 document identity，并记录 rename event。

* delete 删除前记录可恢复内容。

* restore 替换当前内容，并记录 restore event。

* symlinked `.mde/history` 路径被拒绝。

* workspace search 排除 `.mde/history`。

* 超过 workspace 软上限时会按优先级清理旧历史。

* autosave 试图清空非空文档时，不会在用户确认前调用写文件接口。

E2E tests：

* 打开一个普通文档时，编辑器标题栏可以看到 `版本历史` 入口，并能打开右侧抽屉或 modal。

* 打开 workspace，编辑 Markdown，等待 autosave，然后恢复早期版本。

* 手动保存会创建可恢复版本。

* 删除文档后，可以从版本历史或恢复入口找回。

* 删除文档后，可以从 `恢复已删除文档` 入口看到 delete event，并恢复到原路径或自动生成的相邻文件名。

* 历史空间超过上限时，MDE 自动清理；清理失败时阻断高风险覆盖操作，并显示简洁提示。

* 将一个非空文档内容全部删除后等待 autosave，MDE 会要求确认；取消后编辑器和磁盘文件都恢复/保留原内容，确认后才写入空文档并保留可恢复历史。

* 英文和中文语言包都覆盖 version-history 文案。

## 验收标准

* 用户能在 autosave 覆盖文档后恢复之前的版本。

* 当前文档的 `版本历史` 入口清晰可见，用户不需要进入 `.mde/history` 或理解内部存储结构。

* 被删除的文档可以通过 workspace 级恢复入口找回。

* 用户能查看文档版本历史，但 `.mde/history` 不会作为普通 workspace 内容暴露。

* 手动保存、自动保存、重命名、删除、恢复、AI 写入路径都有覆盖。

* 自动保存不会在未确认的情况下把非空文档覆盖为空文档。

* 历史写入是 path-safe 和 symlink-safe 的。

* 历史存储有明确保留策略，不会无限占用磁盘。

* 超过空间上限时自动清理，不把清理决策交给用户。

* 现有最近打开文件行为保持正常。

* 发布前通过 `npm run lint`、`npm run typecheck`、`npm run test:unit`、`npm run test:integration`、`npm run test:e2e`。

## v1 非目标

* Git 集成。

* 跨 workspace 的全局历史。

* 多设备冲突解决。

* 富文本可视化 diff。

* 二进制资产历史。

* 完整的用户自定义 retention 设置页。
