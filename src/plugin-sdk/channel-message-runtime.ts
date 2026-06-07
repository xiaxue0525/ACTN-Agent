/**
 * @deprecated Use `actagent/plugin-sdk/channel-outbound`. The outbound subpath
 * contains message lifecycle contracts plus runtime send helpers.
 */

export * from "./channel-outbound.js";

/** @deprecated Use `buildInboundReplyDispatchBase(...)` from `actagent/plugin-sdk/channel-inbound`. */
export { buildChannelMessageReplyDispatchBase } from "./inbound-reply-dispatch.js";
/** @deprecated Use `dispatchChannelInboundReply(...)` or `runPreparedInboundReply(...)` from `actagent/plugin-sdk/channel-inbound`. */
export { dispatchChannelMessageReplyWithBase } from "./inbound-reply-dispatch.js";
/** @deprecated Use `recordChannelMessageReplyDispatch(...)` only from legacy compatibility paths. */
export { recordChannelMessageReplyDispatch } from "./inbound-reply-dispatch.js";
/** @deprecated Use `hasFinalInboundReplyDispatch(...)` from `actagent/plugin-sdk/channel-inbound`. */
export { hasFinalChannelMessageReplyDispatch } from "./inbound-reply-dispatch.js";
/** @deprecated Use `hasVisibleInboundReplyDispatch(...)` from `actagent/plugin-sdk/channel-inbound`. */
export { hasVisibleChannelMessageReplyDispatch } from "./inbound-reply-dispatch.js";
/** @deprecated Use `resolveInboundReplyDispatchCounts(...)` from `actagent/plugin-sdk/channel-inbound`. */
export { resolveChannelMessageReplyDispatchCounts } from "./inbound-reply-dispatch.js";
/** @deprecated Use `createChannelMessageReplyPipeline(...)` from `actagent/plugin-sdk/channel-outbound`. */
export { createChannelTurnReplyPipeline } from "./channel-message.js";
/** @deprecated Use `deliverInboundReplyWithMessageSendContext(...)` from `actagent/plugin-sdk/channel-outbound`. */
export { deliverDurableInboundReplyPayload } from "./channel-message.js";
