// Telegram plugin module implements auto topic label behavior.
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { generateConversationLabel } from "actagent/plugin-sdk/reply-dispatch-runtime";
export { resolveAutoTopicLabelConfig } from "./auto-topic-label-config.js";

export async function generateTelegramTopicLabel(params: {
  userMessage: string;
  prompt: string;
  cfg: ACTAgentConfig;
  agentId?: string;
  agentDir?: string;
}): Promise<string | null> {
  return await generateConversationLabel({
    ...params,
    maxLength: 128,
  });
}
