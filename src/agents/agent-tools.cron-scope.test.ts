/**
 * Tests cron-triggered tool assembly.
 * Ensures cron runs scope cron tool behavior to self-removal of the current
 * job only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createACTAgentToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./actagent-tools.js", () => ({
  createACTAgentTools: (options: unknown) => {
    mocks.createACTAgentToolsOptions(options);
    return [mocks.stubTool("cron")];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createACTAgentCodingTools } from "./agent-tools.js";

function firstACTAgentToolsOptions(): { cronSelfRemoveOnlyJobId?: string } | undefined {
  return mocks.createACTAgentToolsOptions.mock.calls[0]?.[0] as
    | { cronSelfRemoveOnlyJobId?: string }
    | undefined;
}

describe("createACTAgentCodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createACTAgentToolsOptions.mockClear();
  });

  it("scopes cron-triggered jobs to self-removal", () => {
    const tools = createACTAgentCodingTools({
      trigger: "cron",
      jobId: "job-current",
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(firstACTAgentToolsOptions()?.cronSelfRemoveOnlyJobId).toBe("job-current");
  });

  it("does not scope non-cron sessions", () => {
    createACTAgentCodingTools({
      trigger: "user",
      jobId: "job-current",
    });

    expect(firstACTAgentToolsOptions()?.cronSelfRemoveOnlyJobId).toBeUndefined();
  });
});
