// Slack API module exposes the plugin public contract.
export {
  buildComputedAccountStatusSnapshot,
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromRequiredCredentialStatuses,
} from "actagent/plugin-sdk/channel-status";
export { buildChannelConfigSchema, SlackConfigSchema } from "../config-api.js";
export type { ChannelMessageActionContext } from "actagent/plugin-sdk/channel-contract";
export { DEFAULT_ACCOUNT_ID } from "actagent/plugin-sdk/account-id";
export type {
  ChannelPlugin,
  ACTAgentPluginApi,
  PluginRuntime,
} from "actagent/plugin-sdk/channel-plugin-common";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type { SlackAccountConfig } from "actagent/plugin-sdk/config-contracts";
export {
  emptyPluginConfigSchema,
  formatPairingApproveHint,
} from "actagent/plugin-sdk/channel-plugin-common";
export { loadOutboundMediaFromUrl } from "actagent/plugin-sdk/outbound-media";
export { looksLikeSlackTargetId, normalizeSlackMessagingTarget } from "./target-parsing.js";
export { getChatChannelMeta } from "./channel-api.js";
export {
  createActionGate,
  imageResultFromFile,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringParam,
  withNormalizedTimestamp,
} from "actagent/plugin-sdk/channel-actions";
