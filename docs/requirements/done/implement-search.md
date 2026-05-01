# 支持搜索 - DONE

使用 $huashu-design 对本次功能进行设计

## 当前 editor 内容搜索

* 快捷键 CMD + F / CTRL + F

* Summary 按钮左边,增加一个Search Icon Button, 点击的时候在左边显示搜索框

* 根据搜索内容高亮所有匹配的文本

* 搜索框内回车的时候切换不同匹配的文本, 另一个高亮颜色

## 全局搜索

* 快捷键 CMD + SHIFT + F / CTRL + SHIFT + F

* 左边panel 按钮区域增加一个search icon, 点击的时候显示类似 Spotlight 的搜索框

* 点击搜索打开对应文件并且继续在编辑器里面高亮搜索结果

## 完成说明

* 已发布版本: v1.3.3
* 发布地址: https://github.com/flowforever/mde/releases/tag/v1.3.3
* 实现提交: a65a3a7 feat: add markdown search
* 已完成当前编辑器搜索: CMD/CTRL + F、按钮入口、匹配高亮、回车切换当前匹配。
* 已完成全局搜索: CMD/CTRL + SHIFT + F、左侧搜索按钮、Spotlight 风格弹窗、打开匹配文件后保留编辑器高亮。
* 已补充覆盖: unit、integration、E2E。
* 发布前验证: `npm run lint`、`npm run typecheck`、`npm run test:unit`、`npm run test:integration`、`npm run test:e2e` 均通过。
