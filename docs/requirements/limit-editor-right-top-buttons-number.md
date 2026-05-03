# 限制editor右上角默认展示按钮数量 - READY

## Status

- 2026-05-03: Development started. Scope is to collapse the editor action bar when more than five actions are available, preserve the requested right-to-left priority order, and verify collapsed/expanded behavior with automated tests.
- 2026-05-03: Release candidate completed for v1.4.5. The editor action bar now collapses overflowing actions, keeps priority actions visible, exposes the remaining controls through the arrow, and removes the pressed state from the editor view toggle.

* 当按钮数量超过5个的时候:

  * 第5个按钮变成下图的箭头, 点击展开所有按钮, 然后最左放收缩箭头按钮

  * 展开状态点击收缩箭头, 恢复原来收缩状态,只展示5个按钮

* 优先展示,从右到左:

  * 搜索按钮

  * AI 翻译

  * AI Summary

  * 历史按钮

  * editor 视图 toggle

    * 切换两个图标样式就好,不用现在的 press 状态

  * 切换文档行高 密度

![image.png](.mde/assets/image-1777782763689-31dafdcb.png)
