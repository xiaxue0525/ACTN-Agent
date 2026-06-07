// Configured Crestodian assistant tests cover config-driven assistant behavior.
import { describe, expect, it, vi } from "vitest";
import { planCrestodianCommandWithConfiguredModel } from "./assistant.js";

describe("Crestodian configured-model planner", () => {
  it("skips the configured model path when no config file exists", async () => {
    const readConfigFileSnapshot = vi.fn(async () => ({
      path: "/tmp/actagent.json",
      exists: false,
      raw: null,
      parsed: {},
      sourceConfig: {},
      resolved: {},
      valid: true,
      runtimeConfig: {},
      config: {},
      issues: [],
      legacyIssues: [],
      warnings: [],
    }));
    const prepareSimpleCompletionModelForAgent = vi.fn();

    await expect(
      planCrestodianCommandWithConfiguredModel({
        input: "please set up my model",
        overview: {
          config: {
            path: "/tmp/actagent.json",
            exists: false,
            valid: true,
            issues: [],
            hash: null,
          },
          agents: [],
          defaultAgentId: "main",
          tools: {
            codex: { command: "codex", found: false },
            claude: { command: "claude", found: false },
            apiKeys: { openai: false, anthropic: false },
          },
          gateway: {
            url: "ws://127.0.0.1:19199",
            source: "local loopback",
            reachable: false,
          },
          references: {
            docsUrl: "https://docs.actagent.ai",
            sourceUrl: "https://github.com/actagent/actagent",
          },
        },
        deps: {
          readConfigFileSnapshot,
          prepareSimpleCompletionModelForAgent,
        },
      }),
    ).resolves.toBeNull();

    expect(prepareSimpleCompletionModelForAgent).not.toHaveBeenCalled();
  });
});
