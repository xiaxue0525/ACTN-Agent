// Activation name tests cover wake/activation name normalization for talk mode.
import { describe, expect, it } from "vitest";
import {
  isSupportedRealtimeVoiceActivationName,
  matchRealtimeVoiceActivationName,
  normalizeRealtimeVoiceActivationNamePrefix,
  normalizeSupportedRealtimeVoiceActivationName,
  sortRealtimeVoiceActivationNames,
} from "./activation-name.js";

describe("realtime voice activation names", () => {
  it("normalizes and validates one- or two-word activation names", () => {
    expect(normalizeSupportedRealtimeVoiceActivationName("  ACTAgent  ")).toBe("actagent");
    expect(normalizeSupportedRealtimeVoiceActivationName("Open actagent")).toBe("open actagent");
    expect(normalizeSupportedRealtimeVoiceActivationName("actagent Bot Helper")).toBeUndefined();
    expect(isSupportedRealtimeVoiceActivationName("actagent Bot")).toBe(true);
    expect(isSupportedRealtimeVoiceActivationName("actagent Bot Helper")).toBe(false);
    expect(normalizeRealtimeVoiceActivationNamePrefix("actagent Bot Helper")).toBe("actagent Bot");
  });

  it("matches and strips leading exact activation names", () => {
    expect(matchRealtimeVoiceActivationName("Hey, Molty, ship it", ["molty"])).toEqual({
      allowed: true,
      activationName: "molty",
      edge: "leading",
      heardName: "molty",
      match: "exact",
      text: "ship it",
    });
  });

  it("matches and strips trailing exact activation names", () => {
    expect(matchRealtimeVoiceActivationName("ship it, actagent Bot", ["actagent bot"])).toEqual({
      allowed: true,
      activationName: "actagent bot",
      edge: "trailing",
      heardName: "actagent bot",
      match: "exact",
      text: "ship it",
    });
  });

  it("accepts bounded fuzzy matches at the transcript edge", () => {
    expect(matchRealtimeVoiceActivationName("Malty, what changed?", ["molty"])).toMatchObject({
      allowed: true,
      activationName: "molty",
      edge: "leading",
      heardName: "malty",
      match: "fuzzy",
      text: "what changed?",
    });
    expect(matchRealtimeVoiceActivationName("what changed, Malty?", ["molty"])).toMatchObject({
      allowed: true,
      activationName: "molty",
      edge: "trailing",
      heardName: "malty",
      match: "fuzzy",
      text: "what changed",
    });
    expect(matchRealtimeVoiceActivationName("what changed, Marty?", ["molty"])).toMatchObject({
      allowed: true,
      activationName: "molty",
      edge: "trailing",
      heardName: "marty",
      match: "fuzzy",
      text: "what changed",
    });
  });

  it("does not accept fuzzy trailing matches in ambient speech", () => {
    expect(
      matchRealtimeVoiceActivationName("I miss the nonsensical German ranting from Multy.", [
        "molty",
      ]),
    ).toBeUndefined();
    expect(matchRealtimeVoiceActivationName("I agree, mostly.", ["molty"])).toBeUndefined();
    expect(matchRealtimeVoiceActivationName("the room is damp, moldy.", ["molty"])).toBeUndefined();
    expect(matchRealtimeVoiceActivationName("the room is damp, moldy?", ["molty"])).toBeUndefined();
    expect(matchRealtimeVoiceActivationName("what changed, Malty.", ["molty"])).toBeUndefined();
  });

  it("does not fuzzy match inside a larger phrase without an edge boundary", () => {
    expect(matchRealtimeVoiceActivationName("maltiness is not a wake name", ["molty"])).toBe(
      undefined,
    );
  });

  it("prefers longer activation names first", () => {
    expect(sortRealtimeVoiceActivationNames(["actagent", "actagent bot", "actagent"])).toEqual([
      "actagent bot",
      "actagent",
      "actagent",
    ]);
    expect(matchRealtimeVoiceActivationName("actagent Bot, status", ["actagent", "actagent bot"])).toEqual({
      allowed: true,
      activationName: "actagent bot",
      edge: "leading",
      heardName: "actagent bot",
      match: "exact",
      text: "status",
    });
  });
});
