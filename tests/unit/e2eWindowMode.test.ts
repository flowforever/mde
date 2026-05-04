import { describe, expect, it, vi } from "vitest";

import { E2E_WINDOW_MODE_ENV } from "../../src/shared/appIdentity";
import {
  applyReadyToShowWindowMode,
  parseE2EWindowMode,
  resolveReadyToShowWindowAction,
} from "../../src/main/e2eWindowMode";

describe("E2E window mode", () => {
  it("parses supported modes and defaults unknown E2E values to hidden", () => {
    expect(parseE2EWindowMode(undefined)).toBeNull();
    expect(parseE2EWindowMode("")).toBeNull();
    expect(parseE2EWindowMode("hidden")).toBe("hidden");
    expect(parseE2EWindowMode("visible")).toBe("visible");
    expect(parseE2EWindowMode("inactive")).toBe("inactive");
    expect(parseE2EWindowMode("unexpected")).toBe("hidden");
  });

  it("keeps production windows visible when no E2E mode is present", () => {
    expect(resolveReadyToShowWindowAction({})).toBe("show");
  });

  it("maps E2E modes to the ready-to-show window action", () => {
    expect(
      resolveReadyToShowWindowAction({ [E2E_WINDOW_MODE_ENV]: "hidden" }),
    ).toBe("none");
    expect(
      resolveReadyToShowWindowAction({ [E2E_WINDOW_MODE_ENV]: "visible" }),
    ).toBe("show");
    expect(
      resolveReadyToShowWindowAction({ [E2E_WINDOW_MODE_ENV]: "inactive" }),
    ).toBe("showInactive");
  });

  it("applies ready-to-show actions without showing hidden E2E windows", () => {
    const window = {
      show: vi.fn(),
      showInactive: vi.fn(),
    };

    applyReadyToShowWindowMode(window, { [E2E_WINDOW_MODE_ENV]: "hidden" });
    expect(window.show).not.toHaveBeenCalled();
    expect(window.showInactive).not.toHaveBeenCalled();

    applyReadyToShowWindowMode(window, { [E2E_WINDOW_MODE_ENV]: "inactive" });
    expect(window.showInactive).toHaveBeenCalledTimes(1);

    applyReadyToShowWindowMode(window, { [E2E_WINDOW_MODE_ENV]: "visible" });
    expect(window.show).toHaveBeenCalledTimes(1);
  });
});
