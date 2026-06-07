// Browser residue doctor tests cover detection of stale browser state.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ACTAgentConfig } from "../config/types.actagent.js";
import { CORE_HEALTH_CHECKS } from "./doctor-core-checks.js";
import type { HealthRepairContext } from "./health-checks.js";

const browserMocks = vi.hoisted(() => ({
  detectLegacyactagentdBrowserProfileResidue: vi.fn(),
  maybeArchiveLegacyactagentdBrowserProfileResidue: vi.fn(),
  noteChromeMcpBrowserReadiness: vi.fn(),
}));

vi.mock("../commands/doctor-browser.js", () => ({
  detectLegacyactagentdBrowserProfileResidue: browserMocks.detectLegacyactagentdBrowserProfileResidue,
  maybeArchiveLegacyactagentdBrowserProfileResidue:
    browserMocks.maybeArchiveLegacyactagentdBrowserProfileResidue,
  noteChromeMcpBrowserReadiness: browserMocks.noteChromeMcpBrowserReadiness,
}));

const residue = {
  legacyProfileDir: "/tmp/actagent-home/browser/actagentd",
  legacyUserDataDir: "/tmp/actagent-home/browser/actagentd/user-data",
  canonicalUserDataDir: "/tmp/actagent-home/browser/actagent/user-data",
};

function runtime() {
  return { log() {}, error() {}, exit() {} };
}

function requireBrowserResidueCheck() {
  const check = CORE_HEALTH_CHECKS.find(
    (entry) => entry.id === "core/doctor/browser-actagentd-profile-residue",
  );
  if (!check) {
    throw new Error("expected browser actagentd profile residue health check");
  }
  return check;
}

describe("browser actagentd profile residue health check", () => {
  beforeEach(() => {
    browserMocks.detectLegacyactagentdBrowserProfileResidue.mockReset();
    browserMocks.maybeArchiveLegacyactagentdBrowserProfileResidue.mockReset();
    browserMocks.noteChromeMcpBrowserReadiness.mockReset();
  });

  it("reports legacy actagentd profile residue through doctor lint", async () => {
    browserMocks.detectLegacyactagentdBrowserProfileResidue.mockResolvedValueOnce(residue);
    const cfg: ACTAgentConfig = { browser: { profiles: { actagent: { color: "#FF4500" } } } };
    const check = requireBrowserResidueCheck();

    const findings = await check.detect({
      mode: "lint",
      runtime: runtime(),
      cfg,
      configPath: "/tmp/actagent-home/actagent.json",
    });

    expect(browserMocks.detectLegacyactagentdBrowserProfileResidue).toHaveBeenCalledWith(cfg, {
      configDir: "/tmp/actagent-home",
    });
    expect(findings).toEqual([
      expect.objectContaining({
        checkId: "core/doctor/browser-actagentd-profile-residue",
        severity: "warning",
        path: residue.legacyProfileDir,
        ocPath: "oc://state/browser/actagentd",
      }),
    ]);
  });

  it("archives legacy actagentd profile residue through structured repair", async () => {
    browserMocks.detectLegacyactagentdBrowserProfileResidue.mockResolvedValue(residue);
    browserMocks.maybeArchiveLegacyactagentdBrowserProfileResidue.mockResolvedValueOnce({
      changes: ["Archived legacy actagentd managed browser profile residue."],
      warnings: [],
    });
    const cfg: ACTAgentConfig = { browser: { profiles: { actagent: { color: "#FF4500" } } } };
    const check = requireBrowserResidueCheck();
    const ctx: HealthRepairContext = {
      mode: "fix",
      runtime: runtime(),
      cfg,
      configPath: "/tmp/actagent-home/actagent.json",
    };

    const result = await check.repair?.(ctx, []);

    expect(browserMocks.maybeArchiveLegacyactagentdBrowserProfileResidue).toHaveBeenCalledWith(cfg, {
      configDir: "/tmp/actagent-home",
    });
    expect(result).toMatchObject({
      changes: ["Archived legacy actagentd managed browser profile residue."],
      effects: [
        {
          kind: "state",
          action: "archive-legacy-browser-profile-residue",
          target: residue.legacyProfileDir,
          dryRunSafe: false,
        },
      ],
    });
  });

  it("supports dry-run repair without archiving the profile", async () => {
    browserMocks.detectLegacyactagentdBrowserProfileResidue.mockResolvedValue(residue);
    const check = requireBrowserResidueCheck();

    const result = await check.repair?.(
      {
        mode: "fix",
        runtime: runtime(),
        cfg: {},
        configPath: "/tmp/actagent-home/actagent.json",
        dryRun: true,
      },
      [],
    );

    expect(browserMocks.maybeArchiveLegacyactagentdBrowserProfileResidue).not.toHaveBeenCalled();
    expect(result?.changes.join("\n")).toContain("Would archive legacy actagentd");
    expect(result?.effects).toEqual([
      expect.objectContaining({
        action: "would-archive-legacy-browser-profile-residue",
        target: residue.legacyProfileDir,
      }),
    ]);
  });
});
