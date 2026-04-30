# 修复使用翻译功能的时候Codex 报错

版本信息: Version 1.2.14 (1.2.14)

报错信息:

Error invoking remote method 'ai:translate-markdown': Error: Unable to generate AI result. Codex: error: unexpected argument '--ask-for-approval' found tip: to pass '--ask-for-approval' as a value, use '-- --ask-for-approval' Usage: codex exec [OPTIONS] [PROMPT] codex exec [OPTIONS] [ARGS] For more information, try '--help'.

## Status

Fixed and released in v1.2.17.

## Completion Notes

- Removed the deprecated `--ask-for-approval never` Codex CLI arguments from the AI service.
- Added unit coverage for Summary and Translate through the real fake-Codex spawn path.
- Added IPC integration coverage to verify the packaged AI handler no longer sends the removed flag.
- Strengthened the E2E Summary/Translate fake Codex command so the desktop flow fails if the removed flag is passed again.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- GitHub Release workflow `v1.2.17 Release` completed successfully for macOS and Windows.
