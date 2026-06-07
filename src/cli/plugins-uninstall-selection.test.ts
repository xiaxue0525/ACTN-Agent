// Plugin uninstall selection tests cover CLI uninstall target matching.
import { describe, expect, it } from "vitest";
import type { ACTAgentConfig } from "../config/config.js";
import { resolvePluginUninstallId } from "./plugins-uninstall-selection.js";

describe("resolvePluginUninstallId", () => {
  it("accepts the recorded ACTAgentHub spec as an uninstall target", () => {
    const result = resolvePluginUninstallId({
      rawId: "actagenthub:linkmind-context",
      config: {
        plugins: {
          entries: {
            "linkmind-context": { enabled: true },
          },
          installs: {
            "linkmind-context": {
              source: "npm",
              spec: "actagenthub:linkmind-context",
              actagenthubPackage: "linkmind-context",
            },
          },
        },
      } as ACTAgentConfig,
      plugins: [{ id: "linkmind-context", name: "linkmind-context" }],
    });

    expect(result.pluginId).toBe("linkmind-context");
  });

  it("accepts a versionless ACTAgentHub spec when the install was pinned", () => {
    const result = resolvePluginUninstallId({
      rawId: "actagenthub:linkmind-context",
      config: {
        plugins: {
          entries: {
            "linkmind-context": { enabled: true },
          },
          installs: {
            "linkmind-context": {
              source: "npm",
              spec: "actagenthub:linkmind-context@1.2.3",
            },
          },
        },
      } as ACTAgentConfig,
      plugins: [{ id: "linkmind-context", name: "linkmind-context" }],
    });

    expect(result.pluginId).toBe("linkmind-context");
  });
});
