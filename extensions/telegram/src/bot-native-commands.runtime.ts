// Telegram plugin module implements bot native commands behavior.
export {
  ensureConfiguredBindingRouteReady,
  recordInboundSessionMetaSafe,
} from "actagent/plugin-sdk/conversation-runtime";
export { getAgentScopedMediaLocalRoots } from "actagent/plugin-sdk/media-runtime";
export {
  executePluginCommand,
  getPluginCommandSpecs,
  matchPluginCommand,
} from "actagent/plugin-sdk/plugin-runtime";
export {
  finalizeInboundContext,
  resolveChunkMode,
} from "actagent/plugin-sdk/reply-dispatch-runtime";
export { resolveThreadSessionKeys } from "actagent/plugin-sdk/routing";
export { getSessionEntry } from "actagent/plugin-sdk/session-store-runtime";
