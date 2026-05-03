# editor 点击AI翻译,或者Summary cache 结果显示了一会就消失了- LOW - DONE

## Status

Released in v1.4.9 on 2026-05-03.

Completion summary:

- Fixed cached AI Summary and Translation results disappearing or blanking when the current Markdown file is reopened or refreshed.
- The renderer now keeps AI result scope tied to the selected file during same-file reloads.
- The read-only AI result editor now keeps stable callbacks so parent refreshes do not rebuild and blank the embedded editor.
- Updated the Chinese AI user manual to document that cached AI results remain in the editor area during current-file reopen or refresh.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run docs:build`
- `npm run build`
- `npm audit --audit-level=high`
- `npx npm@10 ci --dry-run`
- GitHub Release workflow `25275587354` completed successfully for `v1.4.9`.
- GitHub Deploy User Manual workflow `25275587346` completed successfully.

## Original Report

* 显示结果消失需要重新点一下
