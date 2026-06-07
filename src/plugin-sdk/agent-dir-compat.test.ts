/**
 * Tests agent directory compatibility helpers.
 */
import { describe, expect, it } from "vitest";
import { resolveACTAgentAgentDir } from "./agent-dir-compat.js";

describe("resolveACTAgentAgentDir", () => {
  it("keeps the shipped Pi env alias for deprecated plugin SDK callers", () => {
    expect(
      resolveACTAgentAgentDir({
        PI_CODING_AGENT_DIR: "/tmp/actagent-legacy-agent",
      }),
    ).toBe("/tmp/actagent-legacy-agent");
  });

  it("prefers the ACTAgent env override over the deprecated Pi alias", () => {
    expect(
      resolveACTAgentAgentDir({
        ACTAGENT_AGENT_DIR: "/tmp/actagent-agent",
        PI_CODING_AGENT_DIR: "/tmp/actagent-legacy-agent",
      }),
    ).toBe("/tmp/actagent-agent");
  });
});
