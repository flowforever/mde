# I18n Support - DONE

## 开发状态

* 2026-05-01: 已按 auto-pick-tasks 选中, 正在做范围分析、TDD 修改和发布验证。

## Status

* Released in v1.3.8 on 2026-05-01.
* Added app-level language packs for English and Chinese, with first launch resolving from the system language when no preference exists.
* Added Preference settings for switching app language and generating custom app language packs through detected Claude Code/Codex AI CLI tools.
* Moved renderer operation menus, dialogs, prompts, placeholders, aria labels, status messages, editor/update/AI copy, and workspace/explorer text onto language-pack-backed text helpers.
* Updated `AGENTS.md` to prohibit hard-coded production UI text for future feature and bug-fix work.
* Verification: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e`.

* 系统所有的操作菜单, 提示文本应该都要从语言包中获取文本

* 用户第一次进入MDV 的时候应该使用系统默认语言

* $huashu-design 设置弹窗界面应该多一个Preference

  * 用户可以切换语言, 先支持英语, 中文

  * 检测到用户有Claude Code, Codex 等AI CLI 的时候, (现有的逻辑), 用户可以添加自己的语言, 然后翻译语言包

* 更新 [AGENTS.md](https://AGENTS.md) 新功能开发的过程不能 hard code text
