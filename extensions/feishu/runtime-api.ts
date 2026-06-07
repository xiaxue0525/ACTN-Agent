// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  ACTAgentConfig,
  ACTAgentPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "actagent/plugin-sdk/core";
export type { ACTAgentConfig as ACTAgentBotConfig } from "actagent/plugin-sdk/core";
export type RuntimeEnv = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
};
export type { GroupToolPolicyConfig } from "actagent/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "actagent/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "actagent/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "actagent/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "actagent/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "actagent/plugin-sdk/channel-outbound";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "actagent/plugin-sdk/context-visibility-runtime";
export {
  loadSessionStore,
  resolveSessionStoreEntry,
} from "actagent/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "actagent/plugin-sdk/json-store";
export { normalizeAgentId } from "actagent/plugin-sdk/routing";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "actagent/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
