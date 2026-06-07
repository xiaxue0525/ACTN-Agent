// Mattermost API module exposes the plugin public contract.
export { createAccountStatusSink } from "actagent/plugin-sdk/channel-outbound";
export type { ChannelPlugin } from "actagent/plugin-sdk/core";
export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/core";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
