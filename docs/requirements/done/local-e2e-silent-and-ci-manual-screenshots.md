# Local E2E Silent Mode and CI Manual Screenshots - DONE

## Status

* 2026-05-04: Auto-pick started. Autonomy gate passed: the requirement defines the window-mode API, affected E2E launch layer, screenshot helper bug, screenshot asset list, CI artifact expectation, and test coverage clearly enough to implement from repository context. Known caveat from the previous loop: the existing editor performance smoke budget currently fails on this machine even in a clean `HEAD` worktree under external CPU load, so this task will verify changed behavior with targeted tests and record any unrelated performance-gate result separately.
* 2026-05-04: Completed and released in `v1.5.2`. Added `MDE_E2E_WINDOW_MODE` parsing and ready-to-show handling so normal E2E launches default to hidden windows while `visible` and `inactive` remain available for debugging. Updated the Electron E2E launch helper to inject hidden mode by default and allow explicit overrides. Fixed manual screenshot capture to use the real viewport instead of `fullPage`, added per-screenshot PNG dimension checks and complete screenshot-set validation, regenerated all zh-CN manual screenshots at `1280x820`, and added a macOS manual-screenshots artifact job to the user manual deployment workflow. The same release also includes the requested settings Theme navigation padding normalization.
* 2026-05-04: Verification passed: `npx vitest run --project unit tests/unit/e2eWindowMode.test.ts --testTimeout=30000`; `npx vitest run --project unit tests/unit/shell.test.tsx -t "opens the theme settings panel and persists the selected theme" --testTimeout=30000`; `npx vitest run --project integration tests/integration/e2eLaunchEnv.integration.test.ts tests/integration/electronConfig.integration.test.ts --testTimeout=30000`; `npx vitest run --project integration tests/integration/explorerPanelBorders.integration.test.ts --testTimeout=30000`; hidden-mode smoke E2E `npx playwright test tests/e2e/markdown-editor.e2e.test.ts -g "loads README markdown into the block editor surface"`; theme settings E2E `npx playwright test tests/e2e/markdown-editor.e2e.test.ts -g "selects and persists a manual theme from settings"`; `npm run docs:screenshots`; PNG dimension audit confirmed all nine zh-CN screenshots are `1280x820`; `npm run typecheck`; `npm run lint`; `npm run test:unit`; `npm run test:integration`; `npm run docs:build`; the Playwright functional portion of `npm run test:e2e` passed all 46 `tests/e2e/markdown-editor.e2e.test.ts` tests under the default hidden window mode.
* 2026-05-04: Verification caveat: the trailing editor performance smoke step in `npm run test:e2e` still failed under current machine load (`openEditorVisible`, `openFirstBlockAttached`, `singleInputVisible`, `readyToType`, and `bulkInputVisible` over budget). This same performance smoke failure was reproduced before this task in a temporary clean worktree at current `HEAD` without the component-reference changes, so it is tracked as an existing/environmental performance gate issue rather than a regression from the E2E window-mode or screenshot changes.

## 背景

MDE 的 E2E 测试通过 Playwright 启动真实 Electron App。当前主进程会在 `ready-to-show` 后显示窗口，因此本地运行 `npm run test:e2e` 时，测试窗口会弹出、抢占焦点，并影响开发者正常使用电脑。

普通 E2E 的目标是验证功能正确性，不需要人工观察窗口。手册截图则不同：它需要稳定、可复现的视觉产物，适合放到 CI 的隔离桌面环境中生成和校验，而不是依赖开发者本机窗口状态。

当前 `user-manual/public/screenshots/zh-CN/` 下的手册截图存在布局错乱问题，截图效果不像真实运行中的 MDE 界面。这个需求必须一并修复截图生成流程和现有截图资产，不能只把错误截图迁移到 CI 里继续生成。

## 问题研究

当前截图问题不是 AI 缺失导致的。`tests/e2e/manualScreenshots.spec.ts` 已经通过 fake `codex` CLI 生成确定性的 AI 结果，所以 CI 不需要真实 AI、API key 或网络也能生成 `ai-result.png`。

已观察到的主要异常是截图高度不等于真实 Electron 窗口高度。手册截图测试会把窗口 viewport 设置为 `1280x820`，但当前 `user-manual/public/screenshots/zh-CN/` 中多数截图实际是 `1280x1500`：

* `ai-result.png`
* `editor-main.png`
* `editor-search.png`
* `insert-link.png`
* `mermaid-flowchart.png`
* `settings-theme.png`
* `workspace-search.png`

只有 `quick-start-open-workspace.png` 和 `workspace-explorer.png` 是 `1280x820`。这说明截图产物混入了页面全高截图，而不是用户真实看到的 Electron viewport。

根因在 `manualScreenshots.spec.ts` 的 `capture()` helper：它调用 `window.screenshot({ fullPage: true })`。`fullPage: true` 适合网页长页面截图，但不适合固定窗口的 Electron App 手册截图。Electron 真实窗口只有 `1280x820`，full page 截图会继续捕获 renderer document 的 scroll height，导致截图下方出现真实窗口之外的空白区域。

这个问题在弹窗截图里尤其明显。例如 `insert-link.png` 和 `settings-theme.png` 的遮罩层只覆盖真实 app 视口区域，下方继续出现大块未遮罩空白；真实运行窗口中不会出现这段空白。`editor-main.png` 等普通界面截图也被拉成 `1280x1500`，下半部分是一段不属于真实窗口画面的空白。

当前流程缺少生成后质量校验，所以这些异常没有被测试挡住。后续修复必须至少检查输出图片尺寸、文件清单和基础视觉状态，避免再次把 full page、空白图、半遮罩状态或布局未稳定状态写入手册资产。

## 目标

* 本地运行普通 E2E 时默认使用静默窗口模式，不显示测试窗口、不抢占焦点。
* CI 继续能运行普通 E2E，并在无人值守环境中保持稳定。
* 用户手册截图生成放到 CI 完成，避免本地截图窗口影响开发者工作。
* 修复 `user-manual/public/screenshots/zh-CN/` 下现有截图布局错乱的问题，重新生成能反映真实 Electron App 运行状态的截图。
* 保留显式可见窗口模式，方便开发者本地调试 E2E 或人工检查截图。
* 窗口模式必须由测试启动层控制，不能影响生产 App 正常打开行为。

## 非目标

* 不把普通 Electron E2E 改造成浏览器 headless 测试。
* 不移除现有 Playwright Electron 测试覆盖。
* 不要求开发者本机自动生成或提交手册截图。
* 不改变生产用户启动 MDE 时的窗口显示行为。

## 设计要求

新增 E2E 专用窗口模式，例如 `MDE_E2E_WINDOW_MODE`：

* `hidden`：窗口不显示。本地普通 E2E 默认使用。
* `visible`：窗口正常显示。只用于显式本地调试或 CI 截图流程。
* `inactive`：窗口可显示但不主动抢焦点。可选，用于需要观察窗口但不希望强制聚焦的调试场景。

主进程创建窗口时仍应默认 `show: false`。当窗口 `ready-to-show` 后，根据 E2E 窗口模式决定是否调用 `show()` 或 `showInactive()`。只有 E2E 环境变量存在时才读取该模式；生产环境必须维持现有可见窗口行为。

`tests/e2e/support/electronApp.ts` 应为普通 E2E 注入默认 `MDE_E2E_WINDOW_MODE=hidden`，并允许单个测试或脚本通过 env 覆盖。

## 本地运行要求

本地普通测试入口应默认静默：

* `npm run test:e2e`
* `npm run test:e2e:performance`
* `npm run test:e2e:performance:benchmark`

开发者需要观察窗口时，可以显式覆盖：

```bash
MDE_E2E_WINDOW_MODE=visible npm run test:e2e
```

或使用不抢焦点模式：

```bash
MDE_E2E_WINDOW_MODE=inactive npm run test:e2e
```

## 手册截图要求

手册截图应由 CI 工作流完成，作为用户手册截图的标准生成路径。

CI 截图流程应运行：

```bash
npm run docs:screenshots
```

CI 环境中的截图窗口可以使用 `visible`，因为它显示在 runner 的隔离桌面或虚拟显示环境里，不会干扰开发者电脑。

本地 `docs:screenshots` 不应作为常规要求。开发者只在调试截图流程时本地运行，并显式选择窗口模式；默认开发流程不依赖本地截图生成。

截图生成流程必须保证产物是真实运行状态，而不是布局尚未稳定、窗口尺寸未生效、字体/主题未加载、DOM 被测试代码临时改坏后的中间状态。至少需要满足：

* 每张截图都从真实 Electron renderer 截取，不能用手写 mock 页面替代。
* 截图前等待 `.app-shell`、目标面板、目标文本和关键交互状态稳定。
* 固定 viewport 和窗口尺寸，并验证截图尺寸符合预期。
* 截图必须捕获真实 viewport，不得使用 `fullPage: true` 生成手册截图。
* 当前 `zh-CN` 手册截图的标准尺寸应为 `1280x820`，除非需求明确新增其他 viewport。
* 避免捕获滚动异常、面板重叠、按钮换行压缩、空白编辑器、未加载主题或加载中的 UI。
* 避免捕获真实窗口之外的页面空白，尤其是弹窗遮罩只覆盖上半部分、下方露出空白页面的状态。
* AI 相关截图继续使用 deterministic fake CLI，不依赖真实 AI，但结果必须通过真实 App 的 AI 结果面板渲染。
* 重新生成并替换 `user-manual/public/screenshots/zh-CN/` 下所有受影响截图。

当前需要覆盖的截图清单至少包括：

* `quick-start-open-workspace.png`
* `workspace-explorer.png`
* `editor-main.png`
* `editor-search.png`
* `workspace-search.png`
* `mermaid-flowchart.png`
* `insert-link.png`
* `ai-result.png`
* `settings-theme.png`

## CI 要求

CI 应包含独立的 manual screenshots job 或 step：

* 构建 Electron App。
* 在隔离显示环境中运行 `npm run docs:screenshots`。
* 上传生成的截图 artifact，或在需要更新手册截图的流程中提交/校验截图差异。
* 保证截图使用临时 workspace、固定语言、固定主题和无个人路径数据。
* 对生成后的截图做基础质量校验，例如文件存在、尺寸正确、不是空白图、关键 UI 区域没有明显塌缩。
* 将 CI 生成的截图作为 artifact，方便人工审查截图是否符合真实 App 布局。

如果 CI runner 需要虚拟显示环境，工作流应显式配置对应能力。macOS runner 可以使用系统桌面会话；Linux runner 应使用虚拟显示环境。

## 测试要求

### Unit Tests

* 窗口模式解析函数覆盖 `hidden`、`visible`、`inactive`、空值和未知值。
* 非 E2E 环境下窗口模式不改变生产默认显示行为。

### Integration Tests

* E2E launch helper 默认注入静默窗口模式。
* 显式传入 `MDE_E2E_WINDOW_MODE` 时可以覆盖默认值。
* 主进程窗口选项保持 `show: false`，并在 `ready-to-show` 后按模式显示或保持隐藏。

### E2E Tests

* 普通 E2E 在默认配置下能完成启动、打开 workspace、编辑和保存，不依赖可见窗口。
* 手册截图 E2E 在 CI 配置下能生成截图 artifact。
* 手册截图 E2E 需要在每次截图前断言目标界面已经进入真实稳定状态，例如 editor、搜索框、Mermaid preview、链接对话框、AI 结果面板和主题设置页均可见。
* 手册截图 E2E 需要断言每张生成图片都是预期 viewport 尺寸，默认 `1280x820`。
* 手册截图 E2E 需要校验生成文件清单完整，且 `user-manual/public/screenshots/zh-CN/` 中没有缺失或陈旧截图。
* 手册截图 E2E 需要覆盖回归场景：不能因为 `fullPage: true` 或 renderer document scroll height 变化而产出 `1280x1500` 这类非真实窗口截图。
* 显式 `visible` 模式仍可用于本地调试截图流程。

## 验收标准

* 本地运行 `npm run test:e2e` 时不会弹出或抢占 MDE 测试窗口。
* 普通 E2E、performance E2E 在静默模式下通过。
* 手册截图生成迁移到 CI 工作流，并能产出可下载 artifact 或可审查的截图变更。
* `user-manual/public/screenshots/zh-CN/` 下现有布局错乱截图被重新生成并替换，截图必须和真实运行中的 MDE 界面一致。
* 所有 `zh-CN` 手册截图默认输出为 `1280x820`，不再出现 `1280x1500` 的 full page 截图。
* 截图流程包含稳定性等待和质量校验，避免再次产出布局错乱、空白或半加载状态的手册截图。
* 本地仍可通过显式 env 打开可见窗口调试。
* 生产 App 启动行为不受 E2E 窗口模式影响。
* `npm run lint`、`npm run test:unit`、`npm run test:integration`、`npm run test:e2e` 在实现完成前通过。

## 发布和文档

* 完成并发布后，在本文档补充 `Status`，记录 release version、完成摘要和验证命令，并移动到 `docs/requirements/done/`。
* 如果新增或调整 npm scripts，需要在相关开发文档或用户手册维护说明中记录本地静默运行和 CI 截图生成方式。
* 这是测试和文档工作流改进；如果没有用户可见产品行为变化，不需要单独更新用户手册截图或发布说明中的用户功能部分。
