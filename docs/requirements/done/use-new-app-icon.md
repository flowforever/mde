# 使用新 App 图标

## 状态

* 设计方向已确认：采用 `02 Split Editor`。

* 需求创建时本文档只定义后续实现任务的需求范围，不在当时接入生产图标。

* 生产接入已完成，Electron Builder 现在显式指定 app icon。

* 2026-05-04: Auto-pick started. Autonomy gate passed: the selected SVG master, expected production assets, Electron Builder icon paths, and verification requirements are all present in this document and existing repository configuration.

* 2026-05-04: Implementation completed locally. Added reproducible icon generation, committed `build/icon.svg`, `build/icon.png`, `build/icon.icns`, and `build/icon.ico`, configured Electron Builder to use them for macOS and Windows, and added integration coverage for config and asset drift. Local package smoke verified `release/mac/MDE.app/Contents/Resources/icon.icns` matches `build/icon.icns`.

* 2026-05-04: Released in `v1.4.16`. GitHub Release workflow `25285682659` completed successfully for macOS and Windows artifacts, and Deploy User Manual workflow `25285682647` completed successfully. Release notes document that the user manual was not changed because the app icon update affects packaged app identity rather than in-app workflows.

## 背景

MDE 现在需要一个正式的桌面 App 图标，用于安装包、macOS Dock、Windows
任务栏、应用切换器、发布页和 GitHub Release 资产。

MDE 的产品识别不应该只是通用 Markdown 符号。它更像一个本地优先的 Markdown
工作台：左侧资源管理器负责 workspace 文件，右侧编辑器负责文稿编辑。新图标应优先强化桌面工具感、
深色 Dock 对比度和双栏工作区结构，同时保留纸面文稿作为 MDE 的编辑器核心隐喻。

## 设计结论

选定图标方向：

* 主方向：`02 Split Editor`
* SVG 母版：`docs/superpowers/prototypes/app-icon-assets/mde-icon-split-editor.svg`
* 评审画布：`docs/superpowers/prototypes/app-icon-design-concepts.html`

设计理由：

* 深色外壳、左侧 explorer rail、右侧纸面文稿和 `M` glyph 能同时表达桌面工具与 Markdown 编辑器。

* 图标表达的是“打开一个本地 Markdown 工作区”，而不是完整功能清单。

* 相比纯暖纸方向，`02 Split Editor` 在 macOS Dock、Windows 任务栏和 Alt-Tab
  背景里对比更强，更像一个可长期停驻的生产力工具。

* 相比命令感方向，`02 Split Editor` 更克制，不会把 MDE 误读成只面向 AI
  action 或快捷命令的工具。

* 后续落地时应保持文稿区域的暖纸色，但整体外轮廓以深色桌面壳承载，确保
  32 px / 44 px 下仍能识别。

## 目标

* 将 `02 Split Editor` 作为 MDE 的生产 App 图标。

* 生成 macOS 和 Windows 打包需要的平台图标资产。

* 在 Electron Builder 配置中显式接入新图标，避免继续使用默认 Electron 图标。

* 保留 SVG 母版，后续图标微调必须从母版派生，不能只改二进制平台资产。

* 补充自动化验证，防止图标文件缺失、配置路径漂移或 release 打包回退到默认图标。

## 生产资产要求

后续实现任务应从选定 SVG 母版生成并提交以下资产：

```text
build/icon.svg
build/icon.png
build/icon.icns
build/icon.ico
```

资产要求：

* `build/icon.svg` 是可维护母版，内容应来自 `mde-icon-split-editor.svg`。

* `build/icon.png` 使用 1024 x 1024 分辨率，作为通用预览和平台资产生成源。

* `build/icon.icns` 用于 macOS app、DMG 和 ZIP 产物。

* `build/icon.ico` 用于 Windows NSIS 产物。

* 所有资产都应表现同一图标方向，不允许 macOS 和 Windows 使用不同概念图标。

* 生成脚本或生成说明应可复现，避免只有一次性的手工导出结果。

## Electron Builder 接入

后续实现任务应在 `package.json` 的 `build` 配置中显式设置图标路径。

推荐规则：

* 顶层 `build.icon` 指向 `build/icon` 或等价平台可识别路径。

* 如 Electron Builder 对平台路径解析不稳定，可在 `build.mac.icon` 指向
  `build/icon.icns`，在 `build.win.icon` 指向 `build/icon.ico`。

* 不改变现有 appId、productName、artifactName、publish、mac target、win target
  或签名配置。

* 不在 release 产物里额外打包设计评审 HTML 或 prototype 目录。

## 视觉验收标准

* 1024 px 下能看到深色桌面外壳、左侧 explorer rail、右侧纸面文稿、折角和
  `M` glyph。

* 128 px 下图标主体清晰，深色外壳、文件栏和文稿仍能区分。

* 64 px 下 `M` glyph 和文稿轮廓仍可识别。

* 44 px 和 32 px 下允许细节简化，但不能变成模糊色块。

* 浅色桌面背景下深色圆角外轮廓应清晰。

* 深色 Dock、任务栏或 Alt-Tab 背景下图标不能融进背景，外框和纸面文稿需要保持足够对比。

* 图标不使用紫色科技渐变、emoji、装饰性数据、通用 Markdown 文件图标或与
  MDE 当前产品无关的素材。

## 功能验收标准

* `npm run package` 生成的本地目录包使用新 app icon。

* `npm run dist:mac` 生成的 macOS `.app`、DMG 和 ZIP 使用新 app icon。

* `npm run dist:win` 生成的 Windows 安装包和已安装 app 使用新 app icon。

* release workflow 使用同一套图标资产，不需要手工替换。

* 删除或重命名图标资产时，自动化测试能失败并指出缺失路径。

* 修改 Electron Builder 图标配置时，自动化测试能覆盖配置路径。

## 实现约束

* 当前任务只完善需求文档；不要在本任务里改生产打包配置。

* 后续实现必须保留设计探索文件，除非另有清理任务。

* 不改变应用名称、bundle id、安装包命名、release 版本规则或自动更新逻辑。

* 不引入新的 UI 文案；如果后续 release notes 或用户手册需要描述图标变化，按现有文档流程更新。

* 图标生成工具应优先使用项目已有依赖或系统工具；如必须新增依赖，需要说明原因和替代方案。

* 生产接入完成后，如果该变更作为用户可见发布内容发版，需要按 release policy 更新版本、release notes 和需求状态。

## 测试计划

* Unit：如新增图标路径 helper 或资产生成脚本，覆盖路径解析、输出文件列表和错误提示。

* Integration：更新 `tests/integration/electronConfig.integration.test.ts`，覆盖 Electron
  Builder 图标配置和图标资产存在性。

* E2E：打包冒烟流程中验证构建产物存在；如环境允许，检查 macOS `.app` 或
  Windows 产物引用了配置的图标资产。

* Visual/manual：用生成的 1024 / 128 / 64 / 44 / 32 px 预览检查浅色背景、深色背景和 Dock-like 背景可读性。

* Verification：后续实现完成后至少运行 `npm run lint`、相关 unit/integration
  测试；生产打包配置变更应运行对应 package/dist 验证。

## 非目标

* 不重新设计 MDE 的品牌系统、logo 或产品名称。

* 不改变 App 内部 toolbar、侧栏、主题选择器或编辑器 UI。

* 不实现多套可切换 app icon。

* 不为文档文件关联单独设计 `.md` 文件图标。

* 不在本需求中发布新版本；发版应由后续生产接入任务决定。

## 后续任务建议

1. 生成 `build/icon.*` 平台资产。

2. 接入 Electron Builder icon 配置。

3. 补充配置和资产存在性测试。

4. 本地运行 package/dist 验证。

5. 如果决定发版，更新本需求状态并按 release policy 发布新版本。
