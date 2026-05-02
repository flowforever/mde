# i18n 增强 - LOW PRIORITY - DONE

## 开发状态

* 2026-05-02: 已按 `auto-pick-tasks` 选中，开始分析自定义语言包设置入口、AI 语言包生成能力、app language key 维护规则和相关测试覆盖。
* 2026-05-02: 已完成并发布为 `v1.3.17`。

## Status

Released in `v1.3.17`.

Completion summary:

* 设置页语言下拉框会把 `custom:*` 自定义应用语言包显示为“自定义”。
* 选中自定义应用语言包后，Preference 面板会显示 AI 更新按钮，用当前语言包名称刷新并替换对应语言包。
* `AGENTS.md` 已补充规则：修改已有用户可见文案的含义或措辞时必须使用新的 language-pack key，避免本地旧自定义语言包继续显示旧翻译。
* 用户手册 Settings 页已更新对应说明。

Verification:

* `npm run lint`
* `npm run typecheck`
* `npm run test:unit`
* `npm run test:integration`
* `npm run test:e2e`
* `npm run docs:build`
* `npm audit`
* `npx npm@10.9.7 ci --dry-run`
* GitHub Release workflow `25254790769` passed for `v1.3.17`.
* GitHub Release `v1.3.17` published macOS and Windows assets.
* User Manual deploy workflows `25254790778` and `25254987705` passed.

* 当用户添加字定义语言包的时候,设置页面下拉框应该有明显标识是自定义语言包

  * 当选择自定义语言包的时候,应该有个更新语言包的按钮通过AI 去翻译语言包资源

* 文本需要改动的时候,必须同时更新KEY,使用新的key, 避免用户使用旧的语言包产生歧义或者,运行错误

  * 更新 [AGENTS.md](../../AGENTS.md) 文件
