// Official plugin setup tests cover plugin installation during onboarding.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWizardPrompter } from "../../test/helpers/wizard-prompter.js";
import { createNonExitingRuntime } from "../runtime.js";
import type { WizardMultiSelectParams, WizardPrompter } from "./prompts.js";

const ensureOnboardingPluginInstalled = vi.hoisted(() =>
  vi.fn(async ({ cfg }: { cfg: Record<string, unknown> }) => ({
    cfg,
    installed: true,
    status: "installed",
  })),
);
vi.mock("../commands/onboarding-plugin-install.js", () => ({
  ensureOnboardingPluginInstalled,
}));

import {
  testing,
  resolveOfficialPluginOnboardingInstallEntries,
  setupOfficialPluginInstalls,
} from "./setup.official-plugins.js";

describe("resolveOfficialPluginOnboardingInstallEntries", () => {
  it("lists optional generic official plugins without channel, provider, or search-owned entries", () => {
    const entries = resolveOfficialPluginOnboardingInstallEntries({ config: {} });
    const pluginIds = entries.map((entry) => entry.pluginId);

    expect(pluginIds).toContain("diagnostics-otel");
    expect(pluginIds).toContain("diagnostics-prometheus");
    expect(pluginIds).toContain("acpx");
    expect(pluginIds).toContain("tokenjuice");
    expect(pluginIds).not.toContain("brave");
    expect(pluginIds).not.toContain("codex");
    expect(pluginIds).not.toContain("discord");
  });

  it("hides already configured official plugins", () => {
    const entries = resolveOfficialPluginOnboardingInstallEntries({
      config: {
        plugins: {
          entries: {
            acpx: { enabled: true },
          },
          installs: {
            "diagnostics-otel": {
              source: "npm",
              spec: "@actagent/diagnostics-otel",
              installPath: "/tmp/diagnostics-otel",
            },
          },
        },
      },
    });
    const pluginIds = entries.map((entry) => entry.pluginId);

    expect(pluginIds).not.toContain("acpx");
    expect(pluginIds).not.toContain("diagnostics-otel");
    expect(pluginIds).toContain("diagnostics-prometheus");
  });
});

describe("formatInstallHint", () => {
  it("describes dual-source npm-default installs as npm first", () => {
    expect(
      testing.formatInstallHint({
        actagenthubSpec: "actagenthub:@actagent/diagnostics-otel",
        npmSpec: "@actagent/diagnostics-otel",
        defaultChoice: "npm",
      }),
    ).toBe("npm, with ACTAgentHub fallback");
  });

  it("keeps dual-source actagenthub-default installs ACTAgentHub first", () => {
    expect(
      testing.formatInstallHint({
        actagenthubSpec: "actagenthub:@actagent/diagnostics-otel",
        npmSpec: "@actagent/diagnostics-otel",
        defaultChoice: "actagenthub",
      }),
    ).toBe("ACTAgentHub, with npm fallback");
  });
});

describe("setupOfficialPluginInstalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureOnboardingPluginInstalled.mockImplementation(async ({ cfg }) => ({
      cfg,
      installed: true,
      status: "installed",
    }));
  });

  it("installs selected optional official plugins through the shared onboarding installer", async () => {
    const multiselect = vi.fn(async (_params: WizardMultiSelectParams) => ["diagnostics-otel"]);
    const prompter = createWizardPrompter({
      multiselect: multiselect as unknown as WizardPrompter["multiselect"],
    });
    const runtime = createNonExitingRuntime();

    await setupOfficialPluginInstalls({
      config: {},
      prompter,
      runtime,
      workspaceDir: "/tmp/workspace",
    });

    expect(multiselect).toHaveBeenCalledTimes(1);
    const prompt = multiselect.mock.calls[0]?.[0];
    if (!prompt) {
      throw new Error("expected optional plugin multiselect prompt");
    }
    expect(prompt.message).toBe("Install optional plugins");
    expect(prompt.options[0]).toEqual({
      value: "__skip__",
      label: "Skip for now",
      hint: "Continue without installing optional plugins",
    });
    expect(prompt.options).toEqual(
      expect.arrayContaining([
        {
          value: "acpx",
          label: "ACPX Runtime",
          hint: "ACTAgent ACP runtime backend",
        },
        {
          value: "diagnostics-otel",
          label: "Diagnostics OpenTelemetry",
          hint: "ACTAgent diagnostics OpenTelemetry exporter",
        },
        {
          value: "diagnostics-prometheus",
          label: "Diagnostics Prometheus",
          hint: "ACTAgent diagnostics Prometheus exporter",
        },
        {
          value: "tokenjuice",
          label: "Tokenjuice",
          hint: "ACTAgent tokenjuice exec output compaction plugin",
        },
      ]),
    );
    expect(ensureOnboardingPluginInstalled).toHaveBeenCalledExactlyOnceWith({
      cfg: {},
      entry: {
        pluginId: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        description: "ACTAgent diagnostics OpenTelemetry exporter",
        install: {
          actagenthubSpec: "actagenthub:@actagent/diagnostics-otel",
          npmSpec: "@actagent/diagnostics-otel",
          defaultChoice: "npm",
          minHostVersion: ">=2026.4.25",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
      prompter,
      runtime,
      workspaceDir: "/tmp/workspace",
      promptInstall: false,
    });
  });

  it("does not install when the user skips optional plugins", async () => {
    const prompter = createWizardPrompter({
      multiselect: vi.fn(async () => ["__skip__"]) as WizardPrompter["multiselect"],
    });

    await setupOfficialPluginInstalls({
      config: {},
      prompter,
      runtime: createNonExitingRuntime(),
    });

    expect(ensureOnboardingPluginInstalled).not.toHaveBeenCalled();
  });
});
