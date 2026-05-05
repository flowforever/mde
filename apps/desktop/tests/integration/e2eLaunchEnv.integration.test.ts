import { describe, expect, it } from "vitest";

import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  E2E_WINDOW_MODE_ENV,
} from "../../src/shared/appIdentity";
import { createElectronLaunchEnv } from "../e2e/support/e2eLaunchEnv";
import { createElectronBuildCommand } from "../e2e/support/electronApp";

describe("E2E launch environment", () => {
  it("injects hidden E2E window mode by default", () => {
    const env = createElectronLaunchEnv({
      baseEnv: { PATH: "/bin" },
      e2eUserDataPath: "/tmp/mde-e2e-user-data",
      overrideEnv: {},
    });

    expect(env[CAPTURE_STARTUP_DIAGNOSTICS_ENV]).toBe("1");
    expect(env[DISABLE_SINGLE_INSTANCE_ENV]).toBe("1");
    expect(env[E2E_USER_DATA_PATH_ENV]).toBe("/tmp/mde-e2e-user-data");
    expect(env[E2E_WINDOW_MODE_ENV]).toBe("hidden");
    expect(env.PATH).toBe("/bin");
  });

  it("allows explicit E2E window mode overrides", () => {
    const env = createElectronLaunchEnv({
      baseEnv: { [E2E_WINDOW_MODE_ENV]: "hidden" },
      e2eUserDataPath: "/tmp/mde-e2e-user-data",
      overrideEnv: { [E2E_WINDOW_MODE_ENV]: "visible" },
    });

    expect(env[E2E_WINDOW_MODE_ENV]).toBe("visible");
  });

  it("filters Electron variables that make Playwright launch Electron as Node", () => {
    const env = createElectronLaunchEnv({
      baseEnv: {
        ELECTRON_RUN_AS_NODE: "1",
        PATH: "/bin",
      },
      e2eUserDataPath: "/tmp/mde-e2e-user-data",
      overrideEnv: {
        ELECTRON_RUN_AS_NODE: "1",
      },
    });

    expect(env).not.toHaveProperty("ELECTRON_RUN_AS_NODE");
    expect(env.PATH).toBe("/bin");
  });
});

describe("E2E build command", () => {
  it("uses pnpm to build the Electron app", () => {
    expect(
      createElectronBuildCommand({
        npm_execpath: "/Users/test/.local/share/pnpm/pnpm.cjs",
      })
    ).toEqual({
      command: process.execPath,
      args: ["/Users/test/.local/share/pnpm/pnpm.cjs", "run", "build"],
    });
  });

  it("falls back to the pnpm executable when npm_execpath is unavailable", () => {
    expect(createElectronBuildCommand({})).toEqual({
      command: "pnpm",
      args: ["run", "build"],
    });
  });
});
