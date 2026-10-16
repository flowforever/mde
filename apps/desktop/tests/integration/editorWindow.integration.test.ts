import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createEditorWindowTracker,
  createMainWindow,
  createWindowOptions,
} from "../../src/main/index";
import {
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

describe("Editor window lifecycle", () => {

  it("uses the last window mode argument so internal bootstrap arguments win", () => {
    expect(
      getWindowModeFromArgv([
        createWindowModeArgument("automation-center"),
        createWindowModeArgument(EDITOR_WINDOW_MODE),
      ]),
    ).toBe(EDITOR_WINDOW_MODE);
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

  it("finds editor windows by webContents id for workspace launch intents", () => {
    const tracker = createEditorWindowTracker();
    const firstEditorWindow = new FakeBrowserWindow({});
    const secondEditorWindow = new FakeBrowserWindow({});

    tracker.setMainWindow(firstEditorWindow as never);
    tracker.setMainWindow(secondEditorWindow as never);

    expect(
      tracker.getWindowByWebContentsId(firstEditorWindow.webContents.id),
    ).toBe(firstEditorWindow);
    secondEditorWindow.emitOnce("closed");
    expect(
      tracker.getWindowByWebContentsId(secondEditorWindow.webContents.id),
    ).toBeNull();
  });
});


it("creates an editor window with isolated web preferences", async () => {
  const BrowserWindow = createBrowserWindowConstructor();
  const window = asFakeWindow(await createMainWindow(BrowserWindow as never));
  expect(window.options.webPreferences?.additionalArguments).toContain(createWindowModeArgument(EDITOR_WINDOW_MODE));
  expect(createWindowOptions("preload.mjs")).toMatchObject({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  expect(window.loadFile).toHaveBeenCalledWith(join(__dirname, "../../src/renderer/index.html"));
});
