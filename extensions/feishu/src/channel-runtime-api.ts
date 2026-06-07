// Feishu API module exposes the plugin public contract.
export type {
  ChannelMessageActionName,
  ChannelMeta,
  ChannelPlugin,
  ACTAgentBotConfig,
} from "../runtime-api.js";

export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/account-resolution";
export { createActionGate } from "actagent/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "actagent/plugin-sdk/channel-config-primitives";
export {
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "actagent/plugin-sdk/status-helpers";
export { PAIRING_APPROVED_MESSAGE } from "actagent/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";
