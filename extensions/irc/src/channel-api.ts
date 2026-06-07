// Irc API module exposes the plugin public contract.
export { createAccountStatusSink } from "actagent/plugin-sdk/channel-outbound";
export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/account-id";
export type { ChannelPlugin } from "actagent/plugin-sdk/channel-core";
export { PAIRING_APPROVED_MESSAGE } from "actagent/plugin-sdk/channel-status";
export { buildBaseChannelStatusSummary } from "actagent/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
