// Nostr API module exposes the plugin public contract.
export {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  type ChannelPlugin,
} from "actagent/plugin-sdk/channel-plugin-common";
export type { ChannelOutboundAdapter } from "actagent/plugin-sdk/channel-contract";
export {
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "actagent/plugin-sdk/status-helpers";
