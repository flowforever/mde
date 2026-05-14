# Automation Center

Automation Center 是独立窗口，用来执行自动化流程的发现阶段，把 Agent session 返回的本地或远程任务源排队并运行。它不会替代主编辑窗口；打开后仍然可以继续在原窗口编辑 Markdown。

## 打开 Automation Center

在 Explorer 顶部点击 Home 图标按钮。第一次点击会打开 Automation Center 独立窗口；如果窗口已经打开，再次点击会聚焦现有窗口。

## 工作区流程

左侧工作区流程区域显示当前工作区和无工作区范围内可用的自动化流程。第一次打开时默认选择就绪队列、当前工作区和无工作区；之后会恢复上次保存的过滤状态。工作区和流程都支持多选，失效的过滤项会在主进程投影时自动清理并写回本机过滤状态。

点击自动化流程名称可以把该流程加入或移出过滤范围。打开“显示已归档流程”后可以查看已归档流程，但已归档流程不会启动发现运行。

每个流程的操作菜单可以编辑定义，也可以对已有定义执行启用、停用、归档、恢复。当前切片还不支持停止整个流程，因此停止会显示为禁用操作，避免误以为点击后会中断后台运行。

点击新建自动化流程可以从内置模板为当前工作区创建工作区级自动化流程。也可以点击某个分组里的添加流程：在工作区分组下新建的是工作区级自动化流程，在无工作区分组下新建的是用户级自动化流程。Automation Center 会在右侧打开 Markdown 编辑模式，保存前会显示验证结果。有效的自动化流程会通过 Agent session 执行发现；本地 `.mde/docs/bugs/`、`.mde/docs/requirements/` 或 `.mde/docs/tasks/` 扫描只是发现可用的 helper，不会直接变成就绪任务。

## 信号队列

中间信号队列是扁平任务队列，只显示当前过滤条件下的任务。左侧任务栈负责选择状态：

| 队列 | 含义 |
| --- | --- |
| Needs me | 正在运行的任务需要你确认或补充输入 |
| Running | 自动化运行中 |
| Ready | 已由自动化流程发现运行返回，可以启动 |
| Done | 已完成并产生报告 |

选中 Ready 任务后，右侧就绪流程线会显示启动预览，包括来源摘要、所属流程、执行引擎和阶段计划预览。若发现结果里没有结构化阶段信息，Automation Center 会使用保守的预览阶段，先检查来源，再运行所属自动化流程，最后验证结果。点击启动自动化任务会调用该任务所属自动化流程的运行时启动路径。运行过程中如果进入 Needs me，右侧流程线会显示决策提示，可以批准并继续同一个 MDE run。

## Automation Agent Chat

当本机 Codex Agent Chat 支持持续会话协议时，Automation Center 右下角会显示 Automation Agent Chat 入口。该入口复用现有 Agent Chat 面板，创建的会话使用 Automation Center host 和 automation-task purpose。若 Codex 缺失或协议不支持，Automation Center 不显示 fallback chat 入口。

## Reports and Evidence

自动化运行的报告、决策和运行状态保存在 MDE 的本机自动化数据目录中。与工作区文件相关的 evidence 路径会经过 MDE 校验，只允许写入当前工作区或 MDE 管理的 evidence 位置。
