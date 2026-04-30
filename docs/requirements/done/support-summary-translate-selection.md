# Editor Support AI Summary / Translation

## Status

Completed and released in `v1.2.12`.

* Added Summary and Translate editor actions when a supported AI CLI is available.
* Stored generated artifacts under `.mde/translations/` beside the workspace content.
* Rendered Summary and Translate output through the read-only Markdown editor.
* Added fixed-bottom Summary refinement input, document-scoped busy/result state, custom translation languages, and AI IPC/test coverage.

## Requirement

## AI 功能支持

检测用户电脑有 Codex, Claude Code CLI, 显示AI 操作按钮. (我们后续应该考虑更多其他 CLI)

* editor 视图toggle button 左侧加一个 Translate Button

  * 点击展开下拉菜单默认支持 "中文", "English", "其他" 输入框

    * 其他输入框输入语言名字

    * 这个语言应该要保存,后续下拉框可以选中或者删除

  * 翻译之后结果应该保存到 .mde/translations/{md-file-name}.{language}.md,

    * 选择翻译语言之后,如果md文档本身没有变化 这使用之前保存的版本

    * 翻译的版本不可用编辑修改

* editor 视图toggle button 左侧加一个 Summary Button

  * 显示Summary 结果,界面不可编辑

  * 保存Summary到 .mde/translations/{md-file-name}-summary.md,
