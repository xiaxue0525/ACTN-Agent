// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/account-id";
export type { AllowlistMatch } from "actagent/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "actagent/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "actagent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "actagent/plugin-sdk/channel-core";
export { logTypingFailure } from "actagent/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { resolveToolsBySender } from "actagent/plugin-sdk/channel-policy";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "actagent/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "actagent/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsCloudName,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  ACTAgentConfig,
} from "actagent/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "actagent/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "actagent/plugin-sdk/runtime-group-policy";
export { withFileLock } from "actagent/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "actagent/plugin-sdk/channel-outbound";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "actagent/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "actagent/plugin-sdk/channel-inbound";
export { loadOutboundMediaFromUrl } from "actagent/plugin-sdk/outbound-media";
export { buildMediaPayload } from "actagent/plugin-sdk/reply-payload";
export type { ReplyPayload } from "actagent/plugin-sdk/reply-payload";
export type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type { SsrFPolicy } from "actagent/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "actagent/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "actagent/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "actagent/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
