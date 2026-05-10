import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createAutomationCenterWindowManager,
  createEditorWindowTracker,
  createMainWindow,
  createWindowOptions,
} from "../../src/main/index";
import {
  AUTOMATION_CENTER_WINDOW_MODE,
  EDITOR_WINDOW_MODE,
  getWindowModeFromArgv,
  WINDOW_MODE_ARGUMENT_PREFIX,
} from "../../src/shared/windowMode";

interface FakeBrowserWindowOptions {
  readonly webPreferences?: {
    readonly additionalArguments?: readonly string[];
  };
}

class FakeBrowserWindow {
  static nextWebContentsId = 1;

  readonly close = vi.fn();
  readonly focus = vi.fn();
  readonly loadFile = vi.fn(() => Promise.resolve());
  readonly loadURL = vi.fn(() => Promise.resolve());
  readonly restore = vi.fn();
  readonly webContents = { id: FakeBrowserWindow.nextWebContentsId++ };
  readonly options: FakeBrowserWindowOptions;
  private readonly eventHandlers = new Map<string, () => void>();
  private readonly onceHandlers = new Map<string, () => void>();
  private minimized = false;

  constructor(options: FakeBrowserWindowOptions) {
    this.options = options;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  once(eventName: string, handler: () => void): void {
    this.onceHandlers.set(eventName, handler);
  }

  on(eventName: string, handler: () => void): void {
    this.eventHandlers.set(eventName, handler);
  }

  emit(eventName: string): void {
    this.eventHandlers.get(eventName)?.();
  }

  emitOnce(eventName: string): void {
    this.onceHandlers.get(eventName)?.();
    this.onceHandlers.delete(eventName);
  }
}

const createBrowserWindowConstructor = () =>
  vi.fn((options: FakeBrowserWindowOptions) => new FakeBrowserWindow(options));

const asFakeWindow = (window: unknown): FakeBrowserWindow =>
  window as FakeBrowserWindow;

const createWindowModeArgument = (windowMode: string): string =>
  `${WINDOW_MODE_ARGUMENT_PREFIX}${windowMode}`;

describe("Automation Center window lifecycle", () => {
  it("passes explicit window mode bootstrap arguments", () => {
    expect(
      createWindowOptions("preload.mjs", AUTOMATION_CENTER_WINDOW_MODE)
        .webPreferences?.additionalArguments,
    ).toContain(createWindowModeArgument(AUTOMATION_CENTER_WINDOW_MODE));
    expect(
      createWindowOptions("preload.mjs", EDITOR_WINDOW_MODE).webPreferences
        ?.additionalArguments,
    ).toContain(createWindowModeArgument(EDITOR_WINDOW_MODE));
  });

  it("uses the last window mode argument so internal bootstrap arguments win", () => {
    expect(
      getWindowModeFromArgv([
        createWindowModeArgument(AUTOMATION_CENTER_WINDOW_MODE),
        createWindowModeArgument(EDITOR_WINDOW_MODE),
      ]),
    ).toBe(EDITOR_WINDOW_MODE);
  });

  it("creates one Automation Center window and focuses it on later opens", async () => {
    const BrowserWindow = createBrowserWindowConstructor();
    const manager = createAutomationCenterWindowManager(
      BrowserWindow as never,
    );

    const firstWindow = asFakeWindow(
      await manager.openOrFocusAutomationCenterWindow(),
    );
    const secondWindow = asFakeWindow(
      await manager.openOrFocusAutomationCenterWindow(),
    );

    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(secondWindow).toBe(firstWindow);
    expect(firstWindow?.focus).toHaveBeenCalledTimes(1);
    expect(
      firstWindow.options.webPreferences?.additionalArguments,
    ).toContain(createWindowModeArgument(AUTOMATION_CENTER_WINDOW_MODE));
  });

  it("reopens Automation Center after the previous Automation Center window closes", async () => {
    const BrowserWindow = createBrowserWindowConstructor();
    const manager = createAutomationCenterWindowManager(
      BrowserWindow as never,
    );

    const firstWindow = asFakeWindow(
      await manager.openOrFocusAutomationCenterWindow(),
    );
    firstWindow.emitOnce("closed");
    const secondWindow = asFakeWindow(
      await manager.openOrFocusAutomationCenterWindow(),
    );

    expect(BrowserWindow).toHaveBeenCalledTimes(2);
    expect(secondWindow).not.toBe(firstWindow);
  });

  it("keeps editor windows in editor mode while Automation Center uses its own mode", async () => {
    const BrowserWindow = createBrowserWindowConstructor();
    const editorWindow = asFakeWindow(await createMainWindow(BrowserWindow as never));
    const manager = createAutomationCenterWindowManager(
      BrowserWindow as never,
    );
    const automationWindow = asFakeWindow(
      await manager.openOrFocusAutomationCenterWindow(),
    );

    expect(
      editorWindow.options.webPreferences?.additionalArguments,
    ).toContain(createWindowModeArgument(EDITOR_WINDOW_MODE));
    expect(
      automationWindow.options.webPreferences?.additionalArguments,
    ).toContain(createWindowModeArgument(AUTOMATION_CENTER_WINDOW_MODE));
    expect(editorWindow.close).not.toHaveBeenCalled();
    expect(editorWindow.loadFile).toHaveBeenCalledWith(
      join(__dirname, "../../src/renderer/index.html"),
    );
  });

  it("tracks the main window from editor windows only", () => {
    const tracker = createEditorWindowTracker();
    const firstEditorWindow = new FakeBrowserWindow({});
    const secondEditorWindow = new FakeBrowserWindow({});
    const openEditorWindow = vi.fn(() =>
      Promise.resolve(new FakeBrowserWindow({}) as never),
    );

    tracker.setMainWindow(firstEditorWindow as never);
    tracker.setMainWindow(secondEditorWindow as never);
    secondEditorWindow.emitOnce("closed");

    expect(tracker.getMainWindow()).toBe(firstEditorWindow);
    firstEditorWindow.emitOnce("closed");
    tracker.focusOrCreateMainWindow(openEditorWindow);

    expect(tracker.getMainWindow()).toBeNull();
    expect(openEditorWindow).toHaveBeenCalledTimes(1);
  });

  it("updates the main editor window when an existing editor window is focused", () => {
    const tracker = createEditorWindowTracker();
    const firstEditorWindow = new FakeBrowserWindow({});
    const secondEditorWindow = new FakeBrowserWindow({});

    tracker.setMainWindow(firstEditorWindow as never);
    tracker.setMainWindow(secondEditorWindow as never);
    firstEditorWindow.emit("focus");
    secondEditorWindow.emitOnce("closed");

    expect(tracker.getMainWindow()).toBe(firstEditorWindow);
  });

  it("does not close or reload the editor window when Automation Center closes", async () => {
    const BrowserWindow = createBrowserWindowConstructor();
    const editorWindow = asFakeWindow(await createMainWindow(BrowserWindow as never));
    const manager = createAutomationCenterWindowManager(
      BrowserWindow as never,
    );
    const automationWindow = asFakeWindow(
      await manager.openOrFocusAutomationCenterWindow(),
    );

    automationWindow.emitOnce("closed");

    expect(editorWindow.close).not.toHaveBeenCalled();
    expect(editorWindow.loadFile).toHaveBeenCalledTimes(1);
  });
});
