// STT live audio tests validate live speech-to-text audio fixtures.
import {
  expectACTAgentLiveTranscriptMarker,
  normalizeTranscriptForMatch,
  ACTAGENT_LIVE_TRANSCRIPT_MARKER_RE,
} from "actagent/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common ACTAgent live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Open-actagent integration OK")).toBe("actagentintegrationok");
    expect(normalizeTranscriptForMatch("Testing OpenFlaw realtime transcription")).toMatch(
      /open(?:actagent|flaw)/,
    );
    expect(normalizeTranscriptForMatch("OpenCore xAI realtime transcription")).toMatch(
      ACTAGENT_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("OpenCL xAI realtime transcription")).toMatch(
      ACTAGENT_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectACTAgentLiveTranscriptMarker("OpenClar integration OK");
  });
});
