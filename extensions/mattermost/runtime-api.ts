// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  ACTAgentConfig,
  ACTAgentPluginApi,
  PluginRuntime,
} from "actagent/plugin-sdk/core";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type { ReplyPayload } from "actagent/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "actagent/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "actagent/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "actagent/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "actagent/plugin-sdk/channel-status";
export { createAccountStatusSink } from "actagent/plugin-sdk/channel-outbound";
export { buildAgentMediaPayload } from "actagent/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "actagent/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "actagent/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "actagent/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "actagent/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "actagent/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "actagent/plugin-sdk/channel-inbound";
export { logInboundDrop } from "actagent/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export { logTypingFailure } from "actagent/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "actagent/plugin-sdk/outbound-media";
export { rawDataToString } from "actagent/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "actagent/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "actagent/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "actagent/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "actagent/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "actagent/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "actagent/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "actagent/plugin-sdk/media-runtime";
export { normalizeProviderId } from "actagent/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
