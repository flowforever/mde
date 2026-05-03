# 自动修复MD文档里面失效的图片 - READY

## Status

Auto-pick started on 2026-05-03. Autonomy gate passed: existing MDE image paste behavior stores assets beside the Markdown file in `.mde/assets`, so the conservative repair is to copy missing referenced assets from another workspace `.mde/assets` location into the current document's asset directory when a unique match is found, then surface a non-blocking status message.

当用打开一个被挪动过位置的MD文档的时候, 原来引用 .mde 目录的相对路径可能会失效.

* 实现一个高性能的解决方案,在打开文档的时候, 一次性把失效的图片资源从原来的.mde 目录找出来,并且替换掉.

* 不要影响文档的打开速度

* 替换完成之后, 用一个不打扰用户的方式提示, 失效的图片资源已经修复
