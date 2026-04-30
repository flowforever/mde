# Failed to check and remind upgrade

## Status

Fixed and released in `v1.2.14`.

* Update checks now read the GitHub releases feed and select the highest non-prerelease semver version instead of relying on `/releases/latest`.
* macOS DMG downloads now open the installer and quit the running app so `MDE.app` can be replaced.
* The installed-app AI CLI PATH regression found during the same fix cycle was also fixed in `v1.2.14`.
* Added unit coverage for semver release selection, app quit behavior after opening the DMG, and GUI-launched AI CLI PATH resolution.

## Report

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
