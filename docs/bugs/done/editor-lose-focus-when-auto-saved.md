# 编辑器自动保存的时候光标定位到最后一行 - DONE

## 开发状态

* 2026-05-01: 已按 auto-pick-tasks 选中，正在做根因分析、TDD 修复和发布验证。
* 2026-05-01: 已修复并发布 v1.3.5。

* 当前在文档中间编辑的时候,触发自动保存的时候,光标总是定位到最好一行

## 自动保存的时候换行信息丢失了

* 用户在文本中间敲换行,保存和自动保存的时候空格没掉了

## 完成说明

* 已发布版本: v1.3.5
* 发布地址: https://github.com/flowforever/mde/releases/tag/v1.3.5
* 修复提交:
  * 0f91192 fix: keep editor position after autosave
  * 88cf20b ci: stabilize autosave cursor release
* 修复内容:
  * 自动保存完成后,如果持久化内容只是追上当前本地 draft, 不再重新 hydrate BlockNote 文档, 避免光标跳到最后一行。
  * 外部内容真实变化时仍然会重新 hydrate。
  * E2E 使用明确 selection 定位验证中间段落 autosave 后继续输入仍留在中间。
* 维护内容:
  * ESLint 忽略 Playwright 输出目录,避免 lint 与 E2E 并发时扫描被清理的 test-results 目录。
  * Release workflow 改为优先使用 `.github/release-notes/vX.Y.Z.md` 同步 GitHub Release 正文,避免页面只显示 commit message。
* 验证:
  * `npm run lint`
  * `npm run typecheck`
  * `npm run test:unit`
  * `npm run test:integration`
  * `npm run test:e2e`
  * GitHub Actions Release run 25204366410 已成功完成 macOS 和 Windows 构建。

备注: v1.3.4 tag 已推送但 Release workflow 在 macOS E2E 中失败,未完成正式产物发布; 修复后使用 v1.3.5 完成发布。
