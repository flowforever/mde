# Failed to check and remind upgrade

* 我使用 1.2.2 版本的时候, 线上有1.2.11 新版本, 我重启 MDE, 刷新MDE 都没有提示我新版本.

* 手动安装 1.2.11, 线上新版本 1.2.13 可以检测到并提示

## 下载新版本弹出安装界面之后应该退出当前APP 避免影响用户安装新版本

## Fix

* macOS update check should not depend on GitHub `/releases/latest` returning
  the highest semantic version. Fetch the releases feed and choose the highest
  non-prerelease semver release so older clients are not blocked by GitHub
  latest pointer ordering.

* After the DMG is downloaded and opened, quit the current app process so the
  user can replace `MDE.app` without the running app blocking installation.
