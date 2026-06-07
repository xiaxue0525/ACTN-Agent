/** Verifies ACTAgentHub plugin spec parsing and install metadata handling. */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parseACTAgentHubPluginSpecMock = vi.fn();
const fetchACTAgentHubPackageDetailMock = vi.fn();
const fetchACTAgentHubPackageArtifactMock = vi.fn();
const fetchACTAgentHubPackageVersionMock = vi.fn();
const downloadACTAgentHubPackageArchiveMock = vi.fn();
const archiveCleanupMock = vi.fn();
const resolveLatestVersionFromPackageMock = vi.fn();
const resolveCompatibilityHostVersionMock = vi.fn();
const installPluginFromArchiveMock = vi.fn();

vi.mock("../infra/actagenthub.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/actagenthub.js")>("../infra/actagenthub.js");
  return {
    ...actual,
    parseACTAgentHubPluginSpec: (...args: unknown[]) => parseACTAgentHubPluginSpecMock(...args),
    fetchACTAgentHubPackageDetail: (...args: unknown[]) => fetchACTAgentHubPackageDetailMock(...args),
    fetchACTAgentHubPackageArtifact: (...args: unknown[]) => fetchACTAgentHubPackageArtifactMock(...args),
    fetchACTAgentHubPackageVersion: (...args: unknown[]) => fetchACTAgentHubPackageVersionMock(...args),
    downloadACTAgentHubPackageArchive: (...args: unknown[]) =>
      downloadACTAgentHubPackageArchiveMock(...args),
    resolveLatestVersionFromPackage: (...args: unknown[]) =>
      resolveLatestVersionFromPackageMock(...args),
  };
});

vi.mock("../version.js", () => ({
  resolveCompatibilityHostVersion: (...args: unknown[]) =>
    resolveCompatibilityHostVersionMock(...args),
}));

vi.mock("./install.js", () => ({
  installPluginFromArchive: (...args: unknown[]) => installPluginFromArchiveMock(...args),
}));

vi.mock("../infra/archive.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/archive.js")>("../infra/archive.js");
  return {
    ...actual,
    DEFAULT_MAX_ENTRIES: 50_000,
    DEFAULT_MAX_EXTRACTED_BYTES: 512 * 1024 * 1024,
    DEFAULT_MAX_ENTRY_BYTES: 256 * 1024 * 1024,
  };
});

const { ACTAgentHubRequestError } = await import("../infra/actagenthub.js");
type ACTAgentHubResolvedArtifact = import("../infra/actagenthub.js").ACTAgentHubResolvedArtifact;
const { ACTAGENTHUB_INSTALL_ERROR_CODE, formatACTAgentHubSpecifier, installPluginFromACTAgentHub } =
  await import("./actagenthub.js");

const DEMO_ARCHIVE_INTEGRITY = "sha256-qerEjGEpvES2+Tyan0j2xwDRkbcnmh4ZFfKN9vWbsa8=";
const DEMO_ARCHIVE_SHA256 = "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af";
const DEMO_actagentpack_SHA256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEMO_actagentpack_INTEGRITY = `sha256-${Buffer.from(DEMO_actagentpack_SHA256, "hex").toString(
  "base64",
)}`;
const tempDirs: string[] = [];

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function createACTAgentHubArchive(entries: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
  tempDirs.push(dir);
  const archivePath = path.join(dir, "archive.zip");
  const zip = new JSZip();
  for (const [filePath, contents] of Object.entries(entries)) {
    zip.file(filePath, contents);
  }
  const archiveBytes = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(archivePath, archiveBytes);
  return {
    archivePath,
    integrity: `sha256-${createHash("sha256").update(archiveBytes).digest("base64")}`,
  };
}

async function expectACTAgentHubInstallError(params: {
  setup?: () => void;
  spec: string;
  expected: {
    ok: false;
    code: (typeof ACTAGENTHUB_INSTALL_ERROR_CODE)[keyof typeof ACTAGENTHUB_INSTALL_ERROR_CODE];
    error: string;
  };
}) {
  params.setup?.();
  const result = await installPluginFromACTAgentHub({ spec: params.spec });
  const failure = expectInstallFailure(result);
  expect(failure.code).toBe(params.expected.code);
  expect(failure.error).toBe(params.expected.error);
}

function createLoggerSpies() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createZipCentralDirectoryArchive(params: {
  actualEntryCount: number;
  declaredEntryCount?: number;
  declaredCentralDirectorySize?: number;
}): Buffer {
  const centralDirectory = Buffer.concat(
    Array.from({ length: params.actualEntryCount }, (_, index) => {
      const name = Buffer.from(`file-${index}.txt`);
      const header = Buffer.alloc(46 + name.byteLength);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(name.byteLength, 28);
      name.copy(header, 46);
      return header;
    }),
  );
  const declaredEntryCount = params.declaredEntryCount ?? params.actualEntryCount;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Math.min(declaredEntryCount, 0xffff), 8);
  eocd.writeUInt16LE(Math.min(declaredEntryCount, 0xffff), 10);
  eocd.writeUInt32LE(params.declaredCentralDirectorySize ?? centralDirectory.byteLength, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([centralDirectory, eocd]);
}

function expectACTAgentHubInstallFlow(params: {
  baseUrl: string;
  version: string;
  archivePath: string;
}) {
  expect(packageDetailCall().name).toBe("demo");
  expect(packageDetailCall().baseUrl).toBe(params.baseUrl);
  expect(packageVersionCall().name).toBe("demo");
  expect(packageVersionCall().version).toBe(params.version);
  expect(packageArtifactCall().name).toBe("demo");
  expect(packageArtifactCall().version).toBe(params.version);
  expect(archiveInstallCall().archivePath).toBe(params.archivePath);
}

function expectSuccessfulACTAgentHubInstall(result: unknown) {
  const success = expectInstallSuccess(result);
  expect(success.pluginId).toBe("demo");
  expect(success.version).toBe("2026.3.22");
  expect(success.actagenthub?.source).toBe("actagenthub");
  expect(success.actagenthub?.actagenthubPackage).toBe("demo");
  expect(success.actagenthub?.actagenthubFamily).toBe("code-plugin");
  expect(success.actagenthub?.actagenthubChannel).toBe("official");
  expect(success.actagenthub?.integrity).toBe(DEMO_ARCHIVE_INTEGRITY);
}

type MockWithCalls = {
  mock: {
    calls: readonly (readonly unknown[])[];
  };
};

type PackageLookupCall = {
  artifact?: string;
  baseUrl?: string;
  name?: string;
  version?: string;
};

type ArchiveInstallCall = {
  archivePath?: string;
  dangerouslyForceUnsafeInstall?: boolean;
  installPolicyRequest?: {
    kind?: string;
    requestedSpecifier?: string;
    source?: { kind?: string; authority?: string; mutable?: boolean; network?: boolean };
  };
  trustedSourceLinkedOfficialInstall?: boolean;
};

type InstallSuccess = {
  actagenthub?: Record<string, unknown>;
  ok: true;
  pluginId?: string;
  version?: string;
};

type InstallFailure = {
  code?: string;
  error: string;
  ok: false;
};

function mockCallArg(mock: MockWithCalls, callIndex = 0, argIndex = 0): unknown {
  const call = mock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`Expected mock call ${callIndex}`);
  }
  if (call.length <= argIndex) {
    throw new Error(`Expected mock call ${callIndex} argument ${argIndex}`);
  }
  return call[argIndex];
}

function packageDetailCall(callIndex = 0): PackageLookupCall {
  return mockCallArg(fetchACTAgentHubPackageDetailMock, callIndex) as PackageLookupCall;
}

function packageVersionCall(callIndex = 0): PackageLookupCall {
  return mockCallArg(fetchACTAgentHubPackageVersionMock, callIndex) as PackageLookupCall;
}

function packageArtifactCall(callIndex = 0): PackageLookupCall {
  return mockCallArg(fetchACTAgentHubPackageArtifactMock, callIndex) as PackageLookupCall;
}

function archiveDownloadCall(callIndex = 0): PackageLookupCall {
  return mockCallArg(downloadACTAgentHubPackageArchiveMock, callIndex) as PackageLookupCall;
}

function archiveInstallCall(callIndex = 0): ArchiveInstallCall {
  return mockCallArg(installPluginFromArchiveMock, callIndex) as ArchiveInstallCall;
}

function expectInstallSuccess(result: unknown): InstallSuccess {
  expect((result as { ok?: unknown }).ok).toBe(true);
  return result as InstallSuccess;
}

function expectInstallFailure(result: unknown): InstallFailure {
  expect((result as { ok?: unknown }).ok).toBe(false);
  return result as InstallFailure;
}

function expectInstallFailureFields(
  result: unknown,
  code: (typeof ACTAGENTHUB_INSTALL_ERROR_CODE)[keyof typeof ACTAGENTHUB_INSTALL_ERROR_CODE],
  error: string,
) {
  const failure = expectInstallFailure(result);
  expect(failure.code).toBe(code);
  expect(failure.error).toBe(error);
}

describe("installPluginFromACTAgentHub", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  beforeEach(() => {
    parseACTAgentHubPluginSpecMock.mockReset();
    fetchACTAgentHubPackageDetailMock.mockReset();
    fetchACTAgentHubPackageArtifactMock.mockReset();
    fetchACTAgentHubPackageVersionMock.mockReset();
    downloadACTAgentHubPackageArchiveMock.mockReset();
    archiveCleanupMock.mockReset();
    resolveLatestVersionFromPackageMock.mockReset();
    resolveCompatibilityHostVersionMock.mockReset();
    installPluginFromArchiveMock.mockReset();

    parseACTAgentHubPluginSpecMock.mockReturnValue({ name: "demo" });
    fetchACTAgentHubPackageDetailMock.mockResolvedValue({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    resolveLatestVersionFromPackageMock.mockReturnValue("2026.3.22");
    fetchACTAgentHubPackageVersionMock.mockResolvedValue({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    fetchACTAgentHubPackageArtifactMock.mockImplementation((params) =>
      fetchACTAgentHubPackageVersionMock(params),
    );
    downloadACTAgentHubPackageArchiveMock.mockResolvedValue({
      archivePath: "/tmp/actagenthub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });
    archiveCleanupMock.mockResolvedValue(undefined);
    resolveCompatibilityHostVersionMock.mockReturnValue("2026.3.22");
    installPluginFromArchiveMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/actagent/plugins/demo",
      version: "2026.3.22",
    });
  });

  it("formats actagenthub specifiers", () => {
    expect(formatACTAgentHubSpecifier({ name: "demo" })).toBe("actagenthub:demo");
    expect(formatACTAgentHubSpecifier({ name: "demo", version: "1.2.3" })).toBe("actagenthub:demo@1.2.3");
  });

  it("installs a ACTAgentHub code plugin through the archive installer", async () => {
    const logger = createLoggerSpies();
    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
      logger,
    });

    expectACTAgentHubInstallFlow({
      baseUrl: "https://actagenthub.ai",
      version: "2026.3.22",
      archivePath: "/tmp/actagenthub-demo/archive.zip",
    });
    expectSuccessfulACTAgentHubInstall(result);
    expect(archiveInstallCall().installPolicyRequest).toEqual({
      kind: "plugin-archive",
      requestedSpecifier: "actagenthub:demo",
      source: { kind: "actagenthub", authority: "actagent", mutable: false, network: true },
    });
    expect(logger.info).toHaveBeenCalledWith("ACTAgentHub code-plugin demo@2026.3.22 channel=official");
    expect(logger.info).toHaveBeenCalledWith(
      "Compatibility: pluginApi=>=2026.3.22 minGateway=2026.3.0",
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("marks custom ACTAgentHub registries as third-party install policy authority", async () => {
    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.internal.example",
    });

    expectACTAgentHubInstallFlow({
      baseUrl: "https://actagenthub.internal.example",
      version: "2026.3.22",
      archivePath: "/tmp/actagenthub-demo/archive.zip",
    });
    expectSuccessfulACTAgentHubInstall(result);
    expect(archiveInstallCall().installPolicyRequest).toMatchObject({
      kind: "plugin-archive",
      requestedSpecifier: "actagenthub:demo",
      source: { kind: "actagenthub", authority: "third-party", mutable: false, network: true },
    });
  });

  it("marks official source-linked ACTAgent packages as trusted for install scanning", async () => {
    fetchACTAgentHubPackageDetailMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        verification: {
          tier: "source-linked",
          sourceRepo: "actagent/actagent",
        },
      },
    });

    await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    expect(archiveInstallCall().trustedSourceLinkedOfficialInstall).toBe(true);
  });

  it("resolves explicit ACTAgentHub dist tags before fetching version metadata", async () => {
    parseACTAgentHubPluginSpecMock.mockReturnValueOnce({ name: "demo", version: "latest" });
    fetchACTAgentHubPackageDetailMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        tags: {
          latest: "2026.3.22",
        },
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo@latest",
      baseUrl: "https://actagenthub.ai",
    });

    expectSuccessfulACTAgentHubInstall(result);
    expect(packageVersionCall().name).toBe("demo");
    expect(packageVersionCall().version).toBe("2026.3.22");
    expect(archiveDownloadCall().name).toBe("demo");
    expect(archiveDownloadCall().version).toBe("2026.3.22");
  });

  it("returns actagentpack metadata from compatible ACTAgentHub package versions", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
        artifact: {
          kind: "npm-pack",
          format: "tgz",
          sha256: DEMO_actagentpack_SHA256,
          size: 4096,
          npmIntegrity: "sha512-actagentpack",
          npmShasum: "1".repeat(40),
          npmTarballName: "demo-2026.3.22.tgz",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/demo-2026.3.22.tgz",
      integrity: DEMO_actagentpack_INTEGRITY,
      sha256Hex: DEMO_actagentpack_SHA256,
      artifact: "actagentpack",
      actagentpackHeaderSha256: DEMO_actagentpack_SHA256,
      npmIntegrity: "sha512-actagentpack",
      npmShasum: "1".repeat(40),
      npmTarballName: "demo-2026.3.22.tgz",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.actagenthub?.integrity).toBe(DEMO_actagentpack_INTEGRITY);
    expect(success.actagenthub?.artifactKind).toBe("npm-pack");
    expect(success.actagenthub?.artifactFormat).toBe("tgz");
    expect(success.actagenthub?.npmIntegrity).toBe("sha512-actagentpack");
    expect(success.actagenthub?.npmShasum).toBe("1".repeat(40));
    expect(success.actagenthub?.npmTarballName).toBe("demo-2026.3.22.tgz");
    expect(success.actagenthub?.actagentpackSha256).toBe(DEMO_actagentpack_SHA256);
    expect(success.actagenthub?.actagentpackSize).toBe(4096);
    expect(archiveDownloadCall().artifact).toBe("actagentpack");
    expect(archiveDownloadCall().name).toBe("demo");
    expect(archiveDownloadCall().version).toBe("2026.3.22");
  });

  it("uses the artifact resolver response as the install decision", async () => {
    fetchACTAgentHubPackageVersionMock.mockClear();
    fetchACTAgentHubPackageArtifactMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
      },
      version: {
        version: "2026.3.22",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
      artifact: {
        source: "actagenthub",
        artifactKind: "npm-pack",
        packageName: "demo",
        version: "2026.3.22",
        artifactSha256: DEMO_actagentpack_SHA256,
        npmIntegrity: "sha512-actagentpack",
        npmShasum: "1".repeat(40),
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/demo-2026.3.22.tgz",
      integrity: DEMO_actagentpack_INTEGRITY,
      sha256Hex: DEMO_actagentpack_SHA256,
      artifact: "actagentpack",
      actagentpackHeaderSha256: DEMO_actagentpack_SHA256,
      npmIntegrity: "sha512-actagentpack",
      npmShasum: "1".repeat(40),
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.actagenthub?.artifactKind).toBe("npm-pack");
    expect(success.actagenthub?.artifactFormat).toBe("tgz");
    expect(success.actagenthub?.npmIntegrity).toBe("sha512-actagentpack");
    expect(success.actagenthub?.npmShasum).toBe("1".repeat(40));
    expect(success.actagenthub?.actagentpackSha256).toBe(DEMO_actagentpack_SHA256);
    expect(packageArtifactCall().name).toBe("demo");
    expect(packageArtifactCall().version).toBe("2026.3.22");
    expect(fetchACTAgentHubPackageVersionMock).not.toHaveBeenCalled();
    expect(archiveDownloadCall().artifact).toBe("actagentpack");
    expect(archiveDownloadCall().name).toBe("demo");
    expect(archiveDownloadCall().version).toBe("2026.3.22");
  });

  it("accepts the live ACTAgentHub artifact resolver shape with kind/sha256 field names", async () => {
    fetchACTAgentHubPackageVersionMock.mockClear();
    fetchACTAgentHubPackageArtifactMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
      },
      version: "2026.3.22",
      artifact: {
        kind: "npm-pack",
        sha256: DEMO_actagentpack_SHA256,
        npmIntegrity: "sha512-actagentpack",
        npmShasum: "1".repeat(40),
      } as unknown as ACTAgentHubResolvedArtifact,
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/demo-2026.3.22.tgz",
      integrity: DEMO_actagentpack_INTEGRITY,
      sha256Hex: DEMO_actagentpack_SHA256,
      artifact: "actagentpack",
      actagentpackHeaderSha256: DEMO_actagentpack_SHA256,
      npmIntegrity: "sha512-actagentpack",
      npmShasum: "1".repeat(40),
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.actagenthub?.artifactKind).toBe("npm-pack");
    expect(success.actagenthub?.artifactFormat).toBe("tgz");
    expect(success.actagenthub?.npmIntegrity).toBe("sha512-actagentpack");
    expect(success.actagenthub?.npmShasum).toBe("1".repeat(40));
    expect(success.actagenthub?.actagentpackSha256).toBe(DEMO_actagentpack_SHA256);
    expect(fetchACTAgentHubPackageVersionMock).not.toHaveBeenCalled();
    expect(archiveDownloadCall().artifact).toBe("actagentpack");
    expect(archiveDownloadCall().name).toBe("demo");
    expect(archiveDownloadCall().version).toBe("2026.3.22");
  });

  it("accepts the live ACTAgentHub legacy zip resolver shape with kind/sha256 field names", async () => {
    fetchACTAgentHubPackageVersionMock.mockClear();
    fetchACTAgentHubPackageArtifactMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
      },
      version: "2026.3.22",
      artifact: {
        kind: "legacy-zip",
        sha256: DEMO_ARCHIVE_SHA256,
      } as unknown as ACTAgentHubResolvedArtifact,
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.pluginId).toBe("demo");
    expect(success.actagenthub?.artifactKind).toBe("legacy-zip");
    expect(success.actagenthub?.artifactFormat).toBe("zip");
    expect(success.actagenthub?.integrity).toBe(DEMO_ARCHIVE_INTEGRITY);
    expect(fetchACTAgentHubPackageVersionMock).not.toHaveBeenCalled();
    expect(archiveDownloadCall().artifact).toBe("archive");
    expect(archiveDownloadCall().name).toBe("demo");
    expect(archiveDownloadCall().version).toBe("2026.3.22");
  });

  it("falls back to version metadata when the ACTAgentHub artifact resolver route is missing", async () => {
    fetchACTAgentHubPackageArtifactMock.mockRejectedValueOnce(
      new ACTAgentHubRequestError({
        path: "/api/v1/packages/demo/versions/2026.3.22/artifact",
        status: 404,
        body: "Not Found",
      }),
    );
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
      },
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
        artifact: {
          kind: "npm-pack",
          format: "tgz",
          sha256: DEMO_actagentpack_SHA256,
          size: 4096,
          npmIntegrity: "sha512-actagentpack",
          npmShasum: "1".repeat(40),
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/demo-2026.3.22.tgz",
      integrity: DEMO_actagentpack_INTEGRITY,
      sha256Hex: DEMO_actagentpack_SHA256,
      artifact: "actagentpack",
      actagentpackHeaderSha256: DEMO_actagentpack_SHA256,
      npmIntegrity: "sha512-actagentpack",
      npmShasum: "1".repeat(40),
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.actagenthub?.artifactKind).toBe("npm-pack");
    expect(success.actagenthub?.npmIntegrity).toBe("sha512-actagentpack");
    expect(success.actagenthub?.actagentpackSha256).toBe(DEMO_actagentpack_SHA256);
    expect(packageVersionCall().name).toBe("demo");
    expect(packageVersionCall().version).toBe("2026.3.22");
    expect(archiveDownloadCall().artifact).toBe("actagentpack");
    expect(archiveDownloadCall().name).toBe("demo");
    expect(archiveDownloadCall().version).toBe("2026.3.22");
  });

  it("installs actagentpack artifacts when version metadata has no legacy archive hash", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
        artifact: {
          kind: "npm-pack",
          format: "tgz",
          sha256: DEMO_actagentpack_SHA256,
          size: 4096,
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/demo-2026.3.22.tgz",
      integrity: DEMO_actagentpack_INTEGRITY,
      sha256Hex: DEMO_actagentpack_SHA256,
      artifact: "actagentpack",
      actagentpackHeaderSha256: DEMO_actagentpack_SHA256,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.actagenthub?.integrity).toBe(DEMO_actagentpack_INTEGRITY);
    expect(success.actagenthub?.actagentpackSha256).toBe(DEMO_actagentpack_SHA256);
    expect(archiveDownloadCall().artifact).toBe("actagentpack");
    expect(archiveInstallCall().archivePath).toBe("/tmp/actagenthub-demo/demo-2026.3.22.tgz");
  });

  it("rejects actagentpack artifacts when the download digest does not match version metadata", async () => {
    const mismatchedSha256 = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
        artifact: {
          kind: "npm-pack",
          format: "tgz",
          sha256: DEMO_actagentpack_SHA256,
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/demo-2026.3.22.tgz",
      integrity: `sha256-${Buffer.from(mismatchedSha256, "hex").toString("base64")}`,
      sha256Hex: mismatchedSha256,
      artifact: "actagentpack",
      actagentpackHeaderSha256: mismatchedSha256,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const failure = expectInstallFailure(result);
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH);
    expect(failure.error).toBe(
      `ACTAgentHub actagentpack integrity mismatch for "demo@2026.3.22": expected ${DEMO_actagentpack_SHA256}, got ${mismatchedSha256}.`,
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("points explicit ACTAgentHub actagentpack download failures at npm during launch rollout", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
        artifact: {
          kind: "npm-pack",
          format: "tgz",
          sha256: DEMO_actagentpack_SHA256,
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockRejectedValueOnce(
      new ACTAgentHubRequestError({
        path: "/api/v1/packages/demo/versions/2026.3.22/artifact/download",
        status: 404,
        body: "Not Found",
      }),
    );

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    const failure = expectInstallFailure(result);
    expect(failure.error).toBe(
      'ACTAgentHub artifact download for "demo@2026.3.22" is not available yet (ACTAgentHub /api/v1/packages/demo/versions/2026.3.22/artifact/download failed (404): Not Found). Use "npm:demo@2026.3.22" for launch installs while ACTAgentHub artifact routing is being rolled out.',
    );
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.ARTIFACT_DOWNLOAD_UNAVAILABLE);
    expect(archiveDownloadCall().artifact).toBe("actagentpack");
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("does not persist package-level actagentpack metadata for version records without actagentpack facts", async () => {
    parseACTAgentHubPluginSpecMock.mockReturnValueOnce({ name: "demo", version: "2026.3.21" });
    fetchACTAgentHubPackageDetailMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
        artifact: {
          kind: "npm-pack",
          format: "tgz",
          sha256: DEMO_actagentpack_SHA256,
          size: 4096,
        },
      },
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.21",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo@2026.3.21",
      baseUrl: "https://actagenthub.ai",
    });

    const success = expectInstallSuccess(result);
    expect(success.actagenthub?.source).toBe("actagenthub");
    expect(success.actagenthub?.actagentpackSha256).toBeUndefined();
    expect(success.actagenthub?.actagentpackSpecVersion).toBeUndefined();
    expect(success.actagenthub?.actagentpackManifestSha256).toBeUndefined();
    expect(success.actagenthub?.actagentpackSize).toBeUndefined();
  });

  it("installs when ACTAgentHub advertises a wildcard plugin API range", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: "*",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    expectSuccessfulACTAgentHubInstall(result);
    expect(downloadACTAgentHubPackageArchiveMock).toHaveBeenCalledTimes(1);
    expect(archiveInstallCall().archivePath).toBe("/tmp/actagenthub-demo/archive.zip");
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("installs when a CalVer correction runtime satisfies the base plugin API range", async () => {
    resolveCompatibilityHostVersionMock.mockReturnValueOnce("2026.5.3-1");
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.5.3",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.5.3",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    expectSuccessfulACTAgentHubInstall(result);
    expect(downloadACTAgentHubPackageArchiveMock).toHaveBeenCalledTimes(1);
    expect(archiveInstallCall().archivePath).toBe("/tmp/actagenthub-demo/archive.zip");
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("installs when a beta runtime is on the same plugin API floor", async () => {
    resolveCompatibilityHostVersionMock.mockReturnValueOnce("2026.5.27-beta.1");
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.5.27",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.5.27",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    expectSuccessfulACTAgentHubInstall(result);
    expect(downloadACTAgentHubPackageArchiveMock).toHaveBeenCalledTimes(1);
    expect(archiveInstallCall().archivePath).toBe("/tmp/actagenthub-demo/archive.zip");
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("does not let a wildcard plugin API range hide an invalid runtime version", async () => {
    resolveCompatibilityHostVersionMock.mockReturnValueOnce("invalid");
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: "*",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const failure = expectInstallFailure(result);
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API);
    expect(failure.error).toBe(
      'Plugin "demo" requires plugin API *, but this ACTAgent runtime exposes invalid.',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
    expect(archiveCleanupMock).not.toHaveBeenCalled();
  });

  it("passes dangerous force unsafe install through to archive installs", async () => {
    await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      dangerouslyForceUnsafeInstall: true,
    });

    expect(archiveInstallCall().archivePath).toBe("/tmp/actagenthub-demo/archive.zip");
    expect(archiveInstallCall().dangerouslyForceUnsafeInstall).toBe(true);
  });

  it("cleans up the downloaded archive even when archive install fails", async () => {
    installPluginFromArchiveMock.mockResolvedValueOnce({
      ok: false,
      error: "bad archive",
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      baseUrl: "https://actagenthub.ai",
    });

    expect(expectInstallFailure(result).error).toBe("bad archive");
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("accepts version-endpoint SHA-256 hashes expressed as raw hex", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/archive.zip",
      integrity: "sha256-qerEjGEpvES2+Tyan0j2xwDRkbcnmh4ZFfKN9vWbsa8=",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const success = expectInstallSuccess(result);
    expect(success.pluginId).toBe("demo");
  });

  it("accepts version-endpoint SHA-256 hashes expressed as unpadded SRI", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "sha256-qerEjGEpvES2+Tyan0j2xwDRkbcnmh4ZFfKN9vWbsa8",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const success = expectInstallSuccess(result);
    expect(success.pluginId).toBe("demo");
  });

  it("falls back to strict files[] verification when sha256hash is missing", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
      "dist/index.js": 'export const demo = "ok";',
      "_meta.json": '{"slug":"demo","version":"2026.3.22"}',
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: null,
        files: [
          {
            path: "dist/index.js",
            size: 25,
            sha256: sha256Hex('export const demo = "ok";'),
          },
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      logger,
    });

    const success = expectInstallSuccess(result);
    expect(success.pluginId).toBe("demo");
    expect(logger.warn).toHaveBeenCalledWith(
      'ACTAgentHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: dist/index.js, actagent.plugin.json. Validated generated metadata files present in archive: _meta.json (JSON parse plus slug/version match only).',
    );
  });

  it("validates _meta.json against canonical package and resolved version metadata", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
      "_meta.json": '{"slug":"demo","version":"2026.3.22"}',
    });
    parseACTAgentHubPluginSpecMock.mockReturnValueOnce({ name: "DemoAlias", version: "latest" });
    fetchACTAgentHubPackageDetailMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: null,
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:DemoAlias@latest",
      logger,
    });

    const success = expectInstallSuccess(result);
    expect(success.pluginId).toBe("demo");
    expect(success.version).toBe("2026.3.22");
    expect(packageDetailCall().name).toBe("DemoAlias");
    expect(packageVersionCall().name).toBe("demo");
    expect(packageVersionCall().version).toBe("latest");
    expect(logger.warn).toHaveBeenCalledWith(
      'ACTAgentHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: actagent.plugin.json. Validated generated metadata files present in archive: _meta.json (JSON parse plus slug/version match only).',
    );
  });

  it("fails closed when sha256hash is present but unrecognized instead of silently falling back", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "definitely-not-a-sha256",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const failure = expectInstallFailure(result);
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY);
    expect(failure.error).toBe(
      'ACTAgentHub version metadata for "demo@2026.3.22" has an invalid sha256hash (unrecognized value "definitely-not-a-sha256").',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects ACTAgentHub installs when sha256hash is explicitly null and files[] is unavailable", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: null,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const failure = expectInstallFailure(result);
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.ARTIFACT_UNAVAILABLE);
    expect(failure.error).toBe(
      'ACTAgentHub package "demo@2026.3.22" does not expose a downloadable plugin artifact yet. Use "npm:demo@2026.3.22" for launch installs while ACTAgentHub artifact routing is being rolled out.',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects ACTAgentHub installs when the version metadata has no archive hash or fallback files[]", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const failure = expectInstallFailure(result);
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.ARTIFACT_UNAVAILABLE);
    expect(failure.error).toBe(
      'ACTAgentHub package "demo@2026.3.22" does not expose a downloadable plugin artifact yet. Use "npm:demo@2026.3.22" for launch installs while ACTAgentHub artifact routing is being rolled out.',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("fails closed when files[] contains a malformed entry", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [null as unknown as { path: string; sha256: string }],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    const failure = expectInstallFailure(result);
    expect(failure.code).toBe(ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY);
    expect(failure.error).toBe(
      'ACTAgentHub version metadata for "demo@2026.3.22" has an invalid files[0] entry (expected an object, got null).',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("fails closed when files[] contains an invalid sha256", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: "not-a-digest",
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      'ACTAgentHub version metadata for "demo@2026.3.22" has an invalid files[0].sha256 (value "not-a-digest" is not a 64-character hexadecimal SHA-256 digest).',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("fails closed when sha256hash is not a string", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: 123 as unknown as string,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      'ACTAgentHub version metadata for "demo@2026.3.22" has an invalid sha256hash (non-string value of type number).',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("returns a typed install failure when the archive download throws", async () => {
    downloadACTAgentHubPackageArchiveMock.mockRejectedValueOnce(new Error("network timeout"));

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expect(expectInstallFailure(result).error).toBe("network timeout");
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("returns a typed install failure when fallback archive verification cannot read the zip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "not-a-zip", "utf8");
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      "ACTAgentHub archive fallback verification failed while reading the downloaded archive.",
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects ACTAgentHub installs when the downloaded archive hash drifts from metadata", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "1111111111111111111111111111111111111111111111111111111111111111",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/actagenthub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      `ACTAgentHub archive integrity mismatch for "demo@2026.3.22": expected sha256-ERERERERERERERERERERERERERERERERERERERERERE=, got ${DEMO_ARCHIVE_INTEGRITY}.`,
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("rejects fallback verification when an expected file is missing from the archive", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
          {
            path: "dist/index.js",
            size: 25,
            sha256: sha256Hex('export const demo = "ok";'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      'ACTAgentHub archive contents do not match files[] metadata for "demo@2026.3.22": missing "dist/index.js".',
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the archive includes an unexpected file", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
      "dist/index.js": 'export const demo = "ok";',
      "extra.txt": "surprise",
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
          {
            path: "dist/index.js",
            size: 25,
            sha256: sha256Hex('export const demo = "ok";'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      'ACTAgentHub archive contents do not match files[] metadata for "demo@2026.3.22": unexpected file "extra.txt".',
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("accepts root-level files[] paths and allows _meta.json as an unvalidated generated file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    const zip = new JSZip();
    zip.file("scripts/search.py", "print('ok')\n");
    zip.file("SKILL.md", "# Demo\n");
    zip.file("_meta.json", '{"slug":"demo","version":"2026.3.22"}');
    const archiveBytes = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(archivePath, archiveBytes);
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "scripts/search.py",
            size: 12,
            sha256: sha256Hex("print('ok')\n"),
          },
          {
            path: "SKILL.md",
            size: 7,
            sha256: sha256Hex("# Demo\n"),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: `sha256-${createHash("sha256").update(archiveBytes).digest("base64")}`,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      logger,
    });

    expect(expectInstallSuccess(result).pluginId).toBe("demo");
    expect(logger.warn).toHaveBeenCalledWith(
      'ACTAgentHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: SKILL.md, scripts/search.py. Validated generated metadata files present in archive: _meta.json (JSON parse plus slug/version match only).',
    );
  });

  it("omits the skipped-files suffix when no generated extras are present", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
      logger,
    });

    expect(expectInstallSuccess(result).pluginId).toBe("demo");
    expect(logger.warn).toHaveBeenCalledWith(
      'ACTAgentHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: actagent.plugin.json.',
    );
  });

  it("rejects fallback verification when _meta.json is not valid JSON", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
      "_meta.json": "{not-json",
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      'ACTAgentHub archive contents do not match files[] metadata for "demo@2026.3.22": _meta.json is not valid JSON.',
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when _meta.json slug does not match the package name", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
      "_meta.json": '{"slug":"wrong","version":"2026.3.22"}',
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      'ACTAgentHub archive contents do not match files[] metadata for "demo@2026.3.22": _meta.json slug does not match the package name.',
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when _meta.json exceeds the per-file size limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "placeholder", "utf8");
    const oversizedMetaEntry = {
      name: "_meta.json",
      dir: false,
      _data: { uncompressedSize: 256 * 1024 * 1024 + 1 },
      nodeStream: vi.fn(),
    } as unknown as JSZip.JSZipObject;
    const listedFileEntry = {
      name: "actagent.plugin.json",
      dir: false,
      _data: { uncompressedSize: 13 },
      nodeStream: () => Readable.from([Buffer.from('{"id":"demo"}')]),
    } as unknown as JSZip.JSZipObject;
    const loadAsyncSpy = vi.spyOn(JSZip, "loadAsync").mockResolvedValueOnce({
      files: {
        "_meta.json": oversizedMetaEntry,
        "actagent.plugin.json": listedFileEntry,
      },
    } as unknown as JSZip);
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    loadAsyncSpy.mockRestore();
    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      'ACTAgentHub archive fallback verification rejected "_meta.json" because it exceeds the per-file size limit.',
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when archive directories alone exceed the entry limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "placeholder", "utf8");
    const zipEntries = Object.fromEntries(
      Array.from({ length: 50_001 }, (_, index) => [
        `folder-${index}/`,
        {
          name: `folder-${index}/`,
          dir: true,
        },
      ]),
    );
    const loadAsyncSpy = vi.spyOn(JSZip, "loadAsync").mockResolvedValueOnce({
      files: zipEntries,
    } as unknown as JSZip);
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    loadAsyncSpy.mockRestore();
    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      "ACTAgentHub archive fallback verification exceeded the archive entry limit.",
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the actual ZIP central directory exceeds the entry limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(
      archivePath,
      createZipCentralDirectoryArchive({
        actualEntryCount: 50_001,
        declaredEntryCount: 1,
        declaredCentralDirectorySize: 0,
      }),
    );
    const loadAsyncSpy = vi.spyOn(JSZip, "loadAsync");
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    loadAsyncSpy.mockRestore();
    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      "ACTAgentHub archive fallback verification exceeded the archive entry limit.",
    );
    expect(loadAsyncSpy).not.toHaveBeenCalled();
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the downloaded archive exceeds the ZIP size limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "actagent-actagenthub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "placeholder", "utf8");
    const realStat = fs.stat.bind(fs);
    const statSpy = vi.spyOn(fs, "stat").mockImplementation(async (filePath, options) => {
      if (filePath === archivePath) {
        return {
          size: 256 * 1024 * 1024 + 1,
        } as Awaited<ReturnType<typeof fs.stat>>;
      }
      return await realStat(filePath, options);
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    statSpy.mockRestore();
    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      "ACTAgentHub archive fallback verification rejected the downloaded archive because it exceeds the ZIP archive size limit.",
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when a file hash drifts from files[] metadata", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: "1".repeat(64),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      `ACTAgentHub archive contents do not match files[] metadata for "demo@2026.3.22": expected actagent.plugin.json to hash to ${"1".repeat(64)}, got ${sha256Hex('{"id":"demo"}')}.`,
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata with an unsafe files[] path", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "../evil.txt",
            size: 4,
            sha256: "1".repeat(64),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      'ACTAgentHub version metadata for "demo@2026.3.22" has an invalid files[0].path (path "../evil.txt" contains dot segments).',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata with leading or trailing path whitespace", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json ",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      'ACTAgentHub version metadata for "demo@2026.3.22" has an invalid files[0].path (path "actagent.plugin.json " has leading or trailing whitespace).',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the archive includes a whitespace-suffixed file path", async () => {
    const archive = await createACTAgentHubArchive({
      "actagent.plugin.json": '{"id":"demo"}',
      "actagent.plugin.json ": '{"id":"demo"}',
    });
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadACTAgentHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      'ACTAgentHub archive contents do not match files[] metadata for "demo@2026.3.22": invalid package file path "actagent.plugin.json " (path "actagent.plugin.json " has leading or trailing whitespace).',
    );
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata with duplicate files[] paths", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
          {
            path: "actagent.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      'ACTAgentHub version metadata for "demo@2026.3.22" has duplicate files[] path "actagent.plugin.json".',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata when files[] includes generated _meta.json", async () => {
    fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "_meta.json",
            size: 64,
            sha256: sha256Hex('{"slug":"demo","version":"2026.3.22"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromACTAgentHub({
      spec: "actagenthub:demo",
    });

    expectInstallFailureFields(
      result,
      ACTAGENTHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      'ACTAgentHub version metadata for "demo@2026.3.22" must not include generated file "_meta.json" in files[].',
    );
    expect(downloadACTAgentHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "rejects packages whose plugin API range exceeds the runtime version",
      setup: () => {
        resolveCompatibilityHostVersionMock.mockReturnValueOnce("2026.3.21");
      },
      spec: "actagenthub:demo",
      expected: {
        ok: false,
        code: ACTAGENTHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
        error:
          'Plugin "demo" requires plugin API >=2026.3.22, but this ACTAgent runtime exposes 2026.3.21.',
      },
    },
    {
      name: "rejects skill families and redirects to skills install",
      setup: () => {
        fetchACTAgentHubPackageDetailMock.mockResolvedValueOnce({
          package: {
            name: "calendar",
            displayName: "Calendar",
            family: "skill",
            channel: "official",
            isOfficial: true,
            createdAt: 0,
            updatedAt: 0,
          },
        });
      },
      spec: "actagenthub:calendar",
      expected: {
        ok: false,
        code: ACTAGENTHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
        error: '"calendar" is a skill. Use "actagent skills install calendar" instead.',
      },
    },
    {
      name: "redirects skill families before missing archive metadata checks",
      setup: () => {
        fetchACTAgentHubPackageDetailMock.mockResolvedValueOnce({
          package: {
            name: "calendar",
            displayName: "Calendar",
            family: "skill",
            channel: "official",
            isOfficial: true,
            createdAt: 0,
            updatedAt: 0,
          },
        });
        fetchACTAgentHubPackageVersionMock.mockResolvedValueOnce({
          version: {
            version: "2026.3.22",
            createdAt: 0,
            changelog: "",
          },
        });
      },
      spec: "actagenthub:calendar",
      expected: {
        ok: false,
        code: ACTAGENTHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
        error: '"calendar" is a skill. Use "actagent skills install calendar" instead.',
      },
    },
    {
      name: "returns typed package-not-found failures",
      setup: () => {
        fetchACTAgentHubPackageDetailMock.mockRejectedValueOnce(
          new ACTAgentHubRequestError({
            path: "/api/v1/packages/demo",
            status: 404,
            body: "Package not found",
          }),
        );
      },
      spec: "actagenthub:demo",
      expected: {
        ok: false,
        code: ACTAGENTHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
        error: "Package not found on ACTAgentHub.",
      },
    },
    {
      name: "returns typed version-not-found failures",
      setup: () => {
        parseACTAgentHubPluginSpecMock.mockReturnValueOnce({ name: "demo", version: "9.9.9" });
        fetchACTAgentHubPackageVersionMock.mockRejectedValueOnce(
          new ACTAgentHubRequestError({
            path: "/api/v1/packages/demo/versions/9.9.9",
            status: 404,
            body: "Version not found",
          }),
        );
      },
      spec: "actagenthub:demo@9.9.9",
      expected: {
        ok: false,
        code: ACTAGENTHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND,
        error: "Version not found on ACTAgentHub: demo@9.9.9.",
      },
    },
  ] as const)("$name", async ({ setup, spec, expected }) => {
    await expectACTAgentHubInstallError({ setup, spec, expected });
  });
});
