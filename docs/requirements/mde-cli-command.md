# mde CLI command - LOW PRIORITY - IN PROGRESS

## 开发状态

* 2026-05-02: 已按 `auto-pick-tasks` 选中，开始分析现有 `bin/mde.js`、package `bin` 配置、应用启动流程和 CLI 注册测试覆盖。

* 用户启动MDE的时候在后台检测 "mde" 命令是否注册, 不要block启动速度

  * 如果已经有mde命令不再做操作

  * 如果没有mde 命令则注册mde 命令, 类似vscode 的code, 可以在命令行用mde打开文件和目录
