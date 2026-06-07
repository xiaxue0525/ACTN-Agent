// State database path helpers resolve shared ACTAgent state DB paths.
import os from "node:os";
import path from "node:path";
import { isMainThread, threadId } from "node:worker_threads";
import { resolveStateDir } from "../config/paths.js";
import { parseStrictNonNegativeInteger } from "../infra/parse-finite-number.js";

/**
 * Path helpers for the shared ACTAgent SQLite state database.
 *
 * Tests get worker-scoped temp state roots unless they explicitly provide
 * `ACTAGENT_STATE_DIR`, which prevents parallel Vitest workers from sharing WAL files.
 */
function resolveACTAgentStateRootDir(env: NodeJS.ProcessEnv): string {
  if (env.ACTAGENT_STATE_DIR?.trim()) {
    return resolveStateDir(env);
  }
  if (env.VITEST || env.NODE_ENV === "test") {
    const workerId = parseStrictNonNegativeInteger(
      env.VITEST_WORKER_ID ?? env.VITEST_POOL_ID ?? "",
    );
    const shardSuffix =
      workerId !== undefined
        ? `${process.pid}-${workerId}`
        : isMainThread
          ? String(process.pid)
          : `${process.pid}-${threadId}`;
    return path.join(os.tmpdir(), "actagent-test-state", shardSuffix);
  }
  return resolveStateDir(env);
}

/** Resolve the directory that contains the shared state SQLite file. */
export function resolveACTAgentStateSqliteDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveACTAgentStateRootDir(env), "state");
}

/** Resolve the shared state SQLite file path. */
export function resolveACTAgentStateSqlitePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveACTAgentStateSqliteDir(env), "actagent.sqlite");
}
