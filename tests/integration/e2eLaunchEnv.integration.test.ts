import { describe, expect, it } from "vitest";

import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  E2E_WINDOW_MODE_ENV,
} from "../../apps/desktop/src/shared/appIdentity";
import { createElectronLaunchEnv } from "../e2e/support/e2eLaunchEnv";

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
});
