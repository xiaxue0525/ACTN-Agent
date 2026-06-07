// Telegram plugin module implements bot message context.session behavior.
export { buildChannelInboundEventContext } from "actagent/plugin-sdk/channel-inbound";
export { readSessionUpdatedAt, resolveStorePath } from "actagent/plugin-sdk/session-store-runtime";
export { recordInboundSession } from "actagent/plugin-sdk/conversation-runtime";
export { resolveInboundLastRouteSessionKey } from "actagent/plugin-sdk/routing";
export { resolvePinnedMainDmOwnerFromAllowlist } from "actagent/plugin-sdk/security-runtime";
