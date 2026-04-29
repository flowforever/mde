export const WORKSPACE_CHANNELS = Object.freeze({
  consumeLaunchPath: 'workspace:consume-launch-path',
  launchPath: 'workspace:launch-path',
  listDirectory: 'workspace:list-directory',
  openFile: 'workspace:open-file',
  openFileByPath: 'workspace:open-file-by-path',
  openPath: 'workspace:open-path',
  openWorkspace: 'workspace:open',
  openWorkspaceByPath: 'workspace:open-by-path'
})

export const FILE_CHANNELS = Object.freeze({
  createFolder: 'file:create-folder',
  createMarkdownFile: 'file:create-markdown',
  deleteEntry: 'file:delete-entry',
  readMarkdownFile: 'file:read-markdown',
  renameEntry: 'file:rename-entry',
  saveImageAsset: 'file:save-image-asset',
  writeMarkdownFile: 'file:write-markdown'
})
