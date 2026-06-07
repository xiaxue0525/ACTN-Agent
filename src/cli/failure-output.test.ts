// Failure output tests cover CLI error formatting and failure summaries.
import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "actagent", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[actagent] Could not start the CLI.",
      "[actagent] Reason: config file is invalid",
      "[actagent] Debug: set ACTAGENT_DEBUG=1 to include the stack trace.",
      "[actagent] Try: actagent doctor",
      "[actagent] Help: actagent --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { ACTAGENT_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[actagent] The CLI command failed.",
      "[actagent] Reason: boom",
      "[actagent] Stack:",
      "[actagent] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
