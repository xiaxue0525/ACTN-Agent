// Tests shared utility helpers used by CLI and runtime modules.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "./shared/number-coercion.js";
import { withTempDir } from "./test-helpers/temp-dir.js";
import { withEnv } from "./test-utils/env.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "actagent-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps oversized sleep delays before scheduling", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const promise = sleep(Number.MAX_SAFE_INTEGER);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);

      vi.advanceTimersByTime(MAX_TIMER_TIMEOUT_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.actagent when legacy dir is missing", async () => {
    await withTempDir({ prefix: "actagent-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".actagent");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands ACTAGENT_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/actagent-home",
      ACTAGENT_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/actagent-home", "state"));
  });

  it("falls back to the config file directory when only ACTAGENT_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/actagent-home",
      ACTAGENT_CONFIG_PATH: "~/profiles/dev/actagent.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/actagent-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers ACTAGENT_HOME over HOME", () => {
    withEnv({ ACTAGENT_HOME: "/srv/actagent-home", HOME: "/home/other" }, () => {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/actagent-home"));
    });
  });
});

describe("shortenHomePath", () => {
  it("uses $ACTAGENT_HOME prefix when ACTAGENT_HOME is set", () => {
    withEnv({ ACTAGENT_HOME: "/srv/actagent-home", HOME: "/home/other" }, () => {
      expect(shortenHomePath(`${path.resolve("/srv/actagent-home")}/.actagent/actagent.json`)).toBe(
        "$ACTAGENT_HOME/.actagent/actagent.json",
      );
    });
  });
});

describe("shortenHomeInString", () => {
  it("uses $ACTAGENT_HOME replacement when ACTAGENT_HOME is set", () => {
    withEnv({ ACTAGENT_HOME: "/srv/actagent-home", HOME: "/home/other" }, () => {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/actagent-home")}/.actagent/actagent.json`,
        ),
      ).toBe("config: $ACTAGENT_HOME/.actagent/actagent.json");
    });
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/actagent", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "actagent"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers ACTAGENT_HOME for tilde expansion", () => {
    withEnv({ ACTAGENT_HOME: "/srv/actagent-home", HOME: "/home/other" }, () => {
      expect(resolveUserPath("~/actagent")).toBe(path.resolve("/srv/actagent-home", "actagent"));
    });
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/actagent-home",
      ACTAGENT_HOME: "/srv/actagent-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/actagent", env)).toBe(path.resolve("/srv/actagent-home", "actagent"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
