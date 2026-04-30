# Support multi themes

## Status

Completed and released.

* Initial multi-theme support shipped in `v1.2.7`.
* Final 8 dark / 16 light theme matrix, colorway rows, light-panel and dark-panel light variants, and headerless picker shipped in `v1.2.11`.
* The release added unit and E2E coverage for theme counts, persistence, follow-system selection behavior, OS appearance switching, and picker layout.

## Requirement

* 使用 $huashu 开发8款 dark theme, 16款light theme

  * light theme 中需要有8套主题的 left panel 也是浅色系

  * light theme 中需要有8套主题的 left panel 是深色系

  * 主题按8个色系组织, 同色系的 dark / 浅左栏 light / 深左栏 light 在选择器同一行

  * 主题选择器只显示色系行和主题项, 不显示 table header

* 使用 $huashu 设计 在左边panel 底部放置 切换主题toggle

  * 跟随系统就根据系统当前 dark light 去切换上次用户使用过的 light, dark theme, 如果是第一次使用的用户则默认选中第一套 dark, light

  * 跟随系统时, 主题选择按钮仍然可用, 但只能选择当前系统对应的 light 或 dark theme, 选择后不退出 follow system

    * 如果当前系统是 light, 可以在浅左栏 light 和深左栏 light 两列中选择

  * 不跟系统, 则旁边有个按钮类似选择工作区那样 打开弹窗 选中主题 使用 $huashu 设计
