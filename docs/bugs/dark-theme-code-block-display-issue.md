# 在Dark 模式, Code Block 看不清楚 - READY

## Status

* 2026-05-03: Auto-pick started. Reproduced the issue from the provided screenshots and traced it to editor code block syntax highlighting selecting the first loaded Shiki theme (`github-light`) even when the app is using a dark theme. Implementation will keep the existing code block UI and switch the editor highlighter theme from the current app theme family.

* 所有的dark theme, code block 对比度都不正常

![image.png](.mde/assets/image-1777819432077-04f92f63.png)

![image.png](.mde/assets/image-1777819472027-ca9b3fe2.png)

![image.png](.mde/assets/image-1777819566578-1789e8ae.png)
