# Editor theme 配色阅读与书写优化 - DONE

## Status

* 2026-05-03: Completed and released in `v1.4.13`.
* Completion summary: all 24 built-in editor theme variants across the 8 colorway rows were recalibrated for long-form Markdown reading and writing. The work preserved the existing theme picker, follow-system preference, persisted dark/light memory, and 8 x 3 theme matrix while improving editor/panel separation, technical surface hierarchy, focus/search/action visibility, muted text contrast, and warning/accent distinction.
* Implementation notes: code blocks and Mermaid cards now use a dedicated `--editor-surface-strong` layer, selectable theme swatches are aligned with rendered theme tokens, and editor search now excludes derived Mermaid preview SVG text so active search no longer feeds back through Mermaid preview mutations during theme switching.
* New palette concept notes captured for future work: Olive Ledger, Fog Ledger, Petrol Archive, and Ash Parchment.
* Verification: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e` passed locally. The same release gate passed in the pre-push hook before publishing.
* Release verification: GitHub Actions Release run `25280810121` succeeded for `v1.4.13`, and GitHub Release `v1.4.13` was published with macOS DMG/ZIP and Windows NSIS artifacts. Release warning only: `actions/checkout@v4` and `actions/setup-node@v4` currently emit a Node.js 20 deprecation warning.
* User manual: unchanged because this release preserves the existing theme picker flow and recalibrates existing theme visuals without changing user-facing settings or workflows.

## 背景

MDE 已经实现 8 套主题色系，每个色系包含 3 种模式：

* Dark：深色 editor + 深色 panel。

* Light panel：浅色 editor + 浅色 panel。

* Dark panel：浅色 editor + 深色 panel。

当前主题矩阵已经能满足基础切换、跟随系统和主题持久化。但 MDE 的核心使用场景是长期维护 Markdown workspace：用户会阅读、书写、审阅 requirements、bugs、specs、release notes、用户手册、AI 输出和 Mermaid/code/frontmatter 混合文档。

因此主题不能只做到「好看」或「有 8 个色系」。每一套配色都应该对长时间阅读和书写友好，避免眩光、低对比、色彩疲劳、语义层级扁平化，以及 panel/editor 关系不清晰。

本需求基于 `huashu-design` 评审方式，将现有 8 个色系拆分给多个 SubAgent 做设计审查。评审对象包括：

* `src/renderer/src/theme/appThemes.ts`

* `src/renderer/src/styles/theme.css`

* `docs/requirements/done/support-multi-themes.md`

* `docs/requirements/done/optimize-editor-render-style.md`

## 总体观察

当前正文主文本对比普遍足够。问题不主要是「看不清字」，而是：

* editor、panel、frontmatter、code block、blockquote、Mermaid card 复用同一组 surface/border token 时，语义层级容易变平。

* Dark 主题里 panel 和 editor 常处在相近暗值，长时间使用会形成一整块暗色画布。

* Light panel 主题里 panel、editor、surface、border 过于接近，容易变成单一浅色 wash。

* Dark panel 主题通常空间结构最好，但深色 rail 不能压过文档本身。

* 一些浅色主题的 `--editor-accent` 作为按钮背景或 focus/active 状态时，对浅色前景不够稳，需要按真实使用方式校准。

* 紫色、暖色、蓝色这类高情绪色系需要减少全表面染色，把个性保留给 accent、focus、quote rail、selected state 等关键位置。

本地 token 粗略审计显示，`--editor-text` 对 `--editor-bg` 的对比普遍很高；但多个浅色主题的 `--editor-accent` 对 `--editor-bg` 低于普通字号 4.5:1 门槛。实现时不能只看正文，也要看 primary button、focus ring、selection、frontmatter action、Mermaid toolbar 等真实组件状态。

## 目标

* 让 8 个现有色系在 Dark / Light panel / Dark panel 三态下都适合长时间阅读和写作。

* 建立每套主题的阅读定位，而不是只做 hue-shift。

* 保证 Markdown 正文、frontmatter、blockquote、inline code、code block、Mermaid、搜索高亮、dialog 和 panel 状态在每套主题下层级清楚。

* 保持主题选择器和主题持久化行为不变。

* 思考新增更多配色方案，满足不同用户和不同工作场景。

## SubAgent 安排

本需求适合先并行评审、再单点整合实现。`src/renderer/src/styles/theme.css` 是主要写入点，多个 agent 不应同时改同一批 theme token；并行工作应优先用于审查、方案生成和验证。

### Phase 1: 主题评审 SubAgent

4 个 read-only SubAgent 并行执行，每个 SubAgent 必须使用 `huashu-design` 视角评审阅读/书写友好性，只输出问题、风险、调色方向和新增 concept，不直接改代码。

| SubAgent       | 范围                                                                                        | 重点输出                                                    |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Theme Review A | Neutral + Blue：`carbon` / `porcelain` / `quarry` / `blue-hour` / `glacier` / `paper-blue` | endurance baseline、technical reading、蓝色疲劳、light wash 风险 |
| Theme Review B | Warm + Green：`cedar` / `manuscript` / `atelier` / `moss` / `sage-paper` / `canopy`        | 低蓝光写作、纸面感、绿色低疲劳、warm muddy 风险                           |
| Theme Review C | Brass + Ember：`ink` / `ivory` / `ledger` / `ember` / `apricot` / `terracotta`             | archival/editorial 质感、暖色 saturation、accent 精准度          |
| Theme Review D | Teal + Violet：`basalt` / `mint` / `lagoon` / `plum` / `lilac` / `binder`                  | teal mineral clarity、violet fatigue、研究工具感、浅色层级          |

每个评审 SubAgent 的固定检查项：

* Dark / Light panel / Dark panel 三态是否有明确分工。

* 正文、muted metadata、小字号 label、code/frontmatter/Mermaid 是否可长期阅读。

* panel/editor 是否一眼可分。

* accent/focus ring/selected state 是否可定位但不吵。

* 是否存在全表面染色、过甜、过暖、过蓝、过紫或 dashboard 化问题。

* 至少提出 1 个未被现有色系覆盖的新配色方向。

### Phase 2: 方案整合 SubAgent

1 个 Design Integrator SubAgent 汇总 Phase 1 输出，生成统一 palette brief。

输出要求：

* 每个现有 theme 的保留点、风险点、token 调整方向。

* 每个色系三态的定位表。

* 需要新增的 3-6 个 theme concept，说明目标用户和与现有色系的差异。

* 明确哪些建议只需要 token 调整，哪些需要组件 token 拆分或新增测试 helper。

### Phase 3: Token 实现 Owner

1 个实现 SubAgent 负责实际修改 theme token，避免多个 agent 同时编辑 `src/renderer/src/styles/theme.css`。

写入范围：

* `src/renderer/src/styles/theme.css`

* 必要时更新 `src/renderer/src/theme/appThemes.ts`

* 必要时新增或更新 theme contrast helper

约束：

* 不改主题选择器交互。

* 不破坏 8 色系 x 3 模式矩阵。

* 不改 Markdown 读写、frontmatter、Mermaid、autosave 业务逻辑。

* 每次 token 调整都要能回溯到 palette brief 中的设计理由。

### Phase 4: 测试与验证 SubAgent

测试可以拆成 3 个相对独立的 SubAgent 并行执行，但要等 Token 实现 Owner 完成后再开始。

| SubAgent               | 范围                                                           | 重点输出                                                           |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Unit/Integration Agent | `tests/unit/appThemes.test.ts`、theme token integration tests | theme matrix、swatches/accent 一致性、token 对比度、selector 完整性        |
| E2E Visual Agent       | `tests/e2e/markdown-editor.e2e.test.ts` 或新增 theme E2E        | 主题切换、fixture 文档、focus ring、frontmatter/code/Mermaid/search 可见性 |
| Docs/Manual Agent      | `user-manual/` 和 screenshots                                 | 如果用户可见主题说明或截图变化，更新手册并跑 docs verification                       |

### Phase 5: Reviewer SubAgent

最后使用 Reviewer SubAgent 做只读 review，重点看：

* 是否真的解决层级对比，而不是只换色相。

* 是否有新的低对比文字、不可见 focus ring 或 warning/accent 混淆。

* 是否有 E2E 未覆盖的高风险主题。

* 是否需要补充 release note 或用户手册截图。

## 设计原则

### 1. 文档优先

editor 文档平面永远是主角。panel 是导航和工具，不应该在阅读状态里比正文更抢眼。

### 2. 层级对比优先于单纯色相

优化重点是 value、chroma、surface step、border step 和 muted text，而不是简单换一个更鲜艳的 accent。

### 3. Accent 要克制但可定位

Accent 需要服务于 focus ring、primary action、selected state、quote rail、search highlight 和链接状态。它不能成为常驻视觉噪声，也不能弱到键盘焦点看不见。

### 4. 避免全表面染色

蓝、绿、暖、紫等色系可以有明确气质，但大面积背景、panel、surface、border、muted text 不应全部被同一强色污染。长时间书写时，过强的全局色相会产生疲劳。

### 5. 同一色系三态要有分工

每个色系应至少明确：

* Dark：夜间或低光写作。

* Light panel：纯阅读、轻写作、低干扰。

* Dark panel：文档 + 工具并重，适合频繁切文件、查找、AI/历史/mermaid 工作流。

## 现有 8 个色系评审结论

### Neutral: `carbon` / `porcelain` / `quarry`

* `carbon` 是当前最安全的深色长期工作基线，但 code/frontmatter/Mermaid 等技术层容易和正文 surface 混在一起。

* `porcelain` 清爽、技术感强，但容易显得像默认 SaaS 浅色主题，panel/editor 分隔需要更有结构。

* `quarry` 的 dark panel 架构最好，但 editor 的暖石色和 panel 的绿炭色需要更统一。

优化方向：

* 保留 Neutral 作为 endurance baseline。

* 增强技术内容 surface 与正文纸面的局部分层。

* `porcelain` 向 precision paper 靠拢，避免冷白 wash。

### Blue: `blue-hour` / `glacier` / `paper-blue`

* `blue-hour` 有辨识度，但蓝色发光感偏强，长时间写作可能产生 UI-lit fatigue。

* `glacier` 是最平衡的白天技术阅读主题，但个性和 `porcelain` 接近。

* `paper-blue` 的 dark panel 架构适合技术文档，但 rail 不能压过文档。

优化方向：

* 将最亮蓝色只用于真实 focus/action。

* 通过 quote/code/Mermaid surface 建立 blue identity，不要把整页都染蓝。

* `paper-blue` 需要更 editorial，而不是 dashboard。

### Warm: `cedar` / `manuscript` / `atelier`

* `cedar` 适合低蓝光夜间写作，但 panel/editor 同处 brown-black band，空间容易发闷。

* `manuscript` 是舒适阅读面，但目前更像默认 warm root，需要更明确的 authored palette。

* `atelier` 是 warm row 中最有产品感的版本，但深色 rail 不应变成通用黑壳。

优化方向：

* 冷却一部分结构层，让 warm 只在纸面和 accent 中表达。

* `manuscript` 在 archival paper 与 modern cream editorial 中选定更明确方向。

* `atelier` 的 rail 需要更 studio/material，而不是普通 charcoal。

### Green: `moss` / `sage-paper` / `canopy`

* `moss` 是当前最适合长时间 dark writing 的候选之一，但仍需要更多 document/tool 分层。

* `sage-paper` 是最舒服的 light-panel 阅读主题之一，但 secondary UI 容易太轻。

* `canopy` 是很好的 productivity variant，panel 和 editor 关系自然，但 active state 需要更清楚。

优化方向：

* 保持 green 的低疲劳优势。

* 不增加鲜艳绿色，优先增加 mineral value separation。

* focus ring、frontmatter textarea、Mermaid source 等状态需要更明显。

### Brass: `ink` / `ivory` / `ledger`

* `ink` 是非常好的夜间写作 surface，但 panel/editor 暗值过近，容易变成单块暗幕。

* `ivory` 有纸感，但 cream 层过度和谐，缺少结构张力。

* `ledger` 是 brass row 中最成熟的方向，文档和 rail 分工清楚，但 accent 需要更像精准标记。

优化方向：

* 保持 brass 的克制，不滑向奢华金属 UI。

* `ivory` 增强 paper / rail / surface 的层级。

* `ledger` 让 focus 与 active 更可定位。

### Ember: `ember` / `apricot` / `terracotta`

* `ember` 个性强、可读性够，但红棕全局 tint 容易累。

* `apricot` 友好但过软，容易像泛用 productivity app。

* `terracotta` 的 dark panel 结构更好，是 ember row 中最值得强化的方向。

优化方向：

* 冷却中性结构层，只把热度保留给 accent 和少量 selected state。

* `apricot` 从 peach UI 转向 sun-faded paper 或 editorial clay。

* `terracotta` 保持清晰 rail，但降低全局 warmth saturation。

### Teal: `basalt` / `mint` / `lagoon`

* `basalt` 非常适合 sustained writing，矿物感强且不科幻，但 panel/editor value 仍过近。

* `mint` 是 calm light-panel，但 pale band 太窄时技术层级会变弱。

* `lagoon` 是 teal row 中空间结构最清楚的版本，但 deep rail 要避免 dashboard 感。

优化方向：

* 加强 value spacing，避免靠提高 saturation 解决问题。

* `mint` 增加 neutral gray 到 border/muted 中，让技术内容层更明确。

* `lagoon` 的 rail 向 slate-teal 收敛，focus ring 可略亮于 accent。

### Violet: `plum` / `lilac` / `binder`

* `plum` 优雅但偏氛围，长期写技术文档会有紫色 tint fatigue。

* `lilac` 是当前最弱的 light-panel 候选之一：甜、软、层级不足。

* `binder` 因 dark panel 有研究工具感，是 violet row 最可取的版本，但仍需更多 graphite 和中性纸面。

优化方向：

* violet identity 主要放在 accent/focus，不要染满所有 surface。

* `lilac` 改为 gray-violet editorial，而不是更漂亮的紫。

* `binder` 向 ink-violet research binder 靠拢。

## 新增配色方向

除优化现有 8 个色系外，可以探索更多面向具体需求的配色方案。建议先做 concept，不急于全部产品化。

### Newsprint Graphite

面向长时间技术阅读。浅矿物纸面、石墨正文、低饱和钢色 accent。解决 `porcelain` 太冷、warm rows 太奶油的问题。

### Library Slate

面向 specs、requirements、release notes 和参考手册。蓝灰 editorial light theme，不走暖纸，也不走默认白。

### Marine Archive / Harbor

面向喜欢蓝绿清晰感、但不想要蓝光夜间 UI 的用户。雾灰纸面、深 harbor-slate panel、petrol accent。

### Midnight Olive

面向夜间写作、code-adjacent Markdown 和 Mermaid-heavy docs。比 `moss` 更有结构，比 `blue-hour` 更低疲劳。

### Reading Lamp / Night Library

面向文学化长文写作和夜间审阅。冷暗结构 + 低 chroma amber，避免 `ember` 的红热疲劳。

### Graphite Rose

面向想要一点温度但不想全局紫色或粉色的用户。近中性 charcoal/paper + dry mulberry accent。

## 实现要求

### Token 校准

优先在 `src/renderer/src/styles/theme.css` 中校准主题变量：

* `--editor-bg`

* `--editor-surface`

* `--editor-surface-hover`

* `--editor-surface-pressed`

* `--editor-border`

* `--editor-border-strong`

* `--editor-muted`

* `--editor-muted-subtle`

* `--editor-accent`

* `--focus-ring`

* panel 对应 token

除非必要，不改 theme selection 的数据结构和持久化行为。

### 组件覆盖面

每套主题必须检查：

* Markdown body / headings / lists。

* Frontmatter collapsed、expanded、source、invalid YAML。

* Blockquote。

* Inline code 和 code block。

* Mermaid inline card、panel、dialog、source textarea。

* Search highlight、current match。

* Editor titlebar、action bar、view mode controls。

* Explorer tree、global search、workspace dialog、settings dialog。

* Keyboard focus ring、hover、selected、disabled、warning、danger。

### 对比与疲劳标准

* 普通正文与 editor background 至少满足 WCAG AA。

* 小字号 muted 文本不应低于 AA 目标；如果某处只能作为非文本装饰，必须确认不是关键信息。

* 使用 `--editor-accent` 作为背景并叠加浅色文字时，也要满足普通字号可读性。

* Dark 主题避免纯黑大面积压迫；Light 主题避免大面积冷白或奶油 wash。

* 同一主题内，warning/danger 不得和 accent 混淆。

## 非目标

* 不重做主题选择器交互。

* 不增加在线主题商店。

* 不支持用户自定义任意 HEX。

* 不更换 BlockNote 或 editor 排版系统。

* 不改变 Markdown 读写、frontmatter、Mermaid、image asset、autosave 的业务逻辑。

## 验收标准

* 8 个现有色系都经过 Dark / Light panel / Dark panel 三态校准。

* 每个色系三态有明确分工，不能只是同色相的深浅映射。

* 长文档阅读 30 分钟以上不出现明显眩光、暖色/紫色/蓝色疲劳或暗色压迫。

* editor 文档平面在所有主题中始终是视觉主角。

* panel 和 editor 在所有主题中一眼可分，dark panel 不压过正文，light panel 不融成一片。

* Frontmatter、blockquote、inline code、code block、Mermaid card/dialog/source 都能和正文保持清晰层级。

* Muted metadata、field label、Mermaid source label、code language selector 等小字号文本保持可读。

* Focus ring、selected state、primary action 在浅色和深色表面都清楚可见。

* Warning、danger、accent、search highlight 彼此不混淆。

* 主题选择、跟随系统、上次 dark/light 记忆、theme row 排列和已有 8 x 3 matrix 行为不回归。

* 至少产出 3 个新配色 concept 的设计说明或 prototype，说明目标用户、使用场景和与现有 8 色系的差异。

## 测试要求

### Unit Tests

* `APP_THEMES` 仍保持 8 个色系行，每行包含 dark、light-panel、dark-panel。

* 每个 theme 的 swatches 和 accent 与实际 theme token 保持一致。

* 新增或调整的 theme id、label、description 不破坏 preference normalize 和 follow-system 行为。

* 如果新增 contrast helper，覆盖文本、muted、accent-as-background、focus ring 等判断。

### Integration Tests

* theme token 与 `theme.css` 中的 data-theme selector 一一对应。

* 每个 theme 的关键 editor/panel token 可解析，且对比度满足约定阈值。

* Frontmatter、Mermaid、code block、dialog 依赖的 token 在所有主题中存在。

* 新增主题不会破坏 `getAppThemeRows` 的排序和完整性。

### E2E Tests

* 在每个 colorway row 中至少切换一次 Dark / Light panel / Dark panel。

* 打开包含 heading、paragraph、list、blockquote、inline code、code block、Mermaid、frontmatter 的 fixture 文档。

* 验证正文、frontmatter、code block、Mermaid card/dialog、search highlight 在每个主题模式下可见且不重叠。

* 验证 keyboard focus ring 在 editor、frontmatter source、Mermaid source、theme picker、explorer tree 中可见。

* 验证 follow-system 下选择当前系统对应的 theme 不退出 follow-system。

* 截图或 computed style regression 覆盖重点主题：`carbon`、`blue-hour`、`manuscript`、`sage-paper`、`ledger`、`terracotta`、`basalt`、`binder`。

## 验证命令

实现完成后至少运行：

* `npm run lint`

* `npm run typecheck`

* `npm run test:unit`

* `npm run test:integration`

* `npm run test:e2e`

如果更新用户手册截图或主题说明，再运行：

* `npm run docs:screenshots`

* `npm run docs:build`
