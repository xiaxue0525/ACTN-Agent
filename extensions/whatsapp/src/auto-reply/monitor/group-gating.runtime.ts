// Whatsapp plugin module implements group gating behavior.
export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "actagent/plugin-sdk/channel-mention-gating";
export { hasControlCommand } from "actagent/plugin-sdk/command-detection";
export { createChannelHistoryWindow } from "actagent/plugin-sdk/reply-history";
export { parseActivationCommand } from "actagent/plugin-sdk/group-activation";
export { normalizeE164 } from "../../text-runtime.js";
