# editor 点击AI翻译,或者Summary cache 结果显示了一会就消失了- LOW - READY

## Status

Auto-pick started on 2026-05-03. Autonomy gate passed: the bug maps to the existing per-document AI result state in `src/renderer/src/app/App.tsx`, and the disappearing behavior can be covered with a focused unit regression plus existing E2E AI coverage.

Implementation candidate completed on 2026-05-03. The current AI document scope now falls back to the selected file while the same file is reloading, and the read-only AI result editor keeps stable callbacks so cached contents do not blank during parent refreshes.


* 显示结果消失需要重新点一下

