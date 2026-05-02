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

```bash
npm run docs:screenshots
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

## v1 Limitation

MDE stores files as Markdown. The current BlockNote-to-Markdown conversion is intentionally Markdown-compatible and may be lossy for future rich blocks that do not map cleanly to Markdown syntax.
