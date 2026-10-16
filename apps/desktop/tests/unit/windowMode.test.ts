import { describe, expect, it } from 'vitest';
import { getWindowModeFromArgv, isMdeWindowMode } from '../../src/shared/windowMode';

describe('editor-only window modes', () => {
  it('falls back to the editor for the retired mode', () => {
    expect(isMdeWindowMode('automation-center')).toBe(false);
    expect(getWindowModeFromArgv(['--mde-window-mode=automation-center'])).toBe('editor');
    expect(getWindowModeFromArgv(['--mde-window-mode=unknown'])).toBe('editor');
    expect(getWindowModeFromArgv(['--mde-window-mode=editor'])).toBe('editor');
  });
});
