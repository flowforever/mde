import { describe, expect, it, vi } from 'vitest'

import { createEditorApi } from '../../src/preload/editorApi'

describe('drop open preload integration', () => {
  it('exposes Electron webUtils file path resolution for dropped files', () => {
    const droppedFile = new File(['# External'], 'external.md', {
      type: 'text/markdown'
    })
    const webUtils = {
      getPathForFile: vi.fn().mockReturnValue('/external/external.md')
    }
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    }

    const editorApi = createEditorApi(ipcRenderer, webUtils)

    expect(editorApi.getDroppedFilePath?.(droppedFile)).toBe(
      '/external/external.md'
    )
    expect(webUtils.getPathForFile).toHaveBeenCalledWith(droppedFile)
  })

  it('ignores retired flow launches and keeps normal file and workspace launch events', () => {
    const ipcRenderer = { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const api = createEditorApi(ipcRenderer, { getPathForFile: vi.fn() });
    const callback = vi.fn();
    const dispose = api.onLaunchPath(callback);
    const [channel, listener] = ipcRenderer.on.mock.calls[0] as [string, (event: unknown, resource: unknown) => void];
    listener({}, { type: 'workspace-automation-flows', workspaceRoot: '/workspace' });
    expect(callback).not.toHaveBeenCalled();
    listener({}, '/workspace');
    listener({}, { type: 'workspace-file', workspaceRoot: '/workspace', filePath: 'README.md' });
    expect(callback.mock.calls).toEqual([
      ['/workspace'], [{ type: 'workspace-file', workspaceRoot: '/workspace', filePath: 'README.md' }],
    ]);
    dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(channel, listener);
  });

})
