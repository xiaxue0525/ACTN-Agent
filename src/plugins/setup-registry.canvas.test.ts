// Covers canvas setup entries in the plugin setup registry.
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ACTAgentConfig } from "../config/types.actagent.js";
import { runPluginSetupConfigMigrations } from "./setup-registry.js";

describe("Canvas setup config migration", () => {
  test("rewrites legacy canvasHost into plugin-owned config", () => {
    const result = runPluginSetupConfigMigrations({
      env: {
        ...process.env,
        ACTAGENT_BUNDLED_PLUGINS_DIR: path.resolve("extensions"),
      },
      config: {
        canvasHost: {
          enabled: false,
          root: "~/legacy-canvas",
          liveReload: false,
        },
      } as ACTAgentConfig,
    });

    expect(result.changes).toEqual(["migrated canvasHost to plugins.entries.canvas.config.host"]);
    expect(result.config).toEqual({
      plugins: {
        entries: {
          canvas: {
            config: {
              host: {
                enabled: false,
                root: "~/legacy-canvas",
                liveReload: false,
              },
            },
          },
        },
      },
    });
  });
});
