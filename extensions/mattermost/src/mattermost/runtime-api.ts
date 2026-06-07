// Mattermost API module exposes the plugin public contract.
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChatType,
  HistoryEntry,
  ACTAgentConfig,
  ACTAgentPluginApi,
  ReplyPayload,
} from "actagent/plugin-sdk/core";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export { buildAgentMediaPayload } from "actagent/plugin-sdk/agent-media-payload";
export { resolveAllowlistMatchSimple } from "actagent/plugin-sdk/allow-from";
export { logInboundDrop } from "actagent/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export { logTypingFailure } from "actagent/plugin-sdk/channel-feedback";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
} from "actagent/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "actagent/plugin-sdk/models-provider-runtime";
export { isDangerousNameMatchingEnabled } from "actagent/plugin-sdk/dangerous-name-runtime";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "actagent/plugin-sdk/runtime-group-policy";
export { resolveChannelMediaMaxBytes } from "actagent/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "actagent/plugin-sdk/outbound-media";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildInboundHistoryFromMap,
  buildPendingHistoryContextFromMap,
  recordPendingHistoryEntryIfEnabled,
} from "actagent/plugin-sdk/reply-history";
export { registerPluginHttpRoute } from "actagent/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "actagent/plugin-sdk/webhook-ingress";
export {
  isTrustedProxyAddress,
  parseStrictPositiveInteger,
  resolveClientIp,
} from "actagent/plugin-sdk/core";
export { parseTcpPort } from "actagent/plugin-sdk/number-runtime";
