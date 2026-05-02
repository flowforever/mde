# mde CLI command - LOW PRIORITY - DONE

## Status

Released in `v1.3.18`.

Completion summary:

* Packaged macOS and Linux app launches now check for an executable `mde` command in the background after `app.whenReady()`.
* Existing executable `mde` commands are left untouched.
* If no command exists, MDE writes an executable launcher into the first writable command directory it finds.
* Startup remains non-blocking because registration is scheduled asynchronously.
* The Chinese Quick Start manual documents terminal launch usage and the non-overwrite behavior.

Verification:

* `npm run lint`
* `npm run typecheck`
* `npm run test:unit`
* `npm run test:integration`
* `npm run test:e2e`
* `npm run docs:build`
* `npm audit`
* `npx npm@10.9.7 ci --dry-run`
* GitHub Release workflow `25256930398` succeeded for `v1.3.18`.
* GitHub User Manual workflow `25256930358` succeeded.

## 开发状态

* 2026-05-02: 已按 `auto-pick-tasks` 选中，开始分析现有 `bin/mde.js`、package `bin` 配置、应用启动流程和 CLI 注册测试覆盖。

* 用户启动MDE的时候在后台检测 "mde" 命令是否注册, 不要block启动速度

  * 如果已经有mde命令不再做操作

  * 如果没有mde 命令则注册mde 命令, 类似vscode 的code, 可以在命令行用mde打开文件和目录
