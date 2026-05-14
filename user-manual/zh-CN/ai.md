# AI Summary、Translation 和 Agent Chat

MDE 可以调用本机已安装的 Codex 或 Claude Code CLI，为当前 Markdown 生成摘要或翻译。编辑器侧 Agent Chat 目前只在 Codex 可通过登录 shell 的 PATH 找到、已登录，并且支持 Codex app-server sustained protocol 与本地图片输入时显示；不可用时不会出现聊天入口。

![AI 结果面板](/screenshots/zh-CN/ai-result.png)

## Summary

点击编辑器标题栏的“总结 Markdown”按钮后，MDE 会生成只读摘要结果。摘要结果可以再次输入指令重新生成。

## Translation

点击翻译入口后，可以选择内置语言，也可以输入自定义语言。生成的翻译会显示为只读结果。

## Agent Chat

当设置中的 AI CLI 解析为 Codex，且本机 Codex 可以通过登录 shell 的 PATH 找到、`codex login status` 已登录、支持 app-server sustained protocol 和本地图片输入时，编辑器动作栏会显示 Agent Chat 入口。正式安装后的 MDE 也会读取登录 shell 的 PATH 来寻找 Codex，因此从 Dock、Finder 或启动器打开应用时，只要终端登录环境里的 Codex 已登录并支持这些能力，入口就应正常出现。打开后，右侧面板会带入当前 Markdown、选区文本、选中 block id、工作区路径和最高权限模式。聊天框作为编辑器右侧的独立工作区面板显示，可以拖动编辑器和聊天框之间的分隔条调整宽度；上下文和权限信息收在输入区上方的折叠区域里。上下文区域可以分别控制当前文档和当前选区是否随消息发送；选中文本可以固定为多个片段，方便在切换焦点后反复发送同一段上下文。

图片按钮、消息输入框和发送/停止主按钮都位于同一个消息框内。面板支持图标按钮新建 MDE 会话、恢复历史会话、继续发送消息、粘贴图片作为安全缓存附件，并在一次 turn 后显示变更文件摘要。AI 回复会按 Markdown 渲染，列表、标题、代码块和表格会保持结构；Codex 的 thinking 会在运行时流式显示，历史会话中的 thinking 默认折叠，展开后可以查看。

发送消息后，输入框会立即清空并显示“思考中...”状态；发送按钮会在当前 turn 运行时切换为停止按钮。会话选择器优先显示 Codex 原生会话标题，新建会话会使用首条用户消息生成标题，缺少标题时显示未命名聊天。变更文件摘要优先基于 Git 工作区的实际变更路径生成；当摘要不可用时，聊天框会在变更文件区域显示状态，而不会弹出通用诊断。

## 缓存位置

AI 结果保存在当前工作区的 `.mde/translations/`，嵌套文档会按工作区相对路径分目录保存，避免同名文件互相覆盖。Agent Chat 的 MDE 会话绑定和图片附件缓存保存在 `.mde/agent-chat/`。当原文没有变化时，MDE 会复用缓存结果，减少重复 CLI 调用。重新打开或刷新当前文件时，已显示的缓存结果会继续留在编辑器区域。

## 设置

在设置页的 AI 分区中，可以选择使用 Codex 或 Claude Code CLI，并配置默认 model name。模型名留空时，MDE 使用 CLI 默认值。
