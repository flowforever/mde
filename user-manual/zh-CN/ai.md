# AI Summary 和 Translation

MDE 可以调用本机已安装的 Codex 或 Claude Code CLI，为当前 Markdown 生成摘要或翻译。AI 功能完全通过本机 CLI 运行；没有检测到 CLI 时，对应入口会不可用或显示安装提示。

![AI 结果面板](/screenshots/zh-CN/ai-result.png)

## Summary

点击编辑器标题栏的“总结 Markdown”按钮后，MDE 会生成只读摘要结果。摘要结果可以再次输入指令重新生成。

## Translation

点击翻译入口后，可以选择内置语言，也可以输入自定义语言。生成的翻译会显示为只读结果。

## 缓存位置

AI 结果保存在当前工作区的 `.mde/translations/`。当原文没有变化时，MDE 会复用缓存结果，减少重复 CLI 调用。

## 设置

在设置页的 AI 分区中，可以选择使用 Codex 或 Claude Code CLI，并配置默认 model name。模型名留空时，MDE 使用 CLI 默认值。
