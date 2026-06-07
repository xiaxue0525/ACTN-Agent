// ACTAgentHub skills tests cover install/update/detail/status flows, security
// verdicts, local skill cards, and workspace skill status reports.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callGatewayHandler } from "./skills.test-helpers.js";

const loadConfigMock = vi.fn(() => ({}));
const resolveDefaultAgentIdMock = vi.fn(() => "main");
const resolveAgentWorkspaceDirMock = vi.fn(() => "/tmp/workspace");
const buildWorkspaceSkillStatusMock = vi.fn();
const readLocalSkillCardContentSyncMock = vi.fn();
const fetchACTAgentHubSkillSecurityVerdictsMock = vi.fn();
const installSkillFromACTAgentHubMock = vi.fn();
const installSkillMock = vi.fn();
const updateSkillsFromACTAgentHubMock = vi.fn();

vi.mock("../../config/config.js", () => ({
  getRuntimeConfig: () => loadConfigMock(),
  writeConfigFile: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentIds: vi.fn(() => ["main"]),
  resolveAgentConfig: vi.fn(() => undefined),
  resolveDefaultAgentId: () => resolveDefaultAgentIdMock(),
  resolveAgentWorkspaceDir: () => resolveAgentWorkspaceDirMock(),
  resolveSessionAgentId: vi.fn(() => undefined),
}));

vi.mock("../../skills/lifecycle/actagenthub.js", () => ({
  installSkillFromACTAgentHub: (...args: unknown[]) => installSkillFromACTAgentHubMock(...args),
  readLocalSkillCardContentSync: (...args: unknown[]) => readLocalSkillCardContentSyncMock(...args),
  updateSkillsFromACTAgentHub: (...args: unknown[]) => updateSkillsFromACTAgentHubMock(...args),
}));

vi.mock("../../skills/discovery/status.js", () => ({
  buildWorkspaceSkillStatus: (...args: unknown[]) => buildWorkspaceSkillStatusMock(...args),
}));

vi.mock("../../skills/lifecycle/install.js", () => ({
  installSkill: (...args: unknown[]) => installSkillMock(...args),
}));

vi.mock("../../infra/actagenthub.js", () => ({
  fetchACTAgentHubSkillDetail: vi.fn(),
  fetchACTAgentHubSkillSecurityVerdicts: (...args: unknown[]) =>
    fetchACTAgentHubSkillSecurityVerdictsMock(...args),
  resolveACTAgentHubBaseUrl: () => "https://actagenthub.ai",
}));

const { skillsHandlers } = await import("./skills.js");

type SkillsHandlerName = keyof typeof skillsHandlers;

function emptySkillStatusReport() {
  return {
    workspaceDir: "/tmp/workspace",
    managedSkillsDir: "/tmp/actagent/skills",
    skills: [],
  };
}

async function callSkillsHandler(method: SkillsHandlerName, params: Record<string, unknown>) {
  return callGatewayHandler(skillsHandlers, method, params);
}

function expectEmptySecurityVerdicts(response: unknown): void {
  expect(response).toEqual({
    schema: "actagent.skills.security-verdicts.v1",
    items: [],
  });
}

async function expectEmptySecurityVerdictsWithoutFetch(): Promise<void> {
  const { ok, response, error } = await callSkillsHandler("skills.securityVerdicts", {});

  expect(error).toBeUndefined();
  expect(ok).toBe(true);
  expect(fetchACTAgentHubSkillSecurityVerdictsMock).not.toHaveBeenCalled();
  expectEmptySecurityVerdicts(response);
}

describe("skills gateway handlers (actagenthub)", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    resolveDefaultAgentIdMock.mockReset();
    resolveAgentWorkspaceDirMock.mockReset();
    buildWorkspaceSkillStatusMock.mockReset();
    readLocalSkillCardContentSyncMock.mockReset();
    fetchACTAgentHubSkillSecurityVerdictsMock.mockReset();
    installSkillFromACTAgentHubMock.mockReset();
    installSkillMock.mockReset();
    updateSkillsFromACTAgentHubMock.mockReset();

    loadConfigMock.mockReturnValue({});
    resolveDefaultAgentIdMock.mockReturnValue("main");
    resolveAgentWorkspaceDirMock.mockReturnValue("/tmp/workspace");
    buildWorkspaceSkillStatusMock.mockReturnValue(emptySkillStatusReport());
  });

  it("returns an empty verdict batch without calling ACTAgentHub when no skills are linked", async () => {
    await expectEmptySecurityVerdictsWithoutFetch();
  });

  it("fetches one bulk ACTAgentHub verdict batch for linked installed skills", async () => {
    buildWorkspaceSkillStatusMock.mockReturnValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/actagent/skills",
      skills: [
        {
          name: "agentreceipt",
          skillKey: "agentreceipt",
          actagenthub: {
            status: "linked",
            valid: true,
            registry: "https://actagenthub.ai",
            slug: "agentreceipt",
            installedVersion: "1.2.3",
            installedAt: 123,
          },
        },
        {
          name: "local-only",
          skillKey: "local-only",
        },
      ],
    });
    fetchACTAgentHubSkillSecurityVerdictsMock.mockResolvedValue({
      schema: "actagenthub.skill.security-verdicts.v1",
      items: [
        {
          ok: true,
          decision: "pass",
          reasons: [],
          requestedSlug: "agentreceipt",
          slug: "agentreceipt",
          requestedVersion: "1.2.3",
          version: "1.2.3",
          securityAuditUrl: "https://actagenthub.ai/actagent/agentreceipt/security-audit?version=1.2.3",
          security: { status: "clean", passed: true },
          scannerPayload: { ignored: true },
        },
      ],
    });

    const { ok, response, error } = await callSkillsHandler("skills.securityVerdicts", {});

    expect(error).toBeUndefined();
    expect(fetchACTAgentHubSkillSecurityVerdictsMock).toHaveBeenCalledTimes(1);
    expect(fetchACTAgentHubSkillSecurityVerdictsMock).toHaveBeenCalledWith({
      baseUrl: "https://actagenthub.ai",
      items: [{ slug: "agentreceipt", version: "1.2.3" }],
      skipAuth: true,
    });
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    expect(response).toEqual({
      schema: "actagent.skills.security-verdicts.v1",
      items: [
        expect.objectContaining({
          registry: "https://actagenthub.ai",
          ok: true,
          requestedSlug: "agentreceipt",
          requestedVersion: "1.2.3",
          securityStatus: "clean",
          securityPassed: true,
        }),
      ],
    });
    expect(JSON.stringify(response)).not.toContain("scannerPayload");
    expect(JSON.stringify(response)).not.toContain('"security":');
  });

  it("does not passively fetch verdicts from a non-default registry", async () => {
    buildWorkspaceSkillStatusMock.mockReturnValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/actagent/skills",
      skills: [
        {
          name: "agentreceipt",
          skillKey: "agentreceipt",
          actagenthub: {
            status: "linked",
            valid: true,
            registry: "http://127.0.0.1:3999",
            slug: "agentreceipt",
            installedVersion: "1.2.3",
            installedAt: 123,
          },
        },
      ],
    });

    await expectEmptySecurityVerdictsWithoutFetch();
  });

  it("loads local Skill Card content for a known installed skill", async () => {
    buildWorkspaceSkillStatusMock.mockReturnValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/actagent/skills",
      skills: [
        {
          name: "AgentReceipt",
          skillKey: "agentreceipt",
          baseDir: "/tmp/workspace/skills/agentreceipt",
          skillCard: {
            present: true,
            path: "/tmp/workspace/skills/agentreceipt/skill-card.md",
            sizeBytes: 34,
          },
        },
      ],
    });
    readLocalSkillCardContentSyncMock.mockReturnValue("# AgentReceipt\n\nLocal trust card.\n");

    const { ok, response, error } = await callSkillsHandler("skills.skillCard", {
      skillKey: "agentreceipt",
    });

    expect(error).toBeUndefined();
    expect(ok).toBe(true);
    expect(readLocalSkillCardContentSyncMock).toHaveBeenCalledWith(
      "/tmp/workspace/skills/agentreceipt",
    );
    expect(response).toEqual({
      schema: "actagent.skills.skill-card.v1",
      skillKey: "agentreceipt",
      path: "/tmp/workspace/skills/agentreceipt/skill-card.md",
      sizeBytes: 34,
      content: "# AgentReceipt\n\nLocal trust card.\n",
    });
  });

  it("installs a ACTAgentHub skill through skills.install", async () => {
    installSkillFromACTAgentHubMock.mockResolvedValue({
      ok: true,
      slug: "calendar",
      version: "1.2.3",
      targetDir: "/tmp/workspace/skills/calendar",
    });

    const { ok, response, error } = await callSkillsHandler("skills.install", {
      source: "actagenthub",
      slug: "calendar",
      version: "1.2.3",
    });

    expect(installSkillFromACTAgentHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      slug: "calendar",
      version: "1.2.3",
      force: false,
      config: {},
    });
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    const result = response as
      | { ok?: boolean; message?: string; slug?: string; version?: string }
      | undefined;
    expect(result?.ok).toBe(true);
    expect(result?.message).toBe("Installed calendar@1.2.3");
    expect(result?.slug).toBe("calendar");
    expect(result?.version).toBe("1.2.3");
  });

  it("accepts deprecated unsafe override without forwarding it to skill installs", async () => {
    installSkillMock.mockResolvedValue({
      ok: true,
      message: "Installed",
      stdout: "",
      stderr: "",
      code: 0,
    });

    const { ok, response, error } = await callSkillsHandler("skills.install", {
      name: "calendar",
      installId: "deps",
      dangerouslyForceUnsafeInstall: true,
      timeoutMs: 120_000,
    });

    expect(installSkillMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      skillName: "calendar",
      installId: "deps",
      timeoutMs: 120_000,
      config: {},
    });
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    const result = response as { ok?: boolean; message?: string } | undefined;
    expect(result?.ok).toBe(true);
    expect(result?.message).toBe("Installed");
  });

  it("updates ACTAgentHub skills through skills.update", async () => {
    updateSkillsFromACTAgentHubMock.mockResolvedValue([
      {
        ok: true,
        slug: "calendar",
        previousVersion: "1.2.2",
        version: "1.2.3",
        changed: true,
        targetDir: "/tmp/workspace/skills/calendar",
      },
    ]);

    const { ok, response, error } = await callSkillsHandler("skills.update", {
      source: "actagenthub",
      slug: "calendar",
    });

    expect(updateSkillsFromACTAgentHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      slug: "calendar",
      config: {},
    });
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    const result = response as
      | {
          ok?: boolean;
          skillKey?: string;
          config?: {
            source?: string;
            results?: Array<{ ok?: boolean; slug?: string; version?: string }>;
          };
        }
      | undefined;
    expect(result?.ok).toBe(true);
    expect(result?.skillKey).toBe("calendar");
    expect(result?.config?.source).toBe("actagenthub");
    expect(result?.config?.results).toHaveLength(1);
    expect(result?.config?.results?.[0]?.ok).toBe(true);
    expect(result?.config?.results?.[0]?.slug).toBe("calendar");
    expect(result?.config?.results?.[0]?.version).toBe("1.2.3");
  });

  it("rejects ACTAgentHub skills.update requests without slug or all", async () => {
    const { ok, error } = await callSkillsHandler("skills.update", {
      source: "actagenthub",
    });
    const typedError = error as { code?: string; message?: string } | undefined;

    expect(ok).toBe(false);
    expect(typedError?.message).toContain('requires "slug" or "all"');
    expect(updateSkillsFromACTAgentHubMock).not.toHaveBeenCalled();
  });
});
