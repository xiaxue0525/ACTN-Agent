// Imessage API module exposes the plugin public contract.
import { formatTrimmedAllowFromEntries } from "actagent/plugin-sdk/channel-config-helpers";
import { PAIRING_APPROVED_MESSAGE } from "actagent/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
} from "actagent/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "actagent/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "actagent/plugin-sdk/status-helpers";
import { normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "actagent/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
};

export type { ChannelPlugin };
