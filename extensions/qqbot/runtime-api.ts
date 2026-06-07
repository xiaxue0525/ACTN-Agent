// Qqbot API module exposes the plugin public contract.
export type { ChannelPlugin, ACTAgentPluginApi, PluginRuntime } from "actagent/plugin-sdk/core";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type {
  ACTAgentPluginService,
  ACTAgentPluginServiceContext,
  PluginLogger,
} from "actagent/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/bridge/runtime.js";
