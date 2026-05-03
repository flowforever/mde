# 修复 **editor-render-optimize 引入的bug**

## Status

- 2026-05-03: Development started. Scope includes Mermaid/flowchart preview layout regression and code block language-switch UI visibility after editor render optimization.
- 2026-05-03: Completed and released in `v1.4.1`.

## Completion Summary

- Mermaid/flowchart code blocks now keep the original fenced source as the only editable source.
- Flowchart previews render inline below the matching source block as static complete thumbnails, with padding between the source and preview.
- Clicking a thumbnail opens a read-only enlarged preview with icon controls for zooming, reset view, centered/full-page modes, draggable panning, trackpad-friendly scrolling, and selectable flowchart text.
- Code block language selectors are visible above highlighted code blocks.
- Common imported code language aliases such as `ts`, `js`, `sh`, and `txt` are normalized to supported visible selector values.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npx playwright test tests/e2e/auto-superpower-repro.tmp.e2e.test.ts --reporter=line` with `/Users/trump.wang/work/ai-worker-review/ai-rules/content/workflows/auto-superpower/README.md`, then removed the temporary test file.
- `npm run docs:screenshots`
- `npm run docs:build`
- `npm run build`
- `npm audit --audit-level=high`
- GitHub Actions Release `25268907301` completed successfully for `v1.4.1`.
- GitHub Actions Deploy User Manual `25268907325` completed successfully.

* flowchart 显示没有按照需求实现

  * 显示混乱

![image.png](../.mde/assets/image-1777770635130-63503b88.png)

* code block 切换 编程语言 操作看不到

![image.png](../.mde/assets/image-1777770526212-1ae2eeb6.png)

*
