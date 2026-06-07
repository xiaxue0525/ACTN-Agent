// Plugin update selection tests cover CLI plugin update target selection.
import { describe, expect, it } from "vitest";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import { resolvePluginUpdateSelection } from "./plugins-update-selection.js";

function createNpmInstall(params: {
  spec: string;
  installPath?: string;
  resolvedName?: string;
}): PluginInstallRecord {
  return {
    source: "npm",
    spec: params.spec,
    installPath: params.installPath ?? "/tmp/plugin",
    ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
  };
}

describe("resolvePluginUpdateSelection", () => {
  it("maps an explicit unscoped npm dist-tag update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "actagent-codex-app-server": createNpmInstall({
            spec: "actagent-codex-app-server",
            installPath: "/tmp/actagent-codex-app-server",
            resolvedName: "actagent-codex-app-server",
          }),
        },
        rawId: "actagent-codex-app-server@beta",
      }),
    ).toEqual({
      pluginIds: ["actagent-codex-app-server"],
      specOverrides: {
        "actagent-codex-app-server": "actagent-codex-app-server@beta",
      },
    });
  });

  it("maps an explicit scoped npm dist-tag update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "voice-call": createNpmInstall({
            spec: "@actagent/voice-call",
            installPath: "/tmp/voice-call",
            resolvedName: "@actagent/voice-call",
          }),
        },
        rawId: "@actagent/voice-call@beta",
      }),
    ).toEqual({
      pluginIds: ["voice-call"],
      specOverrides: {
        "voice-call": "@actagent/voice-call@beta",
      },
    });
  });

  it("maps an explicit npm version update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "actagent-codex-app-server": createNpmInstall({
            spec: "actagent-codex-app-server",
            installPath: "/tmp/actagent-codex-app-server",
            resolvedName: "actagent-codex-app-server",
          }),
        },
        rawId: "actagent-codex-app-server@0.2.0-beta.4",
      }),
    ).toEqual({
      pluginIds: ["actagent-codex-app-server"],
      specOverrides: {
        "actagent-codex-app-server": "actagent-codex-app-server@0.2.0-beta.4",
      },
    });
  });

  it("keeps recorded npm tags when update is invoked by plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "actagent-codex-app-server": createNpmInstall({
            spec: "actagent-codex-app-server@beta",
            installPath: "/tmp/actagent-codex-app-server",
            resolvedName: "actagent-codex-app-server",
          }),
        },
        rawId: "actagent-codex-app-server",
      }),
    ).toEqual({
      pluginIds: ["actagent-codex-app-server"],
    });
  });

  it("maps a bare scoped npm package update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "lossless-actagent": createNpmInstall({
            spec: "@martian-engineering/lossless-actagent@0.9.0",
            installPath: "/tmp/lossless-actagent",
            resolvedName: "@martian-engineering/lossless-actagent",
          }),
        },
        rawId: "@martian-engineering/lossless-actagent",
      }),
    ).toEqual({
      pluginIds: ["lossless-actagent"],
      specOverrides: {
        "lossless-actagent": "@martian-engineering/lossless-actagent",
      },
    });
  });
});
