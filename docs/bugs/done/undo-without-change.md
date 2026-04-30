# Fix UNDO clear all content when not making any changes.

## Status

Fixed for release `v1.2.16`.

* Initial Markdown hydration is now applied with `addToHistory=false`, so the first Undo after opening a file no longer reverts the editor to BlockNote's default empty paragraph.
* Added unit coverage for the editor hydration path, integration coverage for the hydration helper, and E2E coverage for pressing Undo before making edits.

## Report

当前刚进入 Editor 不做任何改动, 直接CMD + Z, 会清空所有内容.
