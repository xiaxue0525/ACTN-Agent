// Matrix tests cover device health plugin behavior.
import { describe, expect, it } from "vitest";
import { isACTAgentManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects ACTAgent-managed device names", () => {
    expect(isACTAgentManagedMatrixDevice("ACTAgent Gateway")).toBe(true);
    expect(isACTAgentManagedMatrixDevice("ACTAgent Debug")).toBe(true);
    expect(isACTAgentManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isACTAgentManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale ACTAgent-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "ACTAgent Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "ACTAgent Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "ACTAgent Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary).toEqual({
      currentDeviceId: "du314Zpw3A",
      currentACTAgentDevices: [
        {
          deviceId: "du314Zpw3A",
          displayName: "ACTAgent Gateway",
          current: true,
        },
      ],
      staleACTAgentDevices: [
        {
          deviceId: "BritdXC6iL",
          displayName: "ACTAgent Gateway",
          current: false,
        },
        {
          deviceId: "G6NJU9cTgs",
          displayName: "ACTAgent Debug",
          current: false,
        },
      ],
    });
  });
});
