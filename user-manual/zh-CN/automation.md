# Automation Center

Automation Center 是独立窗口，用来查看和启动自动化任务数据。Automation Flow 负责发现或生成 task data；执行器负责拿到某条 task data 后运行实际工作。Automation Center 不替代主编辑窗口；打开后仍然可以继续在原窗口编辑 Markdown。

## 打开 Automation Center

在 Explorer 顶部点击 Home 图标按钮。第一次点击会打开 Automation Center 独立窗口；如果窗口已经打开，再次点击会聚焦现有窗口。

Automation Center 会使用主窗口当前选择的主题。手动选择深色、浅色或具体配色后，新打开的 Automation Center 会使用同一套主题 token；选择“跟随系统外观”时，它会使用当前系统解析出的浅色或深色主题。

## 工作区流程

Automation Center 采用三栏结构：左侧是 Task Stack、范围过滤和自动化流程过滤；中间是 task-first Signal Stack；右侧是 Flowline。左侧工作区流程区域先显示全局自动化流程，再把工作区分到“已启用自动化流程”和“未启用自动化流程”两个分组中。所有工作区项默认收起；展开工作区后，可以看到该工作区的 automation-flow。第一次打开时默认选中当前工作区的全部 automation-flow，其他工作区默认不选中；之后会恢复上次保存的过滤状态。范围和流程都支持多选，失效的过滤项会在主进程投影时自动清理并写回本机过滤状态。

Task Stack 中的 Needs me、Running、Ready、Done 可以直接切换当前队列。切换时左侧选中态会先立即更新，随后 Automation Center 再刷新真实投影，因此真实 Codex 发现运行较慢时也能看到当前选择。

点击自动化流程名称可以把该流程加入或移出过滤范围。打开“显示已归档流程”后可以查看已归档流程，但已归档流程不会启动发现运行。

每个范围右侧的管理按钮会打开对应工作区的 Explorer；如果该工作区已经有打开的 Explorer 窗口，则直接聚焦那个窗口并展开 Automation Flows 区域。

Automation Center 不再提供模板管理或内嵌流程编辑器。新建、编辑工作区 Automation Flow 和 Markdown 执行器时，请在主窗口 Explorer 的 Automation Flows 区域操作；文件会以普通 Markdown 文档打开。有效的 Automation Flow 会通过 Agent session 或本地扫描产生 task data；本地 `.mde/docs/bugs/`、`.mde/docs/requirements/` 或 `.mde/docs/tasks/` 只负责提供可被流程发现的来源。task data 只有绑定到启用的 Markdown 或 Skill 执行器后，才会成为可启动任务。没有启用执行器的流程会显示启动诊断，不能启动。

## 信号队列

中间信号队列是扁平任务队列，只显示当前过滤条件下的任务。左侧任务栈负责选择状态：

| 队列 | 含义 |
| --- | --- |
| Needs me | 正在运行的任务需要你确认或补充输入 |
| Running | 自动化运行中 |
| Ready | 已由自动化流程产生，并且可由启用执行器处理的 task data |
| Done | 已完成并产生报告 |

选中 Ready 任务后，右侧就绪流程线会显示启动预览，包括来源摘要、所属流程、主执行器和阶段计划预览。若同一条 task data 有多个可用执行器，可以在右侧选择本次启动使用的执行器。若发现结果里没有结构化阶段信息，Automation Center 会使用保守的预览阶段，先检查来源，再运行所选执行器，最后验证结果。点击启动会用当前 task data snapshot 和 executor snapshot 创建任务运行；如果两个任务有相同的逻辑 task id，但来自不同执行根目录，Automation Center 会把它们显示为不同任务卡片，并用对应的 snapshot 启动选中的那一个。运行过程中如果进入 Needs me，右侧流程线会显示决策提示，可以批准并继续同一个 MDE run。

当 task data 指定 `executionRoot`，且它不同于当前工作区时，Signal Stack 任务卡片、右侧 Flowline 和运行历史详情会显示“执行根目录”。启动前如果这个目录不存在、不是本地绝对路径或格式不正确，Automation Center 会在状态消息中显示是哪一个任务请求了哪个执行根目录，以及为什么不能使用；原始错误细节不会直接展示。

## Automation Agent Chat

Automation Center 当前不显示 Automation Agent Chat 入口。自动化任务仍会通过本机 Codex app-server 能力运行；如果检测到 Codex CLI 但 `codex login status` 没有返回已登录状态，Automation Center 会提示先登录 Codex 再启动真实自动化。

## Reports and Evidence

自动化运行的报告、决策和运行状态保存在 MDE 的本机自动化数据目录中。与工作区文件相关的 evidence 路径会经过 MDE 校验，只允许写入当前工作区或 MDE 管理的 evidence 位置。Flowline 的“执行记录”会把选中任务关联的运行列出来，包含执行器、执行根目录、运行状态、报告标题、报告摘要和 evidence/reference 路径；Automation Run History 的详情弹窗会继续展示运行级别的执行根目录、发现来源和处理过程。
