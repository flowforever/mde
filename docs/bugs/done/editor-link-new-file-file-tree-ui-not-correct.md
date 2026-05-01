# Editor Link 新建文件选择目录的数据源不对 - READY

## Status

* DONE — Released in `v1.3.11` on 2026-05-01.
* Completion summary: editor link picker now derives its directory tree and Markdown link suggestions from the same hidden-entry visibility rules as the Explorer; the new-document picker opens with only the current document directory branch expanded and selected; selecting an existing document or creating a linked document immediately saves the current Markdown file.
* Verification: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e` passed locally before release. The pre-push hook repeated lint/typecheck/unit/integration/E2E/build successfully, and GitHub Release workflow run `25222733396` completed successfully for macOS and Windows artifacts.

## 开发状态

* 2026-05-01: 已按 `auto-pick-tasks` 选中，开始分析 editor link picker 的目录数据源、隐藏项过滤、当前文档目录展开选中，以及选择/创建后的保存触发链路。

* 应该要跟当前left panel 一样, 把隐藏的内容都隐藏掉

* 另外应该只展开当前文档所在的目录,并且选中

* 选中文档,或者新建文档完成之后应该立即触发保存
