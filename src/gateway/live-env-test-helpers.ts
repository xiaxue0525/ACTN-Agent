/**
 * Environment snapshot helpers for live gateway tests.
 */
const COMMON_LIVE_ENV_NAMES = [
  "ACTAGENT_AGENT_RUNTIME",
  "ACTAGENT_CONFIG_PATH",
  "ACTAGENT_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "ACTAGENT_SKIP_BROWSER_CONTROL_SERVER",
  "ACTAGENT_SKIP_CANVAS_HOST",
  "ACTAGENT_SKIP_CHANNELS",
  "ACTAGENT_SKIP_CRON",
  "ACTAGENT_SKIP_GMAIL_WATCHER",
  "ACTAGENT_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

/** Captures live-test environment variables so tests can restore them later. */
export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

/** Restores a previously captured live-test environment snapshot. */
export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
