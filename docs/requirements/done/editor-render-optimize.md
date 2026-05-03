# 当前editor 文档视图存在问题 - DONE

## Status

- Released in `v1.4.0` on 2026-05-03.
- Completion summary:
  - Added a persisted editor line-spacing control with Compact, Standard, and Relaxed modes.
  - Removed heading underlines and improved rendered Markdown spacing.
  - Scoped Cmd+A/Ctrl+A to editor document content when the editor is focused.
  - Moved Mermaid flowchart previews below the document source, made previews non-selectable, and added a zoomable popup.
  - Kept the slash command link label as `Link` in Chinese and English.
  - Added Shiki-backed syntax highlighting for code blocks.
- Verification:
  - `npm exec --package=npm@10 -- npm ci --dry-run`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm run test:e2e`
  - `npm run docs:screenshots`
  - `npm run docs:build`
  - `npm audit --audit-level=high`
  - Pre-push verification for `v1.4.0` passed lint, typecheck, unit, integration, E2E, and build.
  - GitHub Actions Release `25265801887` succeeded for `v1.4.0`.
  - GitHub Actions Deploy User Manual `25265801893` succeeded.

* 当前editor render 的文档行间距太紧密

  * 编辑历史 icon button 右边增加一个 layout icon按钮,

  * 点击提供三种模式的行间距, 用户切换之后应该要能记住用户的选中,下次打开MDE不能丢掉

![image.png](.mde/assets/image-1777737028167-63f52e93.png)

* 去掉 heading 的下划线

* 当前focus在editor的时候 按 CMD + A 应该要能够全选文档内容, 而不是整个MDE 全部页面内容

* flowchart 图表不应该简单粗暴直接显示在文档最上面

![image.png](.mde/assets/image-1777738245092-7304d478.png)

* 应当把图显示在 文档中原来文档的下方

  * 注意图片内容不能被选中, 图片应该能支持单独popup 出来, 能放大缩小

![image.png](.mde/assets/image-1777738835127-d0c64a2b.png)

* "/" link 不应该 i18n 成中文

![image.png](.mde/assets/image-1777739475638-efd25e33.png)

* "/code block" render 应该使用 CodeMirror 或者是不是现有配置不正确

  *

![image.png](.mde/assets/image-1777739583538-fa844966.png)

* 当前 code block 没法支持语法高亮

![image.png](.mde/assets/image-1777739700962-b1d8a991.png)
