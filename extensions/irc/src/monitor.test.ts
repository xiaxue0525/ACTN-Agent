// Irc tests cover monitor plugin behavior.
import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#actagent",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#actagent",
      rawTarget: "#actagent",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "actagent-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "actagent-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "actagent-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "actagent-bot",
      rawTarget: "actagent-bot",
    });
  });
});
