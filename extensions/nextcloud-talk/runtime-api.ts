// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "actagent/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "actagent/plugin-sdk/channel-contract";
export { logInboundDrop } from "actagent/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  ACTAgentConfig,
} from "actagent/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "actagent/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export type { OutboundReplyPayload } from "actagent/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "actagent/plugin-sdk/reply-payload";
export type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type { SecretInput } from "actagent/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "actagent/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
