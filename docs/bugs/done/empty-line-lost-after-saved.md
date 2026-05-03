# 修复空行保存丢失的问题 - READY

## Status

- 2026-05-03: Development started. Scope is to preserve intentional blank lines in the editor body after save and reopen.
- 2026-05-03: Released in v1.4.2. Markdown editor save/export now preserves intentional consecutive blank lines in the document body after save and reopen, while leaving fenced code block blank lines unchanged.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run docs:build`
- `npm run build`
- `npm audit --audit-level=high`
- GitHub Release workflow 25269720720 succeeded for `v1.4.2`.
- Deploy User Manual workflow 25269720739 succeeded.

用户在editor正文中间敲几个空行,保存之后,离开文档重新打开的时候,空行丢失了.
