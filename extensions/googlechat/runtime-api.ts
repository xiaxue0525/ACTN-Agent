// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "actagent/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "actagent/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "actagent/plugin-sdk/channel-contract";
export { missingTargetError } from "actagent/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "actagent/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export { PAIRING_APPROVED_MESSAGE } from "actagent/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export { GoogleChatConfigSchema } from "actagent/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "actagent/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "actagent/plugin-sdk/dangerous-name-runtime";
export {
  readRemoteMediaBuffer,
  resolveChannelMediaMaxBytes,
} from "actagent/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "actagent/plugin-sdk/outbound-media";
export type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "actagent/plugin-sdk/ssrf-runtime";
export type {
  GoogleChatAccountConfig,
  GoogleChatConfig,
} from "actagent/plugin-sdk/config-contracts";
export { extractToolSend } from "actagent/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "actagent/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "actagent/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "actagent/plugin-sdk/webhook-ingress";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "actagent/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "actagent/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
