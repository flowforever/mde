# 调整left panel样式 - DONE

## 开发状态

* 2026-05-01: 已按 auto-pick-tasks 选中, 正在做设计分析、TDD 修改和发布验证。
* 2026-05-01: 已完成并准备随 v1.3.7 发布。

## Status

* Release: v1.3.7
* Completion: left panel 样式、Recent Files 排序、底部 Settings/Theme 分离均已完成。
* Verification: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` 已通过。

## 完成说明

* 使用 $huashu-design 对现有 left panel 做生产 UI 收敛,未新建独立 HTML 原型。
* 去掉 left panel 右侧重复边框,保留 resize handle 作为唯一分隔线。
* 去掉 Recent Files 展开态上方重复边框,保留可拖拽 resize handle 的单条分隔线。
* Recent Files 顺序调整为: 新打开文件如果已在最新 7 条内则保持原顺序,如果不在列表或在第 7 条之后则挪到第一条。
* 底部 Settings 与 Theme 拆为两个独立按钮,Settings 为单独 icon button,Theme 保持原有 selector 样式,两者同一行展示。
* 已补充 unit 和 E2E 覆盖,并通过 lint/typecheck/unit/integration/目标 E2E 验证。

* 使用 $huashu-design 重新设计

* 当前left panel 右边有两个border 不好看, 去掉一个边框

* "Recent Files" 展开的时候上面有两个边框, 去掉一个

  * "Recent Files" 展示逻辑调整一下

    * 如果新打开的文件已经在最新的7条, 不用调整顺序

    * 新打开的文件不在recent 列表或者, 在原来7条之后则挪到第一条

* 底部设置 Icon 不要跟Theme Switch 放同一个按钮里面, 拆成两个按钮

  * 把Settings 按钮拆分出去单独一个icon button

  * Theme Switch 保持现有样式

  * 按钮应该要显示在同一行
