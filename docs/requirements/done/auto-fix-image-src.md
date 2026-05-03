# 自动修复MD文档里面失效的图片 - DONE

## Status

Released in `v1.4.6` on 2026-05-03.

Completion summary:

- Opening a Markdown document now opportunistically repairs missing local image assets that reference `.mde/assets/...`.
- When MDE finds exactly one matching missing asset elsewhere in the workspace, it copies that asset into the current document's `.mde/assets` directory without changing the Markdown source.
- If the repair is ambiguous or unsafe, the document still opens normally and the repair is skipped.
- The editor shows a non-blocking status notice after one or more image assets are restored.
- The Chinese user manual documents the moved-image repair behavior.

Verification:

- Local checks passed: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run docs:build`, `npm run build`, and `npm audit --audit-level=high`.
- GitHub Release workflow succeeded: `https://github.com/flowforever/mde/actions/runs/25272811649`.
- GitHub User Manual deployment succeeded: `https://github.com/flowforever/mde/actions/runs/25272811626`.
- GitHub Release published: `https://github.com/flowforever/mde/releases/tag/v1.4.6`.

当用打开一个被挪动过位置的MD文档的时候, 原来引用 .mde 目录的相对路径可能会失效.

* 实现一个高性能的解决方案,在打开文档的时候, 一次性把失效的图片资源从原来的.mde 目录找出来,并且替换掉.

* 不要影响文档的打开速度

* 替换完成之后, 用一个不打扰用户的方式提示, 失效的图片资源已经修复
