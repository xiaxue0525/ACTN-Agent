// Matrix API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "actagent/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "actagent/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "actagent/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "actagent/plugin-sdk/channel-core";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelOutboundAdapter,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelToolSend,
} from "actagent/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "actagent/plugin-sdk/channel-inbound";
export { logInboundDrop } from "actagent/plugin-sdk/channel-inbound";
export { logTypingFailure } from "actagent/plugin-sdk/channel-outbound";
export { resolveAckReaction } from "actagent/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "actagent/plugin-sdk/setup";
export type {
  ACTAgentConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "actagent/plugin-sdk/config-contracts";
export type { GroupToolPolicyConfig } from "actagent/plugin-sdk/config-contracts";
export type { WizardPrompter } from "actagent/plugin-sdk/setup";
export type { SecretInput } from "actagent/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "actagent/plugin-sdk/runtime-group-policy";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "actagent/plugin-sdk/setup";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  isPrivateOrLoopbackHost,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "actagent/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "actagent/plugin-sdk/channel-inbound";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "actagent/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "actagent/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "actagent/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "actagent/plugin-sdk/channel-outbound";
export { resolveAgentIdFromSessionKey } from "actagent/plugin-sdk/routing";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
export { loadOutboundMediaFromUrl } from "actagent/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "actagent/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "actagent/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "actagent/plugin-sdk/channel-targets";
export { buildTimeoutAbortSignal } from "./matrix/sdk/timeout-abort-signal.js";
export { formatZonedTimestamp } from "actagent/plugin-sdk/time-runtime";
export type { PluginRuntime, RuntimeLogger } from "actagent/plugin-sdk/plugin-runtime";
export type { ReplyPayload } from "actagent/plugin-sdk/reply-runtime";
// resolveMatrixAccountStringValues already comes from the Matrix API barrel.
// Re-exporting auth-precedence here makes TS source loaders define the export twice.
