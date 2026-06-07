// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "actagent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "actagent/plugin-sdk/channel-core";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "actagent/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "actagent/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "actagent/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "actagent/plugin-sdk/channel-status";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "actagent/plugin-sdk/channel-outbound";
export { resolveControlCommandGate } from "actagent/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "actagent/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "actagent/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "actagent/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "actagent/plugin-sdk/channel-inbound";
