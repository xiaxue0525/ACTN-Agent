// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/actagent-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/actagent-runtime-agent.js";
export { parseDurationMs } from "./host/actagent-runtime-config.js";
export { loadConfig } from "./host/actagent-runtime-config.js";
export { resolveStateDir } from "./host/actagent-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/actagent-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/actagent-runtime-config.js";
export { root } from "./host/actagent-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/actagent-runtime-io.js";
export { detectMime } from "./host/actagent-runtime-io.js";
export { resolveGlobalSingleton } from "./host/actagent-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/actagent-runtime-session.js";
export { splitShellArgs } from "./host/actagent-runtime-io.js";
export { runTasksWithConcurrency } from "./host/actagent-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/actagent-runtime-io.js";
export type { ACTAgentConfig } from "./host/actagent-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/actagent-runtime-config.js";
export type { SecretInput } from "./host/actagent-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/actagent-runtime-config.js";
export type { MemorySearchConfig } from "./host/actagent-runtime-config.js";
