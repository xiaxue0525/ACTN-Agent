// Googlechat plugin module implements group policy behavior.
import { resolveChannelGroupRequireMention } from "actagent/plugin-sdk/channel-policy";
import type { ACTAgentConfig } from "actagent/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: ACTAgentConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
