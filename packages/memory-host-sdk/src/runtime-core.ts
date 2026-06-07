// Focused runtime contract for memory plugin config/state/helpers.

export type { AnyAgentTool } from "./host/actagent-runtime-agent.js";
export { resolveCronStyleNow } from "./host/actagent-runtime-agent.js";
export { DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR } from "./host/actagent-runtime-agent.js";
export { resolveDefaultAgentId, resolveSessionAgentId } from "./host/actagent-runtime-agent.js";
export { resolveMemorySearchConfig } from "./host/actagent-runtime-agent.js";
export {
  asToolParamsRecord,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./host/actagent-runtime-agent.js";
export { SILENT_REPLY_TOKEN } from "./host/actagent-runtime-session.js";
export { parseNonNegativeByteSize } from "./host/actagent-runtime-config.js";
export {
  getRuntimeConfig,
  /** @deprecated Use getRuntimeConfig(), or pass the already loaded config through the call path. */
  loadConfig,
} from "./host/actagent-runtime-config.js";
export { resolveStateDir } from "./host/actagent-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/actagent-runtime-config.js";
export { emptyPluginConfigSchema } from "./host/actagent-runtime-memory.js";
export {
  buildActiveMemoryPromptSection,
  getMemoryCapabilityRegistration,
  listActiveMemoryPublicArtifacts,
} from "./host/actagent-runtime-memory.js";
export { parseAgentSessionKey } from "./host/actagent-runtime-agent.js";
export type { ACTAgentConfig } from "./host/actagent-runtime-config.js";
export type { MemoryCitationsMode } from "./host/actagent-runtime-config.js";
export type {
  MemoryFlushPlan,
  MemoryFlushPlanResolver,
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
  MemoryPluginRuntime,
  MemoryPromptSectionBuilder,
} from "./host/actagent-runtime-memory.js";
export type { ACTAgentPluginApi } from "./host/actagent-runtime-memory.js";
