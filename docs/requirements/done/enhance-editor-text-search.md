# 增强editor 文本搜索 - DONE

## Status

Released in `v1.4.8` on 2026-05-03.

Completion summary:

- Editor search now stores submitted search keywords locally and shows matching history when the search field is focused.
- Editor search history rows can be pinned so all matches for that keyword stay highlighted with distinct colors separate from the active search highlight.
- Pinned search keywords can be deleted from the search-history dropdown, which removes the persistent highlight for that keyword.
- Workspace search now stores successful result-click queries locally and can rerun a saved query from the search popover.
- Editor and workspace search tooltips now show their platform shortcuts.
- The Chinese user manual documents editor search history, pinned highlights, pinned-keyword deletion, and workspace search history.

Verification:

- Local checks passed: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run docs:build`, `npm run build`, `npm audit --audit-level=high`, and `npx npm@10 ci --dry-run`.
- Pre-push verification passed for `v1.4.8`: lint, typecheck, unit, integration, E2E, and build.
- GitHub Release workflow succeeded: `https://github.com/flowforever/mde/actions/runs/25274462610`.
- GitHub User Manual deployment succeeded: `https://github.com/flowforever/mde/actions/runs/25274462637`.
- GitHub Release published: `https://github.com/flowforever/mde/releases/tag/v1.4.8`.

## Editor 搜索

当前editor已经能支持文本搜索. 我们现在对这个搜索做一些增强:

* 用户回车之后应该,保存搜索关键字

* 用户focus 到搜索框的时候,要列出搜索记录

  * 用户输入过程, 只留下匹配的关键字下拉, 回车的时候关掉下拉框

  * 每个搜索记录应该有一个pin 按钮, 点击pin 的时候高亮 editor 所有match 的文本

    * 不同的关键字应该有不同的高亮颜色

    * 高亮的颜色必须跟当前搜索框内正在搜索的文本不一样颜色

* 鼠标hover到 search icon button 的时候应该能显示快捷键

## 全局搜索

全局搜索用户点击搜索结果之后, 应该保存搜索关键字, 下次打开全局搜索框的时候要列出搜索关键字, 用户点击的时候, 列出搜索结果列表

* 新建SubAgent 使用 $huashu-design 对搜索关键字列表, 搜索结果布局进行设计, review

* 鼠标hover到 search icon button 的时候应该能显示快捷键
