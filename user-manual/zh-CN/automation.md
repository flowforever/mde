# Automation Center

Automation Center 是独立窗口，用来执行 automation-flow 的 discovery phase，把 Agent session 返回的本地或远程任务源排队并运行。它不会替代主编辑窗口；打开后仍然可以继续在原窗口编辑 Markdown。

## 打开 Automation Center

在 Explorer 顶部点击 Home 图标按钮。第一次点击会打开 Automation Center 独立窗口；如果窗口已经打开，再次点击会聚焦现有窗口。

## Workspace flows

左侧 Workspace flows 区域显示当前工作区可用的 automation-flow。工作区过滤只是辅助上下文，主任务列表仍然以任务状态为中心。

点击 automation-flow 名称可以只查看该 flow 的 discovery run 返回的任务；再次选择其它 flow 会切换过滤。打开“Show archived flows”后可以查看已归档 flow，但已归档 flow 不会启动 discovery run。

点击 New automation-flow 可以从内置模板创建 workspace automation-flow。Automation Center 会在右侧打开 Markdown 编辑模式，保存前会显示验证结果。有效的 automation-flow 会通过 Agent session 执行 discovery；本地 `.mde/docs/bugs/`、`.mde/docs/requirements/` 或 `.mde/docs/tasks/` 扫描只是 discovery 可用的 helper，不会直接变成 Ready 任务。

## Signal Stack

中间 Signal Stack 按状态显示任务：

| 队列 | 含义 |
| --- | --- |
| Needs me | 正在运行的任务需要你确认或补充输入 |
| Running | 自动化运行中 |
| Ready | 已由 automation-flow discovery run 返回，可以启动 |
| Done | 已完成并产生报告 |

从 Ready 队列点击 Start automation task 会启动对应任务。运行过程中如果进入 Needs me，右侧 Flowline 会显示决策提示，可以批准并继续同一个 MDE run。

## Reports and Evidence

自动化运行的报告、决策和运行状态保存在 MDE 的本机自动化数据目录中。与工作区文件相关的 evidence 路径会经过 MDE 校验，只允许写入当前工作区或 MDE 管理的 evidence 位置。
