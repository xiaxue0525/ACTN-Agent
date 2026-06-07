// Telegram plugin module implements bot message dispatch behavior.
export {
  loadSessionStore,
  readLatestAssistantTextFromSessionTranscript,
  resolveAndPersistSessionFile,
  resolveSessionStoreEntry,
  updateSessionStoreEntry,
} from "actagent/plugin-sdk/session-store-runtime";
export { resolveMarkdownTableMode } from "actagent/plugin-sdk/markdown-table-runtime";
export { getAgentScopedMediaLocalRoots } from "actagent/plugin-sdk/media-runtime";
export { resolveChunkMode } from "actagent/plugin-sdk/reply-dispatch-runtime";
export {
  generateTelegramTopicLabel as generateTopicLabel,
  resolveAutoTopicLabelConfig,
} from "./auto-topic-label.js";
