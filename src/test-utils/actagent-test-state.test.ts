// Tests isolated ACTAgent test-state setup and cleanup behavior.
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPersistedAuthProfileStore } from "../agents/auth-profiles/persisted.js";
import { withEnvAsync } from "./env.js";
import { createACTAgentTestState, withACTAgentTestState } from "./actagent-test-state.js";

async function expectPathMissing(targetPath: string): Promise<void> {
  try {
    await fs.stat(targetPath);
  } catch (error) {
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    return;
  }
  throw new Error(`expected missing path: ${targetPath}`);
}

describe("actagent test state", () => {
  it("creates an isolated home layout with spawn env and restores process env", async () => {
    const previousHome = process.env.HOME;
    const previousACTAgentHome = process.env.ACTAGENT_HOME;
    const previousStateDir = process.env.ACTAGENT_STATE_DIR;
    const previousConfigPath = process.env.ACTAGENT_CONFIG_PATH;

    const state = await createACTAgentTestState({
      label: "unit",
      scenario: "minimal",
    });

    try {
      expect(state.home).toBe(path.join(state.root, "home"));
      expect(state.stateDir).toBe(path.join(state.home, ".actagent"));
      expect(state.configPath).toBe(path.join(state.stateDir, "actagent.json"));
      expect(state.workspaceDir).toBe(path.join(state.home, "workspace"));
      expect(state.env.HOME).toBe(state.home);
      expect(state.env.ACTAGENT_HOME).toBe(state.home);
      expect(state.env.ACTAGENT_STATE_DIR).toBe(state.stateDir);
      expect(state.env.ACTAGENT_CONFIG_PATH).toBe(state.configPath);
      expect(process.env.HOME).toBe(state.home);
      expect(process.env.ACTAGENT_HOME).toBe(state.home);
      expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toStrictEqual({});
    } finally {
      await state.cleanup();
    }

    expect(process.env.HOME).toBe(previousHome);
    expect(process.env.ACTAGENT_HOME).toBe(previousACTAgentHome);
    expect(process.env.ACTAGENT_STATE_DIR).toBe(previousStateDir);
    expect(process.env.ACTAGENT_CONFIG_PATH).toBe(previousConfigPath);
    await expectPathMissing(state.root);
  });

  it("supports state-only layout without overriding HOME", async () => {
    const previousHome = process.env.HOME;

    await withACTAgentTestState(
      {
        layout: "state-only",
        scenario: "empty",
      },
      async (state) => {
        expect(process.env.HOME).toBe(previousHome);
        expect(process.env.ACTAGENT_STATE_DIR).toBe(state.stateDir);
        expect(process.env.ACTAGENT_CONFIG_PATH).toBe(state.configPath);
        expect(state.env.HOME).toBe(previousHome);
        await expectPathMissing(state.configPath);
      },
    );
  });

  it("clears inherited agent-dir overrides by default", async () => {
    await withEnvAsync({ ACTAGENT_AGENT_DIR: "/tmp/outside-actagent-agent" }, async () => {
      const state = await createACTAgentTestState({
        layout: "state-only",
      });

      try {
        expect(process.env.ACTAGENT_AGENT_DIR).toBeUndefined();
        expect(state.env.ACTAGENT_AGENT_DIR).toBeUndefined();
        expect(state.agentDir()).toBe(path.join(state.stateDir, "agents", "main", "agent"));
      } finally {
        await state.cleanup();
      }

      expect(process.env.ACTAGENT_AGENT_DIR).toBe("/tmp/outside-actagent-agent");
    });
  });

  it("allows explicit agent-dir overrides when a test needs them", async () => {
    await withACTAgentTestState(
      {
        env: {
          ACTAGENT_AGENT_DIR: "/tmp/explicit-actagent-agent",
        },
      },
      async (state) => {
        expect(process.env.ACTAGENT_AGENT_DIR).toBe("/tmp/explicit-actagent-agent");
        expect(state.env.ACTAGENT_AGENT_DIR).toBe("/tmp/explicit-actagent-agent");
      },
    );
  });

  it("can route agent-dir env vars to the isolated main agent store", async () => {
    await withACTAgentTestState(
      {
        agentEnv: "main",
      },
      async (state) => {
        expect(process.env.ACTAGENT_AGENT_DIR).toBe(state.agentDir());
        expect(state.env.ACTAGENT_AGENT_DIR).toBe(state.agentDir());
      },
    );
  });

  it("writes scenario configs and auth profile stores", async () => {
    await withACTAgentTestState(
      {
        scenario: "update-stable",
      },
      async (state) => {
        expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toEqual({
          update: {
            channel: "stable",
          },
          plugins: {},
        });

        const profilePath = await state.writeAuthProfiles({
          version: 1,
          profiles: {
            "openai:test": {
              type: "api_key",
              provider: "openai",
              key: "sk-test",
            },
          },
        });

        expect(profilePath).toBe(path.join(state.agentDir(), "actagent-agent.sqlite"));
        const profiles = loadPersistedAuthProfileStore(state.agentDir());
        expect(profiles?.version).toBe(1);
        expect(profiles?.profiles["openai:test"]?.provider).toBe("openai");
      },
    );
  });

  it("creates upgrade survivor fixture state", async () => {
    await withACTAgentTestState(
      {
        scenario: "upgrade-survivor",
      },
      async (state) => {
        const config = JSON.parse(await fs.readFile(state.configPath, "utf8"));
        expect(config.update?.channel).toBe("stable");
        expect(config.plugins?.enabled).toBe(true);
        expect(config.plugins?.allow).toStrictEqual(["discord", "telegram", "whatsapp", "memory"]);
      },
    );
  });

  it("keeps external-service env scoped to the fixture", async () => {
    const previousPolicy = process.env.ACTAGENT_SERVICE_REPAIR_POLICY;

    await withACTAgentTestState(
      {
        scenario: "external-service",
      },
      async (state) => {
        expect(process.env.ACTAGENT_SERVICE_REPAIR_POLICY).toBe("external");
        expect(state.env.ACTAGENT_SERVICE_REPAIR_POLICY).toBe("external");
      },
    );

    expect(process.env.ACTAGENT_SERVICE_REPAIR_POLICY).toBe(previousPolicy);
  });
});
