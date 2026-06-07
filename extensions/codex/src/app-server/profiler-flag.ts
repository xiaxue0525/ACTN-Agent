/**
 * Resolves whether Codex app-server profiling instrumentation is enabled by
 * ACTAgent diagnostic flags.
 */
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { isDiagnosticFlagEnabled } from "actagent/plugin-sdk/diagnostic-runtime";

const PROFILER_FLAGS = ["profiler", "codex.profiler"] as const;

/** Checks the generic and Codex-specific profiler diagnostic flags. */
export function isCodexAppServerProfilerEnabled(
  config?: ACTAgentConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return PROFILER_FLAGS.some((flag) => isDiagnosticFlagEnabled(flag, config, env));
}
