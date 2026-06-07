// ACTAgent Performance Workflow tests cover actagent performance workflow script behavior.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const WORKFLOW = ".github/workflows/actagent-performance.yml";

type WorkflowStep = {
  name?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
};

type WorkflowJob = {
  steps?: WorkflowStep[];
};

type Workflow = {
  jobs?: Record<string, WorkflowJob>;
};

function readWorkflow(): Workflow {
  return parse(readFileSync(WORKFLOW, "utf8")) as Workflow;
}

function findStep(name: string): WorkflowStep {
  const steps = readWorkflow().jobs?.kova?.steps ?? [];
  const step = steps.find((candidate) => candidate.name === name);
  expect(step).toBeDefined();
  return step as WorkflowStep;
}

describe("ACTAgent performance workflow", () => {
  it("uses the actagentgrit reports token for every report repo push path", () => {
    const prepare = findStep("Prepare actagentgrit reports checkout");
    const publish = findStep("Publish to actagentgrit reports");

    expect(prepare.env?.actagentgrit_REPORTS_TOKEN).toBe("${{ secrets.actagentgrit_REPORTS_TOKEN }}");
    expect(publish.env?.actagentgrit_REPORTS_TOKEN).toBe("${{ secrets.actagentgrit_REPORTS_TOKEN }}");
    expect(prepare.run).toContain(
      'remote add origin "https://x-access-token:${actagentgrit_REPORTS_TOKEN}@github.com/actagent/actagentgrit-reports.git"',
    );
    expect(publish.run).toContain(
      'remote set-url origin "https://x-access-token:${actagentgrit_REPORTS_TOKEN}@github.com/actagent/actagentgrit-reports.git"',
    );
    expect(publish.run).toContain('git -C "$reports_root" push origin HEAD:main');
  });

  it("keeps optional actagentgrit report publishing bounded", () => {
    const prepare = findStep("Prepare actagentgrit reports checkout");
    const publish = findStep("Publish to actagentgrit reports");

    expect(prepare.run).toContain('echo "ready=false" >> "$GITHUB_OUTPUT"');
    expect(prepare.run).toContain("timeout 60s git");
    expect(prepare.run).toContain("timeout 120s git");
    expect(prepare.run).toContain('echo "ready=true" >> "$GITHUB_OUTPUT"');
    expect(publish.if).toContain("steps.actagentgrit_reports.outputs.ready == 'true'");
    expect(publish.run).toContain("timeout 120s git");
  });
});
