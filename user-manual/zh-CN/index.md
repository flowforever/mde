# MDE 用户手册

MDE 是一个本地优先的 Markdown 编辑器，提供类 VS Code 的文件资源管理器、BlockNote 编辑体验、自动保存、搜索、内部链接、Mermaid 流程图、AI 摘要和翻译、多主题、应用语言切换、更新检查以及文档历史恢复。

![MDE 编辑器主界面](/screenshots/zh-CN/editor-main.png)

## 推荐阅读路径

1. 从 [快速开始](./quick-start.md) 打开工作区或单个 Markdown 文件。
2. 阅读 [工作区与文件](./workspace.md)，熟悉 Explorer、Recent Files 和文件操作。
3. 阅读 [编辑 Markdown](./editor.md)，理解自动保存、图片、Mermaid 和版本历史。
4. 按需要查看 [搜索](./search.md)、[链接](./links.md)、[AI](./ai.md) 和 [设置](./settings.md)。

## 数据保存位置

MDE 直接读写你选择的本地 Markdown 文件。应用生成的辅助数据保存在工作区内的 `.mde/` 目录，例如：

| 数据 | 位置 |
| --- | --- |
| 粘贴图片 | `.mde/assets/` |
| AI 摘要和翻译 | `.mde/translations/` |
| 文档历史快照 | `.mde/history/` |

`.mde/` 是 MDE 管理目录，默认不会作为普通文件显示在 Explorer 中。
