# 鼠标在左边panel 移动的时候, 右边Editor 对应行会active 显示成hover 状态 - LOW PRIORITY - READY

## Status

Completed in v1.4.12.

- Fixed the editor block side menu hover leak by showing BlockNote hover controls only while the pointer is over editable editor content, not merely while the editor has focus.
- Added integration coverage for the CSS selector contract and E2E coverage for moving the pointer from an editor-focused document to the Explorer.
- User manual unchanged because this only corrects an incorrect hover visual state and does not change documented workflows.
- Verification: `npm run lint`; `npm run typecheck`; `npm run test:unit`; `npm run test:integration`; `npm run test:e2e`; `npm run test:coverage`; `npm run build`; `npm audit --audit-level=high`; `npx npm@10 ci --dry-run`; GitHub Release workflow v1.4.12.


* 如下图, 鼠标在左边小红框位置移动, 右边的editor 对应行变成 active, 这样是不对的


![image.png](.mde/assets/image-1777803764552-937e88d9.png)
