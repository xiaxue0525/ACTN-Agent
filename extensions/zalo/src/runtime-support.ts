// Zalo plugin module implements runtime support behavior.
export type { ReplyPayload } from "actagent/plugin-sdk/reply-runtime";
export type { ACTAgentConfig, GroupPolicy } from "actagent/plugin-sdk/config-contracts";
export type { MarkdownTableMode } from "actagent/plugin-sdk/config-contracts";
export type { BaseTokenResolution } from "actagent/plugin-sdk/channel-contract";
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "actagent/plugin-sdk/channel-contract";
export type { SecretInput } from "actagent/plugin-sdk/secret-input";
export type { ChannelPlugin, PluginRuntime, WizardPrompter } from "actagent/plugin-sdk/core";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type { OutboundReplyPayload } from "actagent/plugin-sdk/reply-payload";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  formatPairingApproveHint,
  jsonResult,
  normalizeAccountId,
  readStringParam,
  resolveClientIp,
} from "actagent/plugin-sdk/core";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  buildSingleChannelSecretPromptState,
  mergeAllowFromEntries,
  migrateBaseNameToDefaultAccount,
  promptSingleChannelSecretInput,
  runSingleChannelSecretStep,
  setTopLevelChannelDmPolicyWithAllowFrom,
} from "actagent/plugin-sdk/setup";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "actagent/plugin-sdk/secret-input";
export {
  buildTokenChannelStatusSummary,
  PAIRING_APPROVED_MESSAGE,
} from "actagent/plugin-sdk/channel-status";
export { buildBaseAccountStatusSnapshot } from "actagent/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
export {
  formatAllowFromLowercase,
  isNormalizedSenderAllowed,
} from "actagent/plugin-sdk/allow-from";
export { addWildcardAllowFrom } from "actagent/plugin-sdk/setup";
export { resolveOpenProviderRuntimeGroupPolicy } from "actagent/plugin-sdk/runtime-group-policy";
export {
  warnMissingProviderGroupPolicyFallbackOnce,
  resolveDefaultGroupPolicy,
} from "actagent/plugin-sdk/runtime-group-policy";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export { logTypingFailure } from "actagent/plugin-sdk/channel-feedback";
export {
  deliverTextOrMediaReply,
  isNumericTargetId,
  sendPayloadWithChunkedTextAndMedia,
} from "actagent/plugin-sdk/reply-payload";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "actagent/plugin-sdk/inbound-envelope";
export { waitForAbortSignal } from "actagent/plugin-sdk/runtime";
export {
  applyBasicWebhookRequestGuards,
  createFixedWindowRateLimiter,
  createWebhookAnomalyTracker,
  readJsonWebhookBodyOrReject,
  registerPluginHttpRoute,
  registerWebhookTarget,
  registerWebhookTargetWithPluginRoute,
  resolveWebhookPath,
  resolveWebhookTargetWithAuthOrRejectSync,
  WEBHOOK_ANOMALY_COUNTER_DEFAULTS,
  WEBHOOK_RATE_LIMIT_DEFAULTS,
  withResolvedWebhookRequestPipeline,
} from "actagent/plugin-sdk/webhook-ingress";
export type {
  RegisterWebhookPluginRouteOptions,
  RegisterWebhookTargetOptions,
} from "actagent/plugin-sdk/webhook-ingress";
