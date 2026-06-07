// Qa Channel API module exposes the plugin public contract.
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelGatewayContext,
} from "actagent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "actagent/plugin-sdk/channel-core";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type { PluginRuntime } from "actagent/plugin-sdk/runtime-store";
export {
  buildChannelConfigSchema,
  buildChannelOutboundSessionRoute,
  createChatChannelPlugin,
  defineChannelPluginEntry,
} from "actagent/plugin-sdk/channel-core";
export { jsonResult, readStringParam } from "actagent/plugin-sdk/channel-actions";
export { getChatChannelMeta } from "actagent/plugin-sdk/channel-plugin-common";
export {
  createComputedAccountStatusAdapter,
  createDefaultChannelRuntimeState,
} from "actagent/plugin-sdk/status-helpers";
export { createPluginRuntimeStore } from "actagent/plugin-sdk/runtime-store";
export { createChannelMessageReplyPipeline } from "actagent/plugin-sdk/channel-outbound";
