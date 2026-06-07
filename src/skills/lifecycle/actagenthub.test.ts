// ACTAgentHub lifecycle tests cover registry metadata lookup and error handling.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchACTAgentHubSkillDetailMock = vi.fn();
const fetchACTAgentHubSkillInstallResolutionMock = vi.fn();
const downloadACTAgentHubSkillArchiveMock = vi.fn();
const downloadACTAgentHubSkillArchiveUrlMock = vi.fn();
const downloadACTAgentHubGitHubSkillArchiveMock = vi.fn();
const listACTAgentHubSkillsMock = vi.fn();
const reportACTAgentHubSkillInstallTelemetryMock = vi.fn();
const resolveACTAgentHubBaseUrlMock = vi.fn(() => "https://actagenthub.ai");
const isDefaultACTAgentHubBaseUrlMock = vi.fn((baseUrl?: string) => !baseUrl);
const searchACTAgentHubSkillsMock = vi.fn();
const archiveCleanupMock = vi.fn();
const withExtractedArchiveRootMock = vi.fn();
const installPackageDirMock = vi.fn();
const evaluateSkillInstallPolicyMock = vi.fn();
const pathExistsMock = vi.fn();

vi.mock("../../infra/actagenthub.js", () => ({
  fetchACTAgentHubSkillDetail: fetchACTAgentHubSkillDetailMock,
  fetchACTAgentHubSkillInstallResolution: fetchACTAgentHubSkillInstallResolutionMock,
  downloadACTAgentHubSkillArchive: downloadACTAgentHubSkillArchiveMock,
  downloadACTAgentHubSkillArchiveUrl: downloadACTAgentHubSkillArchiveUrlMock,
  downloadACTAgentHubGitHubSkillArchive: downloadACTAgentHubGitHubSkillArchiveMock,
  listACTAgentHubSkills: listACTAgentHubSkillsMock,
  reportACTAgentHubSkillInstallTelemetry: reportACTAgentHubSkillInstallTelemetryMock,
  isDefaultACTAgentHubBaseUrl: isDefaultACTAgentHubBaseUrlMock,
  resolveACTAgentHubBaseUrl: resolveACTAgentHubBaseUrlMock,
  searchACTAgentHubSkills: searchACTAgentHubSkillsMock,
}));

vi.mock("../../infra/install-flow.js", () => ({
  withExtractedArchiveRoot: withExtractedArchiveRootMock,
}));

vi.mock("../../infra/install-package-dir.js", () => ({
  installPackageDir: installPackageDirMock,
}));

vi.mock("../../plugins/install-security-scan.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../plugins/install-security-scan.js")>();
  return {
    ...actual,
    evaluateSkillInstallPolicy: (...args: unknown[]) => evaluateSkillInstallPolicyMock(...args),
  };
});

vi.mock("../../infra/fs-safe.js", () => ({
  pathExists: pathExistsMock,
}));

const {
  installSkillFromACTAgentHub,
  resolveACTAgentHubSkillVerificationTarget,
  searchSkillsFromACTAgentHub,
  updateSkillsFromACTAgentHub,
} = await import("./actagenthub.js");

function expectInstallPackageSourceDir(sourceDir: string) {
  const call = installPackageDirMock.mock.calls.at(0);
  if (!call) {
    throw new Error("expected installPackageDir call");
  }
  expect(call[0]?.sourceDir).toBe(sourceDir);
}

function installPolicyInput() {
  const call = evaluateSkillInstallPolicyMock.mock.calls.at(0);
  if (!call) {
    throw new Error("expected evaluateSkillInstallPolicy call");
  }
  return call[0] as
    | {
        origin?: { registry?: string };
        source?: { kind?: string; authority?: string; mutable?: boolean; network?: boolean };
      }
    | undefined;
}

function expectInstalledSkill(
  result: Awaited<ReturnType<typeof installSkillFromACTAgentHub>>,
  expected: { slug?: string; version?: string; targetDir?: string } = {},
) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected skill install success, got ${result.error}`);
  }
  if (expected.slug) {
    expect(result.slug).toBe(expected.slug);
  }
  if (expected.version) {
    expect(result.version).toBe(expected.version);
  }
  if (expected.targetDir) {
    expect(result.targetDir).toBe(expected.targetDir);
  }
}

function expectInvalidSlug(result: Awaited<ReturnType<typeof installSkillFromACTAgentHub>>) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected invalid slug failure");
  }
  expect(result.error).toContain("Invalid skill slug");
}

async function writeACTAgentHubOriginFixture(params: {
  workspaceDir: string;
  slug: string;
  originSlug?: string;
  registry?: string;
  installedVersion?: string;
  installedAt?: number;
  writeLock?: boolean;
}) {
  const skillDir = path.join(params.workspaceDir, "skills", params.slug);
  const registry = params.registry ?? "https://private.example.com/actagenthub";
  const installedVersion = params.installedVersion ?? "1.2.3";
  const installedAt = params.installedAt ?? 123;
  await fs.mkdir(path.join(skillDir, ".actagenthub"), { recursive: true });
  await fs.writeFile(
    path.join(skillDir, ".actagenthub", "origin.json"),
    `${JSON.stringify(
      {
        version: 1,
        registry,
        slug: params.originSlug ?? params.slug,
        installedVersion,
        installedAt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  if (params.writeLock !== false) {
    await fs.mkdir(path.join(params.workspaceDir, ".actagenthub"), { recursive: true });
    await fs.writeFile(
      path.join(params.workspaceDir, ".actagenthub", "lock.json"),
      `${JSON.stringify(
        {
          version: 1,
          skills: {
            [params.slug]: {
              version: installedVersion,
              installedAt,
              registry,
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  return skillDir;
}

describe("skills-actagenthub", () => {
  beforeEach(() => {
    fetchACTAgentHubSkillDetailMock.mockReset();
    fetchACTAgentHubSkillInstallResolutionMock.mockReset();
    downloadACTAgentHubSkillArchiveMock.mockReset();
    downloadACTAgentHubSkillArchiveUrlMock.mockReset();
    downloadACTAgentHubGitHubSkillArchiveMock.mockReset();
    listACTAgentHubSkillsMock.mockReset();
    reportACTAgentHubSkillInstallTelemetryMock.mockReset();
    resolveACTAgentHubBaseUrlMock.mockReset();
    isDefaultACTAgentHubBaseUrlMock.mockReset();
    searchACTAgentHubSkillsMock.mockReset();
    archiveCleanupMock.mockReset();
    withExtractedArchiveRootMock.mockReset();
    installPackageDirMock.mockReset();
    evaluateSkillInstallPolicyMock.mockReset();
    pathExistsMock.mockReset();

    resolveACTAgentHubBaseUrlMock.mockImplementation((baseUrl?: string) =>
      (baseUrl ?? "https://actagenthub.ai").replace(/\/+$/, ""),
    );
    isDefaultACTAgentHubBaseUrlMock.mockImplementation((baseUrl?: string) => !baseUrl);
    pathExistsMock.mockImplementation(async (input: string) => input.endsWith("SKILL.md"));
    fetchACTAgentHubSkillDetailMock.mockResolvedValue({
      skill: {
        slug: "agentreceipt",
        displayName: "AgentReceipt",
        createdAt: 1,
        updatedAt: 2,
      },
      latestVersion: {
        version: "1.0.0",
        createdAt: 3,
      },
    });
    fetchACTAgentHubSkillInstallResolutionMock.mockResolvedValue({
      ok: true,
      slug: "agentreceipt",
      installKind: "archive",
      archive: {
        version: "1.0.0",
        downloadUrl: "https://actagenthub.ai/api/v1/download?slug=agentreceipt&version=1.0.0",
      },
    });
    downloadACTAgentHubSkillArchiveMock.mockResolvedValue({
      archivePath: "/tmp/agentreceipt.zip",
      integrity: "sha256-test",
      cleanup: archiveCleanupMock,
    });
    downloadACTAgentHubSkillArchiveUrlMock.mockResolvedValue({
      archivePath: "/tmp/agentreceipt.zip",
      integrity: "sha256-test",
      cleanup: archiveCleanupMock,
    });
    downloadACTAgentHubGitHubSkillArchiveMock.mockResolvedValue({
      archivePath: "/tmp/github-agentreceipt.zip",
      integrity: "sha256-github-test",
      cleanup: archiveCleanupMock,
    });
    reportACTAgentHubSkillInstallTelemetryMock.mockResolvedValue(undefined);
    archiveCleanupMock.mockResolvedValue(undefined);
    searchACTAgentHubSkillsMock.mockResolvedValue([]);
    withExtractedArchiveRootMock.mockImplementation(async (params) => {
      expect(params.rootMarkers).toEqual(["SKILL.md", "skill.md", "skills.md", "SKILL.MD"]);
      return await params.onExtracted("/tmp/extracted-skill");
    });
    installPackageDirMock.mockResolvedValue({
      ok: true,
      targetDir: "/tmp/workspace/skills/agentreceipt",
    });
    evaluateSkillInstallPolicyMock.mockResolvedValue(undefined);
  });

  it("installs ACTAgentHub skills from flat-root archives", async () => {
    const result = await installSkillFromACTAgentHub({
      workspaceDir: "/tmp/workspace",
      slug: "agentreceipt",
    });

    expect(fetchACTAgentHubSkillInstallResolutionMock).toHaveBeenCalledWith({
      slug: "agentreceipt",
      baseUrl: undefined,
    });
    expect(downloadACTAgentHubSkillArchiveUrlMock).toHaveBeenCalledWith({
      url: "https://actagenthub.ai/api/v1/download?slug=agentreceipt&version=1.0.0",
      baseUrl: undefined,
    });
    expectInstallPackageSourceDir("/tmp/extracted-skill");
    expect(installPolicyInput()).toMatchObject({
      origin: { registry: "https://actagenthub.ai" },
      source: { kind: "actagenthub", authority: "actagent", mutable: false, network: true },
    });
    expectInstalledSkill(result, {
      slug: "agentreceipt",
      version: "1.0.0",
      targetDir: "/tmp/workspace/skills/agentreceipt",
    });
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
    expect(reportACTAgentHubSkillInstallTelemetryMock).toHaveBeenCalledWith({
      baseUrl: undefined,
      root: "/tmp/workspace",
      skills: expect.objectContaining({
        agentreceipt: {
          version: "1.0.0",
          installedAt: expect.any(Number),
          registry: "https://actagenthub.ai",
        },
      }),
    });
  });

  it("installs GitHub-backed ACTAgentHub skills from the pinned resolver source path", async () => {
    const commit = "b".repeat(40);
    fetchACTAgentHubSkillInstallResolutionMock.mockResolvedValueOnce({
      ok: true,
      slug: "aiq-deploy",
      installKind: "github",
      github: {
        repo: "NVIDIA/skills",
        path: "skills/aiq-deploy",
        commit,
        contentHash: "hash-aiq-deploy",
        sourceUrl: `https://github.com/NVIDIA/skills/tree/${commit}/skills/aiq-deploy`,
      },
    });
    withExtractedArchiveRootMock.mockImplementationOnce(async (params) => {
      expect(params.rootMarkers).toBeUndefined();
      return await params.onExtracted("/tmp/extracted-github-repo");
    });
    installPackageDirMock.mockResolvedValueOnce({
      ok: true,
      targetDir: "/tmp/workspace/skills/aiq-deploy",
    });

    const result = await installSkillFromACTAgentHub({
      workspaceDir: "/tmp/workspace",
      slug: "aiq-deploy",
    });

    expect(fetchACTAgentHubSkillInstallResolutionMock).toHaveBeenCalledWith({
      slug: "aiq-deploy",
      baseUrl: undefined,
    });
    expect(downloadACTAgentHubGitHubSkillArchiveMock).toHaveBeenCalledWith({
      repo: "NVIDIA/skills",
      commit,
    });
    expectInstallPackageSourceDir("/tmp/extracted-github-repo/skills/aiq-deploy");
    expect(installPolicyInput()).toMatchObject({
      origin: {
        registry: "https://actagenthub.ai",
        repo: "NVIDIA/skills",
        path: "skills/aiq-deploy",
        commit,
      },
      source: { kind: "git", authority: "third-party", mutable: false, network: true },
    });
    expectInstalledSkill(result, {
      slug: "aiq-deploy",
      version: commit,
      targetDir: "/tmp/workspace/skills/aiq-deploy",
    });
  });

  it("passes forceInstall to the ACTAgentHub install resolver", async () => {
    const commit = "b".repeat(40);
    fetchACTAgentHubSkillInstallResolutionMock.mockResolvedValueOnce({
      ok: true,
      slug: "aiq-deploy",
      installKind: "github",
      github: {
        repo: "NVIDIA/skills",
        path: "skills/aiq-deploy",
        commit,
        contentHash: "hash-aiq-deploy",
        sourceUrl: `https://github.com/NVIDIA/skills/tree/${commit}/skills/aiq-deploy`,
      },
    });
    withExtractedArchiveRootMock.mockImplementationOnce(async (params) => {
      return await params.onExtracted("/tmp/extracted-github-repo");
    });
    installPackageDirMock.mockResolvedValueOnce({
      ok: true,
      targetDir: "/tmp/workspace/skills/aiq-deploy",
    });

    const result = await installSkillFromACTAgentHub({
      workspaceDir: "/tmp/workspace",
      slug: "aiq-deploy",
      forceInstall: true,
    });

    expect(fetchACTAgentHubSkillInstallResolutionMock).toHaveBeenCalledWith({
      slug: "aiq-deploy",
      baseUrl: undefined,
      forceInstall: true,
    });
    expectInstalledSkill(result, {
      slug: "aiq-deploy",
      version: commit,
      targetDir: "/tmp/workspace/skills/aiq-deploy",
    });
  });

  it("keeps ACTAgentHub install telemetry best-effort", async () => {
    reportACTAgentHubSkillInstallTelemetryMock.mockRejectedValueOnce(new Error("telemetry down"));

    const result = await installSkillFromACTAgentHub({
      workspaceDir: "/tmp/workspace",
      slug: "agentreceipt",
    });

    expectInstalledSkill(result, {
      slug: "agentreceipt",
      version: "1.0.0",
    });
  });

  it("marks custom ACTAgentHub skill registries as third-party install policy authority", async () => {
    const result = await installSkillFromACTAgentHub({
      workspaceDir: "/tmp/workspace",
      slug: "agentreceipt",
      baseUrl: "https://actagenthub.internal.example",
    });

    expectInstalledSkill(result, {
      slug: "agentreceipt",
      version: "1.0.0",
    });
    expect(installPolicyInput()).toMatchObject({
      origin: { registry: "https://actagenthub.internal.example" },
      source: { kind: "actagenthub", authority: "third-party", mutable: false, network: true },
    });
  });

  it.each(["skill.md", "skills.md", "SKILL.MD"])(
    "installs ACTAgentHub archives whose packed root uses legacy marker %s",
    async (marker) => {
      pathExistsMock.mockImplementation(async (input: string) => input.endsWith(marker));

      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "agentreceipt",
      });

      expectInstalledSkill(result);
      expectInstallPackageSourceDir("/tmp/extracted-skill");
    },
  );

  describe("legacy tracked slugs remain updatable", () => {
    async function createLegacyTrackedSkillFixture(slug: string) {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skills-actagenthub-"));
      const skillDir = path.join(workspaceDir, "skills", slug);
      await fs.mkdir(path.join(skillDir, ".actagenthub"), { recursive: true });
      await fs.mkdir(path.join(workspaceDir, ".actagenthub"), { recursive: true });
      await fs.writeFile(
        path.join(skillDir, ".actagenthub", "origin.json"),
        `${JSON.stringify(
          {
            version: 1,
            registry: "https://legacy.actagenthub.ai",
            slug,
            installedVersion: "0.9.0",
            installedAt: 123,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(workspaceDir, ".actagenthub", "lock.json"),
        `${JSON.stringify(
          {
            version: 1,
            skills: {
              [slug]: {
                version: "0.9.0",
                installedAt: 123,
              },
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      return { workspaceDir, skillDir };
    }

    function expectLegacyUpdateSuccess(results: unknown, workspaceDir: string, slug: string) {
      expect(Array.isArray(results)).toBe(true);
      const first = (results as Array<Record<string, unknown>>)[0];
      expect(first?.ok).toBe(true);
      expect(first?.slug).toBe(slug);
      expect(first?.previousVersion).toBe("0.9.0");
      expect(first?.version).toBe("1.0.0");
      expect(first?.targetDir).toBe(path.join(workspaceDir, "skills", slug));
    }

    it("updates all tracked legacy Unicode slugs in place", async () => {
      const slug = "re\u0430ct";
      const { workspaceDir } = await createLegacyTrackedSkillFixture(slug);
      fetchACTAgentHubSkillInstallResolutionMock.mockResolvedValueOnce({
        ok: true,
        slug,
        installKind: "archive",
        archive: {
          version: "1.0.0",
          downloadUrl: `https://legacy.actagenthub.ai/api/v1/download?slug=${encodeURIComponent(slug)}&version=1.0.0`,
        },
      });
      installPackageDirMock.mockResolvedValueOnce({
        ok: true,
        targetDir: path.join(workspaceDir, "skills", slug),
      });

      try {
        const results = await updateSkillsFromACTAgentHub({
          workspaceDir,
        });

        expect(fetchACTAgentHubSkillInstallResolutionMock).toHaveBeenCalledWith({
          slug,
          baseUrl: "https://legacy.actagenthub.ai",
        });
        expect(downloadACTAgentHubSkillArchiveUrlMock).toHaveBeenCalledWith({
          url: `https://legacy.actagenthub.ai/api/v1/download?slug=${encodeURIComponent(slug)}&version=1.0.0`,
          baseUrl: "https://legacy.actagenthub.ai",
        });
        expectLegacyUpdateSuccess(results, workspaceDir, slug);
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("passes forceInstall to resolver for tracked updates", async () => {
      const slug = "agentreceipt";
      const { workspaceDir } = await createLegacyTrackedSkillFixture(slug);
      fetchACTAgentHubSkillInstallResolutionMock.mockResolvedValueOnce({
        ok: true,
        slug,
        installKind: "archive",
        archive: {
          version: "1.0.0",
          downloadUrl: `https://legacy.actagenthub.ai/api/v1/download?slug=${encodeURIComponent(slug)}&version=1.0.0`,
        },
      });
      installPackageDirMock.mockResolvedValueOnce({
        ok: true,
        targetDir: path.join(workspaceDir, "skills", slug),
      });

      try {
        const results = await updateSkillsFromACTAgentHub({
          workspaceDir,
          forceInstall: true,
        });

        expect(fetchACTAgentHubSkillInstallResolutionMock).toHaveBeenCalledWith({
          slug,
          baseUrl: "https://legacy.actagenthub.ai",
          forceInstall: true,
        });
        expectLegacyUpdateSuccess(results, workspaceDir, slug);
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("updates a legacy Unicode slug when requested explicitly", async () => {
      const slug = "re\u0430ct";
      const { workspaceDir } = await createLegacyTrackedSkillFixture(slug);
      installPackageDirMock.mockResolvedValueOnce({
        ok: true,
        targetDir: path.join(workspaceDir, "skills", slug),
      });

      try {
        const results = await updateSkillsFromACTAgentHub({
          workspaceDir,
          slug,
        });

        expectLegacyUpdateSuccess(results, workspaceDir, slug);
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("still rejects an untracked Unicode slug passed to update", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skills-actagenthub-"));

      try {
        await expect(
          updateSkillsFromACTAgentHub({
            workspaceDir,
            slug: "re\u0430ct",
          }),
        ).rejects.toThrow("Invalid skill slug");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });
  });

  describe("normalizeSlug rejects non-ASCII homograph slugs", () => {
    it("rejects Cyrillic homograph 'а' (U+0430) in slug", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "re\u0430ct",
      });
      expectInvalidSlug(result);
    });

    it("rejects Cyrillic homograph 'е' (U+0435) in slug", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "r\u0435act",
      });
      expectInvalidSlug(result);
    });

    it("rejects Cyrillic homograph 'о' (U+043E) in slug", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "t\u043Edo",
      });
      expectInvalidSlug(result);
    });

    it("rejects slug with mixed Unicode and ASCII", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "cаlеndаr",
      });
      expectInvalidSlug(result);
    });

    it("rejects slug with non-Latin scripts", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "技能",
      });
      expectInvalidSlug(result);
    });

    it("rejects Unicode that case-folds to ASCII (Kelvin sign U+212A)", async () => {
      // "\u212A" (Kelvin sign) lowercases to "k" — must be caught before lowercasing
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "\u212Aalendar",
      });
      expectInvalidSlug(result);
    });

    it("rejects slug starting with a hyphen", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "-calendar",
      });
      expectInvalidSlug(result);
    });

    it("rejects slug ending with a hyphen", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "calendar-",
      });
      expectInvalidSlug(result);
    });

    it("accepts uppercase ASCII slugs (preserves original casing behavior)", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "React",
      });
      expectInstalledSkill(result);
    });

    it("accepts valid lowercase ASCII slugs", async () => {
      const result = await installSkillFromACTAgentHub({
        workspaceDir: "/tmp/workspace",
        slug: "calendar-2",
      });
      expectInstalledSkill(result);
    });
  });

  describe("verification target resolution", () => {
    it("uses installed origin registry and installed version by default", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        const skillDir = await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          registry: "https://private.example.com/actagenthub/",
          installedVersion: "2.0.0",
        });

        await expect(
          resolveACTAgentHubSkillVerificationTarget({
            workspaceDir,
            slug: "agentreceipt",
          }),
        ).resolves.toEqual({
          ok: true,
          slug: "agentreceipt",
          baseUrl: "https://private.example.com/actagenthub",
          version: "2.0.0",
          tag: undefined,
          resolution: {
            source: "installed",
            selector: "installed-version",
            registry: "https://private.example.com/actagenthub",
            skillDir,
            installedVersion: "2.0.0",
          },
        });
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("keeps the installed registry when an explicit version overrides the installed version", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          registry: "https://private.example.com/actagenthub",
          installedVersion: "2.0.0",
        });

        await expect(
          resolveACTAgentHubSkillVerificationTarget({
            workspaceDir,
            slug: "agentreceipt",
            version: "2.1.0",
            baseUrl: "https://actagenthub.ai",
          }),
        ).resolves.toMatchObject({
          ok: true,
          slug: "agentreceipt",
          baseUrl: "https://private.example.com/actagenthub",
          version: "2.1.0",
          tag: undefined,
          resolution: {
            source: "installed",
            selector: "version",
            registry: "https://private.example.com/actagenthub",
            installedVersion: "2.0.0",
          },
        });
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("keeps the installed registry when an explicit tag is provided", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          registry: "https://private.example.com/actagenthub",
          installedVersion: "2.0.0",
        });

        await expect(
          resolveACTAgentHubSkillVerificationTarget({
            workspaceDir,
            slug: "agentreceipt",
            tag: "beta",
            baseUrl: "https://actagenthub.ai",
          }),
        ).resolves.toMatchObject({
          ok: true,
          slug: "agentreceipt",
          baseUrl: "https://private.example.com/actagenthub",
          version: undefined,
          tag: "beta",
          resolution: {
            source: "installed",
            selector: "tag",
            registry: "https://private.example.com/actagenthub",
            installedVersion: "2.0.0",
          },
        });
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("rejects installed origin metadata without workspace lock tracking", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          writeLock: false,
        });

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected untracked origin failure");
        }
        expect(result.error).toContain("not tracked by the workspace ACTAgentHub lockfile");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("rejects installed origin metadata for a different skill slug", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          originSlug: "trusted-skill",
        });

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected slug mismatch failure");
        }
        expect(result.error).toContain('origin metadata for "trusted-skill"');
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("rejects installed origin metadata that does not match lock tracking", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          installedVersion: "2.0.0",
          installedAt: 123,
        });
        const lockPath = path.join(workspaceDir, ".actagenthub", "lock.json");
        const lock = JSON.parse(await fs.readFile(lockPath, "utf8")) as {
          skills: Record<string, { version: string; installedAt: number; registry: string }>;
        };
        lock.skills.agentreceipt = {
          ...lock.skills.agentreceipt,
          version: "1.0.0",
        };
        await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected lock mismatch failure");
        }
        expect(result.error).toContain("does not match the workspace ACTAgentHub lockfile");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("rejects installed origin metadata when lock registry disagrees", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await writeACTAgentHubOriginFixture({
          workspaceDir,
          slug: "agentreceipt",
          registry: "https://origin.example.com/actagenthub",
          installedVersion: "2.0.0",
          installedAt: 123,
        });
        const lockPath = path.join(workspaceDir, ".actagenthub", "lock.json");
        const lock = JSON.parse(await fs.readFile(lockPath, "utf8")) as {
          skills: Record<string, { version: string; installedAt: number; registry: string }>;
        };
        lock.skills.agentreceipt = {
          ...lock.skills.agentreceipt,
          registry: "https://other.example.com/actagenthub",
        };
        await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected registry mismatch failure");
        }
        expect(result.error).toContain("does not match the workspace ACTAgentHub lockfile");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("rejects lock-tracked installed skills without origin metadata", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await fs.mkdir(path.join(workspaceDir, ".actagenthub"), { recursive: true });
        await fs.writeFile(
          path.join(workspaceDir, ".actagenthub", "lock.json"),
          `${JSON.stringify(
            {
              version: 1,
              skills: {
                agentreceipt: {
                  version: "2.0.0",
                  installedAt: 123,
                  registry: "https://private.example.com/actagenthub",
                },
              },
            },
            null,
            2,
          )}\n`,
          "utf8",
        );

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected missing origin failure");
        }
        expect(result.error).toContain("missing ACTAgentHub origin metadata");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("rejects malformed workspace locks before registry fallback", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        await fs.mkdir(path.join(workspaceDir, ".actagenthub"), { recursive: true });
        await fs.writeFile(path.join(workspaceDir, ".actagenthub", "lock.json"), "{not json", "utf8");

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected malformed lock failure");
        }
        expect(result.error).toContain("Malformed workspace ACTAgentHub lockfile");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("uses the configured registry and latest selector for uninstalled skills", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      resolveACTAgentHubBaseUrlMock.mockReturnValueOnce("https://configured.example.com/actagenthub");
      try {
        await expect(
          resolveACTAgentHubSkillVerificationTarget({
            workspaceDir,
            slug: "agentreceipt",
            baseUrl: "https://configured.example.com/actagenthub/",
          }),
        ).resolves.toEqual({
          ok: true,
          slug: "agentreceipt",
          baseUrl: "https://configured.example.com/actagenthub",
          version: undefined,
          tag: undefined,
          resolution: {
            source: "registry",
            selector: "latest",
            registry: "https://configured.example.com/actagenthub",
            skillDir: undefined,
            installedVersion: undefined,
          },
        });
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("fails clearly when installed origin metadata is malformed", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-skill-verify-"));
      try {
        const skillDir = path.join(workspaceDir, "skills", "agentreceipt");
        await fs.mkdir(path.join(skillDir, ".actagenthub"), { recursive: true });
        await fs.writeFile(path.join(skillDir, ".actagenthub", "origin.json"), "{not json", "utf8");

        const result = await resolveACTAgentHubSkillVerificationTarget({
          workspaceDir,
          slug: "agentreceipt",
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected malformed origin failure");
        }
        expect(result.error).toContain("Malformed ACTAgentHub origin metadata");
        expect(result.error).toContain(path.join(skillDir, ".actagenthub", "origin.json"));
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("fails clearly for invalid slugs and conflicting selectors", async () => {
      await expect(
        resolveACTAgentHubSkillVerificationTarget({
          workspaceDir: "/tmp/workspace",
          slug: "bad/slug",
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: "Invalid skill slug: bad/slug",
      });

      await expect(
        resolveACTAgentHubSkillVerificationTarget({
          workspaceDir: "/tmp/workspace",
          slug: "agentreceipt",
          version: "1.0.0",
          tag: "latest",
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: "Use either --version or --tag.",
      });
    });
  });

  it("uses search for browse-all skill discovery", async () => {
    searchACTAgentHubSkillsMock.mockResolvedValueOnce([
      {
        score: 1,
        slug: "calendar",
        displayName: "Calendar",
        summary: "Calendar skill",
        version: "1.2.3",
        updatedAt: 123,
      },
    ]);

    await expect(searchSkillsFromACTAgentHub({ limit: 20 })).resolves.toEqual([
      {
        score: 1,
        slug: "calendar",
        displayName: "Calendar",
        summary: "Calendar skill",
        version: "1.2.3",
        updatedAt: 123,
      },
    ]);
    expect(searchACTAgentHubSkillsMock).toHaveBeenCalledWith({
      query: "*",
      limit: 20,
      baseUrl: undefined,
    });
    expect(listACTAgentHubSkillsMock).not.toHaveBeenCalled();
  });
});
