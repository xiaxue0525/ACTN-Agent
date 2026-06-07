// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "actagent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "actagent/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "actagent/plugin-sdk/channel-send-result";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "actagent/plugin-sdk/runtime";
export type { WizardPrompter } from "actagent/plugin-sdk/setup";
