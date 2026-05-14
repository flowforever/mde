# 常见问题

## 为什么 AI 功能不可用？

MDE 需要在本机检测到 Codex 或 Claude Code CLI。安装后重启 MDE，再到设置页的 AI 分区确认是否可选。

## 为什么 Agent Chat 按钮不可见？

Agent Chat 只在当前 AI CLI 解析为 Codex，并且本机 Codex 支持 app-server sustained protocol 与本地图片输入时显示。设置里选择 Claude Code、未打开 Markdown 文件、未打开工作区，或 Codex protocol 探测失败时，编辑器动作栏会隐藏该入口。

正式安装后的 MDE 会读取登录 shell 的 PATH 来寻找 Codex；从 Dock、Finder 或启动器打开应用不应因为 GUI 环境 PATH 较短而隐藏入口。如果终端中 `codex --version` 和 `codex app-server generate-ts --experimental --out <目录>` 可用，但正式版仍看不到入口，请重启 MDE 后再次打开同一工作区和 Markdown 文件。仍不可见时，通常是 Codex 未登录、当前 Codex 版本缺少 app-server sustained protocol、本地图片输入标记，或探测返回了不支持的诊断原因。

## 为什么某些 Markdown 保存后格式变了？

MDE 使用 BlockNote 编辑 Markdown。当前能力以 Markdown 兼容为目标，部分复杂格式可能会被规范化为更稳定的 Markdown 写法。

## 为什么搜索不到内容？

确认已经打开文件夹工作区，并且目标内容在 Markdown 文件中。工作区全局搜索不会搜索 `.mde/` 管理目录。

## 为什么链接没有打开目标文档？

确认链接目标是当前工作区内存在的 Markdown 文件，或是 MDE 近期记住过的其它工作区路径。外部网页链接必须使用 HTTP 或 HTTPS。

## 为什么更新检查失败？

更新检查依赖 GitHub Releases。网络不可用、GitHub API 限制或开发环境运行方式都可能导致检查失败。

## 生成的摘要、翻译、图片在哪里？

* 图片：当前 Markdown 文件旁边的 `mde-assets/`
* AI 摘要和翻译：当前工作区的 `.mde/translations/`
* Agent Chat：`.mde/agent-chat/`
* 文档历史：`.mde/history/`
