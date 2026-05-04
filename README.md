# MDE

MDE is an Electron Markdown editor with a local-folder explorer and a BlockNote-powered editing surface.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## User Manual

The public user manual lives in [`user-manual/`](user-manual/) and is published through GitHub Pages.
Manual screenshots are generated from the real Electron app in CI and uploaded as reviewable artifacts. Run the screenshot flow locally only when debugging screenshot changes.

```bash
MDE_E2E_WINDOW_MODE=visible npm run docs:screenshots
npm run docs:build
npm run docs:dev
```

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:coverage
npm run test:e2e
npm run test
```

Electron E2E launches default to a hidden test window so local test runs do not steal focus. Use `MDE_E2E_WINDOW_MODE=visible npm run test:e2e` when you need to watch the app, or `MDE_E2E_WINDOW_MODE=inactive npm run test:e2e` when you want the window visible without requesting focus.

## v1 Limitation

MDE stores files as Markdown. The current BlockNote-to-Markdown conversion is intentionally Markdown-compatible and may be lossy for future rich blocks that do not map cleanly to Markdown syntax.
