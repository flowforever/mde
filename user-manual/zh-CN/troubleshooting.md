# 常见问题

## 为什么 AI 功能不可用？

MDE 需要在本机检测到 Codex 或 Claude Code CLI。安装后重启 MDE，再到设置页的 AI 分区确认是否可选。

## 为什么某些 Markdown 保存后格式变了？

MDE 使用 BlockNote 编辑 Markdown。当前能力以 Markdown 兼容为目标，部分复杂格式可能会被规范化为更稳定的 Markdown 写法。

## 为什么搜索不到内容？

确认已经打开文件夹工作区，并且目标内容在 Markdown 文件中。工作区全局搜索不会搜索 `.mde/` 管理目录。

## 为什么链接没有打开目标文档？

确认链接目标是当前工作区内存在的 Markdown 文件，或是 MDE 近期记住过的其它工作区路径。外部网页链接必须使用 HTTP 或 HTTPS。

## 为什么更新检查失败？

更新检查依赖 GitHub Releases。网络不可用、GitHub API 限制或开发环境运行方式都可能导致检查失败。

## 生成的摘要、翻译、图片在哪里？

* 图片：`.mde/assets/`
* AI 摘要和翻译：`.mde/translations/`
* 文档历史：`.mde/history/`
