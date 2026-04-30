# MDE Multi Instance - READY

MDE 应该要能支持多开.

* 支持拖拽文件夹, 文件到MDE, 如果不是当前workspace的内容,在新窗口打开

* 系统docker MDE icon 右键应该要能显示最近打开的 workspace

切换Workspace:

* Workspace item 应该增加一个 open in new window 的icon button, 在新窗口打开workspace

  * 使用 $huashu-design 设计一下列表, 目前这个列表 delete button 大小跟 workspace item 高度不一致

* 新打开workspace 如果当前窗口有workspace 在新窗口打开

## Done

Released in `v1.3.1`.

* Main process now supports multiple MDE windows in one app process while keeping the single-instance application lock.
* Workspace, file, and AI IPC handlers now resolve the active workspace by renderer window, so operations from one window cannot accidentally use another window's workspace root.
* Command-line or second-instance launches with a path now open that path in a new MDE window instead of replacing the current workspace.
* Workspace manager recent items now include an icon-only "open in new window" action next to the icon-only delete action, with consistent row and action sizing following the `$huashu-design` review.
* Opening a new workspace or Markdown file from the workspace manager while a workspace is already active now opens the selection in a new window.
* Dragging a file or folder into MDE opens external resources in a new window; Markdown files already inside the current workspace open in the current editor.
* Recently opened workspaces/files are registered with the OS recent-document list so the macOS Dock can surface recent MDE resources.
* Release CI now launches Electron E2E tests with isolated user data, preventing active-workspace state from leaking between test cases.

## Verification

* `npm run lint`
* `npm run typecheck`
* `npm run test:unit`
* `npm run test:integration`
* `npm run test:e2e`
* `npm run build`
* GitHub Release workflow `25176470053`
