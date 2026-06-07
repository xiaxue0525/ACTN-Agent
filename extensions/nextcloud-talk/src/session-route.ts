// Nextcloud Talk plugin module implements session route behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { buildOutboundBaseSessionKey } from "actagent/plugin-sdk/routing";
import { stripNextcloudTalkTargetPrefix } from "./normalize.js";

type NextcloudTalkOutboundSessionRouteParams = {
  cfg: ACTAgentConfig;
  agentId: string;
  accountId?: string | null;
  target: string;
};

export function resolveNextcloudTalkOutboundSessionRoute(
  params: NextcloudTalkOutboundSessionRouteParams,
) {
  const roomId = stripNextcloudTalkTargetPrefix(params.target);
  if (!roomId) {
    return null;
  }
  const baseSessionKey = buildOutboundBaseSessionKey({
    cfg: params.cfg,
    agentId: params.agentId,
    channel: "nextcloud-talk",
    accountId: params.accountId,
    peer: {
      kind: "group",
      id: roomId,
    },
  });
  return {
    sessionKey: baseSessionKey,
    baseSessionKey,
    peer: {
      kind: "group" as const,
      id: roomId,
    },
    chatType: "group" as const,
    from: `nextcloud-talk:room:${roomId}`,
    to: `nextcloud-talk:${roomId}`,
  };
}
