# AI Summary、Translation 和 Agent Chat

MDE 可以调用本机已安装的 Codex 或 Claude Code CLI，为当前 Markdown 生成摘要或翻译。编辑器侧 Agent Chat 目前只在 Codex app-server sustained protocol 可用时显示；不可用时不会出现聊天入口。

![AI 结果面板](/screenshots/zh-CN/ai-result.png)

## Summary

点击编辑器标题栏的“总结 Markdown”按钮后，MDE 会生成只读摘要结果。摘要结果可以再次输入指令重新生成。

## Translation

点击翻译入口后，可以选择内置语言，也可以输入自定义语言。生成的翻译会显示为只读结果。

## Agent Chat

当设置中的 AI CLI 解析为 Codex，且本机 Codex 支持 app-server sustained protocol 和本地图片输入时，编辑器动作栏会显示 Agent Chat 入口。打开后，右侧面板会带入当前 Markdown、选区文本、选中 block id、工作区路径和最高权限模式。面板支持新建/恢复 MDE 会话、继续发送消息、粘贴图片作为安全缓存附件，并在一次 turn 后显示变更文件摘要。

发送消息后，输入框会立即清空并显示“思考中...”状态；会话选择器优先显示 Codex 原生会话标题，缺少标题时才回退到会话 id。

## 缓存位置

AI 结果保存在当前工作区的 `.mde/translations/`。Agent Chat 的 MDE 会话绑定和图片附件缓存保存在 `.mde/agent-chat/`。当原文没有变化时，MDE 会复用缓存结果，减少重复 CLI 调用。重新打开或刷新当前文件时，已显示的缓存结果会继续留在编辑器区域。

## 设置

在设置页的 AI 分区中，可以选择使用 Codex 或 Claude Code CLI，并配置默认 model name。模型名留空时，MDE 使用 CLI 默认值。
