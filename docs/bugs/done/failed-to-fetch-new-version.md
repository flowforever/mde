# 检测新版本的时候报错了

报错信息:

```text
Error invoking remote method 'update:check-for-updates': Error: GitHub release check failed with status 403
```

## Status

Fixed and released in v1.2.19.

## Completion Notes

- Kept the GitHub REST releases API as the primary macOS update-check source.
- Added a fallback to the public GitHub releases Atom feed when the REST API returns `403` or `429`.
- Constructed trusted macOS DMG asset URLs from the fallback release tag for both arm64 and x64 builds.
- Added test-only update-check seams so E2E can exercise packaged macOS update behavior from a development build without calling GitHub.
- v1.2.18 was tagged first but its release workflow failed because the new integration test expected `mac-x64` on an arm64 CI runner; v1.2.19 includes the architecture-aware test fix and is the successful release.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- GitHub Release workflow `v1.2.19 Release` completed successfully for macOS and Windows.
