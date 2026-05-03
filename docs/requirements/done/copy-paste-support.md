# Copy Paste MDE 目录文档, 外部目录文档支持 - READY

## Status

Completed in v1.4.11.

- Added Explorer copy/paste for Markdown files and folders through context menus and Cmd/Ctrl+C/V.
- Added copy relative path and copy absolute path actions.
- Migrated local `.mde/assets` images for workspace copies and external Markdown paste, including macOS Finder file URL clipboard entries.
- Adjusted expanded-folder clicks to collapse without selecting, aligned Explorer footer controls, and widened context menus.
- Updated `user-manual/zh-CN/workspace.md`.
- Verification: `npm run lint`; `npm run typecheck`; `npm run test:unit`; `npm run test:integration`; `npm run test:coverage`; `npm run docs:build`; `npm run build`; `npm audit --audit-level=high`; `npx npm@10 ci --dry-run`; `npm run test:e2e`; GitHub Release workflow v1.4.11; Deploy User Manual workflow v1.4.11.

## MDE left panel 树形菜单应该提供 copy / paste 操作

* copy 目录或者文档 之后可以直接粘贴到其他位置

  * 需要支持 CMD(CTRL) + C, CMD(CTRL) + V

* copy 文档的时候, 需要考虑将文档引用的 .mde 目录同时拷贝到目标目录

  * 如果有一些其他文档的引用路径也需要相应更新成新目录能用的路径

* 右键菜单支持 copy relative path / absolute path

## 优化 left panel

* 如果目录展开状态,再次点击的时候,不应该变成选中状态, 只有收缩状态变成展开状态才能选中

![image.png](.mde/assets/image-1777775082603-21651d3f.png)![image.png](.mde/assets/image-1777774967491-7ca77ea0.png)

* 设置按钮跟theme switch 高度不一致

![image.png](.mde/assets/image-1777774889292-e13d5442.png)

## 系统目录 md copy 支持

* 用户直接从磁盘上面copy目录或者文件夹的时候, 可以直接在MDE 树形菜单选择目标文件夹进行粘贴

* 粘贴MD文档的时候,如果发现有图片相对路径引用, 需要将source的图片也copy到目标目录的 .mde
