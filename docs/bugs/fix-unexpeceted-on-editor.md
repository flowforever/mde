# 鼠标在左边panel 移动的时候, 右边Editor 对应行会active 显示成hover 状态 - LOW PRIORITY - READY

## Status

In development: reproducing the editor side-menu hover leak when the editor remains focused and the pointer moves over the left panel. Assumption: the expected behavior is that editor block hover controls only appear while the pointer is over the editor content, not merely because the editor has focus.


* 如下图, 鼠标在左边小红框位置移动, 右边的editor 对应行变成 active, 这样是不对的


![image.png](.mde/assets/image-1777803764552-937e88d9.png)

