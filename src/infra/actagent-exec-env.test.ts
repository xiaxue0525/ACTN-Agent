// Tests ACTAgent execution environment construction.
import { describe, expect, it } from "vitest";
import {
  ensureACTAgentExecMarkerOnProcess,
  markACTAgentExecEnv,
  ACTAGENT_CLI_ENV_VALUE,
  ACTAGENT_CLI_ENV_VAR,
} from "./actagent-exec-env.js";

describe("markACTAgentExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", ACTAGENT_CLI: "0" };
    const marked = markACTAgentExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      ACTAGENT_CLI: ACTAGENT_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.ACTAGENT_CLI).toBe("0");
  });
});

describe("ensureACTAgentExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [ACTAGENT_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureACTAgentExecMarkerOnProcess(env)).toBe(env);
    expect(env[ACTAGENT_CLI_ENV_VAR]).toBe(ACTAGENT_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[ACTAGENT_CLI_ENV_VAR];
    delete process.env[ACTAGENT_CLI_ENV_VAR];

    try {
      expect(ensureACTAgentExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[ACTAGENT_CLI_ENV_VAR]).toBe(ACTAGENT_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[ACTAGENT_CLI_ENV_VAR];
      } else {
        process.env[ACTAGENT_CLI_ENV_VAR] = previous;
      }
    }
  });
});
