// Slack tests cover inbound context.contract plugin behavior.
import { expectChannelInboundContextContract } from "actagent/plugin-sdk/channel-contract-testing";
import type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
import { createTempHomeEnv } from "actagent/plugin-sdk/test-env";
import { describe, it } from "vitest";
import {
  createInboundSlackTestContext,
  prepareSlackMessage,
} from "../inbound-contract-test-api.js";
import type { ResolvedSlackAccount } from "./accounts.js";
import type { SlackMessageEvent } from "./types.js";

function createSlackAccount(config: ResolvedSlackAccount["config"] = {}): ResolvedSlackAccount {
  return {
    accountId: "default",
    enabled: true,
    botTokenSource: "config",
    appTokenSource: "config",
    userTokenSource: "none",
    config,
    replyToMode: config.replyToMode,
    replyToModeByChatType: config.replyToModeByChatType,
    dm: config.dm,
  } as ResolvedSlackAccount;
}

function createSlackMessage(overrides: Partial<SlackMessageEvent>): SlackMessageEvent {
  return {
    type: "message",
    channel: "D123",
    channel_type: "im",
    user: "U1",
    text: "hi",
    ts: "1.000",
    ...overrides,
  };
}

describe("Slack inbound context contract", () => {
  it("keeps inbound context finalized", async () => {
    const tempHome = await createTempHomeEnv("actagent-slack-inbound-contract-");
    try {
      const ctx = createInboundSlackTestContext({
        cfg: {
          channels: { slack: { enabled: true } },
        } as ACTAgentConfig,
      });
      ctx.resolveUserName = async () => ({ name: "Alice" }) as never;

      const prepared = await prepareSlackMessage({
        ctx,
        account: createSlackAccount(),
        message: createSlackMessage({}),
        opts: { source: "message" },
      });

      if (!prepared) {
        throw new Error("expected slack message to prepare an inbound context payload");
      }
      expectChannelInboundContextContract(prepared.ctxPayload);
    } finally {
      await tempHome.restore();
    }
  });
});
