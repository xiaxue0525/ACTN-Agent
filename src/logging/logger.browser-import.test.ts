// Logger browser import tests cover safe import behavior in browser-like runtimes.
import { importFreshModule } from "actagent/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredACTAgentTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredACTAgentTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredACTAgentTmpDir =
    params?.resolvePreferredACTAgentTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredACTAgentTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-actagent-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-actagent-dir.js")>(
      "../infra/tmp-actagent-dir.js",
    );
    return {
      ...actual,
      resolvePreferredACTAgentTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredACTAgentTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-actagent-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredACTAgentTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredACTAgentTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/actagent");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/actagent/actagent.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredACTAgentTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toStrictEqual({
      level: "silent",
      file: "/tmp/actagent/actagent.log",
      maxFileBytes: 100 * 1024 * 1024,
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(module.getLogger().info("browser-safe")).toBeUndefined();
    expect(resolvePreferredACTAgentTmpDir).not.toHaveBeenCalled();
  });
});
