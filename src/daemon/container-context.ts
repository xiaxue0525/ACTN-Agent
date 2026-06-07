/** Detects whether a daemon was launched by ACTAgent's container-aware service wrapper. */
import { normalizeOptionalString } from "@actagent/normalization-core/string-coerce";

/** Resolves the daemon container hint exposed by managed service environments. */
export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return (
    normalizeOptionalString(env.ACTAGENT_CONTAINER_HINT) ||
    normalizeOptionalString(env.ACTAGENT_CONTAINER) ||
    null
  );
}
