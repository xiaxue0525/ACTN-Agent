// Launchd current service tests cover resolving active macOS service labels.
import { describe, expect, it } from "vitest";
import { isCurrentProcessLaunchdServiceLabel } from "./launchd-current-service.js";

describe("isCurrentProcessLaunchdServiceLabel", () => {
  it("matches launchd-provided service labels", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.actagent.gateway", {
        LAUNCH_JOB_LABEL: "ai.actagent.gateway",
      }),
    ).toBe(true);
  });

  it("falls back to ACTAgent service markers when XPC_SERVICE_NAME is inherited", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.actagent.gateway", {
        XPC_SERVICE_NAME: "0",
        ACTAGENT_SERVICE_MARKER: "actagent",
        ACTAGENT_SERVICE_KIND: "gateway",
        ACTAGENT_LAUNCHD_LABEL: "ai.actagent.gateway",
      }),
    ).toBe(true);
  });

  it("preserves label-only fallback when launchd exposes no label variables", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.actagent.gateway", {
        ACTAGENT_LAUNCHD_LABEL: "ai.actagent.gateway",
      }),
    ).toBe(true);
  });

  it("can require service markers for label-only fallback", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel(
        "ai.actagent.gateway",
        {
          ACTAGENT_LAUNCHD_LABEL: "ai.actagent.gateway",
        },
        { allowConfiguredLabelFallback: false },
      ),
    ).toBe(false);
  });

  it("does not treat unrelated inherited launchd labels as current services", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.actagent.gateway", {
        XPC_SERVICE_NAME: "0",
        ACTAGENT_LAUNCHD_LABEL: "ai.actagent.gateway",
      }),
    ).toBe(false);
  });
});
