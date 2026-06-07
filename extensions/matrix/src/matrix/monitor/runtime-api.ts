// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "actagent/plugin-sdk/channel-inbound";
export type { PluginRuntime, RuntimeLogger } from "actagent/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "actagent/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "actagent/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "actagent/plugin-sdk/channel-outbound";
export { formatLocationText, toLocationContext } from "actagent/plugin-sdk/channel-inbound";
export { getAgentScopedMediaLocalRoots } from "actagent/plugin-sdk/agent-media-payload";
export { logInboundDrop } from "actagent/plugin-sdk/channel-inbound";
export { logTypingFailure } from "actagent/plugin-sdk/channel-outbound";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "actagent/plugin-sdk/channel-targets";
