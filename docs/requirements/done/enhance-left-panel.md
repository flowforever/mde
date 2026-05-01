# 优化Left Panel

* Refresh 按钮应该跟其他按钮放同一行

* 去掉rename, delete 按钮

* 每一个目录的 context menu 应该要有 new folder, new file 两个菜单

* 右键菜单应该都要有相应的图标, 现有只有文字

* 右键删除确认操作的 popover 应该显示在对应的 目录或者文件附近 不要固定在顶部

* 限制一下 recent files 总数20个

## Done

- Released in `v1.3.2`.
- Explorer toolbar now keeps new Markdown file, new folder, hidden-entry toggle, and refresh actions on one compact row.
- Rename and delete are available from row context menus instead of the top toolbar.
- Directory context menus now include new Markdown file and new folder actions.
- Context-menu actions use icons.
- Delete confirmation opens near the target row, is clamped inside the viewport, and closes on scroll, resize, or Escape.
- Recent workspace files are capped at 20 and covered through app-shell hydration.
- Verified with `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, and `npm run build`.
- GitHub Release `v1.3.2` completed for macOS arm64/x64 and Windows x64 artifacts.
