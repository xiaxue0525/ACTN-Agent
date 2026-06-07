// Whatsapp plugin module implements text runtime behavior.
export {
  convertMarkdownTables,
  sanitizeAssistantVisibleText,
  sanitizeAssistantVisibleTextWithProfile,
  stripToolCallXmlTags,
} from "actagent/plugin-sdk/text-chunking";
export { normalizeE164, resolveUserPath, sleep } from "actagent/plugin-sdk/text-utility-runtime";
export {
  assertWebChannel,
  isSelfChatMode,
  jidToE164,
  markdownToWhatsApp,
  resolveJidToE164,
  toWhatsappJid,
  toWhatsappJidWithLid,
  type JidToE164Options,
  type WebChannel,
} from "./targets-runtime.js";
