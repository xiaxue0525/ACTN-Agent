// Whatsapp API module exposes the plugin public contract.
export { resolveIdentityNamePrefix } from "actagent/plugin-sdk/agent-runtime";
export { formatInboundEnvelope } from "actagent/plugin-sdk/channel-inbound";
export { resolveInboundSessionEnvelopeContext } from "actagent/plugin-sdk/channel-inbound";
export { toLocationContext } from "actagent/plugin-sdk/channel-inbound";
export {
  createChannelMessageReplyPipeline,
  resolveChannelMessageSourceReplyDeliveryMode,
} from "actagent/plugin-sdk/channel-outbound";
export {
  isControlCommandMessage,
  shouldComputeCommandAuthorized,
} from "actagent/plugin-sdk/command-detection";
export { resolveChannelContextVisibilityMode } from "../config.runtime.js";
export { getAgentScopedMediaLocalRoots } from "actagent/plugin-sdk/media-runtime";
export type LoadConfigFn = typeof import("../config.runtime.js").getRuntimeConfig;
export {
  buildHistoryContextFromEntries,
  type HistoryEntry,
} from "actagent/plugin-sdk/reply-history";
export { resolveSendableOutboundReplyParts } from "actagent/plugin-sdk/reply-payload";
export {
  dispatchReplyWithBufferedBlockDispatcher,
  finalizeInboundContext,
  resolveChunkMode,
  resolveTextChunkLimit,
  type getReplyFromConfig,
  type ReplyPayload,
} from "actagent/plugin-sdk/reply-runtime";
export {
  resolveInboundLastRouteSessionKey,
  type resolveAgentRoute,
} from "actagent/plugin-sdk/routing";
export { logVerbose, shouldLogVerbose, type getChildLogger } from "actagent/plugin-sdk/runtime-env";
export { resolvePinnedMainDmOwnerFromAllowlist } from "actagent/plugin-sdk/security-runtime";
export { resolveMarkdownTableMode } from "actagent/plugin-sdk/markdown-table-runtime";
export { jidToE164, normalizeE164 } from "../../text-runtime.js";
