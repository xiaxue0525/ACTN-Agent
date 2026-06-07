// Covers plugin update flows and install record changes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundledPluginRootAt } from "actagent/plugin-sdk/test-fixtures";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ACTAgentConfig } from "../config/config.js";
import type { PluginNpmIntegrityDriftParams } from "./install.js";

const APP_ROOT = "/app";

function appBundledPluginRoot(pluginId: string): string {
  return bundledPluginRootAt(APP_ROOT, pluginId);
}

function requireExpectedPluginId(params: { expectedPluginId?: string }): string {
  if (!params.expectedPluginId) {
    throw new Error("Expected npm install params to include expectedPluginId");
  }
  return params.expectedPluginId;
}

function requirePluginPackageName(
  plugins: Array<{ pluginId: string; packageName: string }>,
  pluginId: string,
): string {
  const plugin = plugins.find((candidate) => candidate.pluginId === pluginId);
  if (!plugin) {
    throw new Error(`Expected plugin fixture ${pluginId}`);
  }
  return plugin.packageName;
}

const installPluginFromNpmSpecMock = vi.fn();
const installPluginFromMarketplaceMock = vi.fn();
const installPluginFromACTAgentHubMock = vi.fn();
const installPluginFromGitSpecMock = vi.fn();
const resolveBundledPluginSourcesMock = vi.fn();
const runCommandWithTimeoutMock = vi.fn();
const tempDirs: string[] = [];

vi.mock("./install.js", () => ({
  installPluginFromNpmSpec: (...args: unknown[]) => installPluginFromNpmSpecMock(...args),
  resolvePluginInstallDir: (pluginId: string, extensionsDir = "/tmp") =>
    `${extensionsDir}/${pluginId}`,
  PLUGIN_INSTALL_ERROR_CODE: {
    NPM_PACKAGE_NOT_FOUND: "npm_package_not_found",
  },
}));

vi.mock("./git-install.js", () => ({
  installPluginFromGitSpec: (...args: unknown[]) => installPluginFromGitSpecMock(...args),
}));

vi.mock("./marketplace.js", () => ({
  installPluginFromMarketplace: (...args: unknown[]) => installPluginFromMarketplaceMock(...args),
}));

vi.mock("./actagenthub.js", () => ({
  ACTAGENTHUB_INSTALL_ERROR_CODE: {
    PACKAGE_NOT_FOUND: "package_not_found",
    VERSION_NOT_FOUND: "version_not_found",
    ARTIFACT_UNAVAILABLE: "artifact_unavailable",
    ARCHIVE_INTEGRITY_MISMATCH: "archive_integrity_mismatch",
    ARTIFACT_DOWNLOAD_UNAVAILABLE: "artifact_download_unavailable",
  },
  installPluginFromACTAgentHub: (...args: unknown[]) => installPluginFromACTAgentHubMock(...args),
}));

vi.mock("./bundled-sources.js", () => ({
  resolveBundledPluginSources: (...args: unknown[]) => resolveBundledPluginSourcesMock(...args),
}));

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

vi.resetModules();

const { syncPluginsForUpdateChannel, updateNpmInstalledPlugins } = await import("./update.js");

function createSuccessfulNpmUpdateResult(params?: {
  pluginId?: string;
  targetDir?: string;
  version?: string;
  npmResolution?: {
    name: string;
    version: string;
    resolvedSpec: string;
  };
}) {
  return {
    ok: true,
    pluginId: params?.pluginId ?? "opik-actagent",
    targetDir: params?.targetDir ?? "/tmp/opik-actagent",
    version: params?.version ?? "0.2.6",
    extensions: ["index.ts"],
    ...(params?.npmResolution ? { npmResolution: params.npmResolution } : {}),
  };
}

function createSuccessfulACTAgentHubUpdateResult(params?: {
  pluginId?: string;
  targetDir?: string;
  version?: string;
  actagenthubPackage?: string;
}) {
  return {
    ok: true,
    pluginId: params?.pluginId ?? "legacy-chat",
    targetDir: params?.targetDir ?? "/tmp/actagent-plugins/legacy-chat",
    version: params?.version ?? "2026.5.1-beta.2",
    extensions: ["index.ts"],
    packageName: params?.actagenthubPackage ?? "legacy-chat",
    actagenthub: {
      source: "actagenthub" as const,
      actagenthubUrl: "https://actagenthub.ai",
      actagenthubPackage: params?.actagenthubPackage ?? "legacy-chat",
      actagenthubFamily: "code-plugin" as const,
      actagenthubChannel: "official" as const,
      version: params?.version ?? "2026.5.1-beta.2",
      integrity: "sha256-actagentpack",
      resolvedAt: "2026-05-01T00:00:00.000Z",
      artifactKind: "npm-pack" as const,
      artifactFormat: "tgz" as const,
      npmIntegrity: "sha512-actagentpack",
      npmShasum: "2".repeat(40),
      npmTarballName: `${params?.actagenthubPackage ?? "legacy-chat"}-${params?.version ?? "2026.5.1-beta.2"}.tgz`,
      actagentpackSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      actagentpackSpecVersion: 1,
      actagentpackManifestSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      actagentpackSize: 4096,
    },
  };
}

function createNpmInstallConfig(params: {
  pluginId: string;
  spec: string;
  installPath: string;
  integrity?: string;
  shasum?: string;
  resolvedName?: string;
  resolvedSpec?: string;
  resolvedVersion?: string;
  installedAt?: string;
  resolvedAt?: string;
}) {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "npm" as const,
          spec: params.spec,
          installPath: params.installPath,
          ...(params.integrity ? { integrity: params.integrity } : {}),
          ...(params.shasum ? { shasum: params.shasum } : {}),
          ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
          ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
          ...(params.resolvedVersion ? { resolvedVersion: params.resolvedVersion } : {}),
          ...(params.installedAt ? { installedAt: params.installedAt } : {}),
          ...(params.resolvedAt ? { resolvedAt: params.resolvedAt } : {}),
        },
      },
    },
  };
}

function createMarketplaceInstallConfig(params: {
  pluginId: string;
  installPath: string;
  marketplaceSource: string;
  marketplacePlugin: string;
  marketplaceName?: string;
}): ACTAgentConfig {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "marketplace" as const,
          installPath: params.installPath,
          marketplaceSource: params.marketplaceSource,
          marketplacePlugin: params.marketplacePlugin,
          ...(params.marketplaceName ? { marketplaceName: params.marketplaceName } : {}),
        },
      },
    },
  };
}

function createACTAgentHubInstallConfig(params: {
  pluginId: string;
  installPath: string;
  actagenthubUrl: string;
  actagenthubPackage: string;
  actagenthubFamily: "bundle-plugin" | "code-plugin";
  actagenthubChannel: "community" | "official" | "private";
  spec?: string;
}): ACTAgentConfig {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "actagenthub" as const,
          spec: params.spec ?? `actagenthub:${params.actagenthubPackage}`,
          installPath: params.installPath,
          actagenthubUrl: params.actagenthubUrl,
          actagenthubPackage: params.actagenthubPackage,
          actagenthubFamily: params.actagenthubFamily,
          actagenthubChannel: params.actagenthubChannel,
        },
      },
    },
  };
}

function createGitInstallConfig(params: {
  pluginId: string;
  spec: string;
  installPath: string;
  commit?: string;
}): ACTAgentConfig {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "git" as const,
          spec: params.spec,
          installPath: params.installPath,
          ...(params.commit ? { gitCommit: params.commit } : {}),
        },
      },
    },
  };
}

function createBundledPathInstallConfig(params: {
  loadPaths: string[];
  installPath: string;
  sourcePath?: string;
  spec?: string;
}): ACTAgentConfig {
  return {
    plugins: {
      load: { paths: params.loadPaths },
      installs: {
        feishu: {
          source: "path",
          sourcePath: params.sourcePath ?? appBundledPluginRoot("feishu"),
          installPath: params.installPath,
          ...(params.spec ? { spec: params.spec } : {}),
        },
      },
    },
  };
}

function createCodexAppServerInstallConfig(params: {
  spec: string;
  resolvedName?: string;
  resolvedSpec?: string;
}) {
  return {
    plugins: {
      installs: {
        "actagent-codex-app-server": {
          source: "npm" as const,
          spec: params.spec,
          installPath: "/tmp/actagent-codex-app-server",
          ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
          ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
        },
      },
    },
  };
}

function createInstalledPackageDir(params: {
  name?: string;
  version: string;
  peerDependencies?: Record<string, string>;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "actagent-plugin-update-test-"));
  tempDirs.push(dir);
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: params.name ?? "test-plugin",
        version: params.version,
        ...(params.peerDependencies ? { peerDependencies: params.peerDependencies } : {}),
      },
      null,
      2,
    ),
  );
  return dir;
}

function createACTAgentPeerLinkFixtures(plugins: Array<{ pluginId: string; packageName: string }>) {
  const peerTarget = fs.mkdtempSync(path.join(os.tmpdir(), "actagent-peer-target-"));
  tempDirs.push(peerTarget);
  const installPaths = Object.fromEntries(
    plugins.map(({ pluginId, packageName }) => [
      pluginId,
      createInstalledPackageDir({
        name: packageName,
        version: "2026.5.4",
        peerDependencies: { actagent: ">=2026.5.4" },
      }),
    ]),
  );
  const peerLinkPath = (pluginId: string) =>
    path.join(installPaths[pluginId], "node_modules", "actagent");
  const linkPeer = (pluginId: string) => {
    fs.mkdirSync(path.dirname(peerLinkPath(pluginId)), { recursive: true });
    fs.symlinkSync(peerTarget, peerLinkPath(pluginId), "junction");
  };
  return { installPaths, peerLinkPath, linkPeer };
}

function mockNpmViewMetadata(params: {
  name: string;
  version: string;
  integrity?: string;
  shasum?: string;
  actagent?: Record<string, unknown>;
}) {
  runCommandWithTimeoutMock.mockResolvedValueOnce({
    code: 0,
    stdout: JSON.stringify({
      name: params.name,
      version: params.version,
      ...(params.integrity ? { "dist.integrity": params.integrity } : {}),
      ...(params.shasum ? { "dist.shasum": params.shasum } : {}),
      ...(params.actagent ? { actagent: params.actagent } : {}),
    }),
    stderr: "",
  });
}

function mockNpmViewVersions(versions: string[]) {
  runCommandWithTimeoutMock.mockResolvedValueOnce({
    code: 0,
    stdout: JSON.stringify(versions),
    stderr: "",
  });
}

function npmInstallCall(index = 0): Record<string, unknown> | undefined {
  const calls = installPluginFromNpmSpecMock.mock.calls as unknown as Array<
    [Record<string, unknown>]
  >;
  return calls[index]?.[0];
}

function actAgentHubInstallCall(index = 0): Record<string, unknown> | undefined {
  const calls = installPluginFromACTAgentHubMock.mock.calls as unknown as Array<
    [Record<string, unknown>]
  >;
  return calls[index]?.[0];
}

function marketplaceInstallCall(index = 0): Record<string, unknown> | undefined {
  const calls = installPluginFromMarketplaceMock.mock.calls as unknown as Array<
    [Record<string, unknown>]
  >;
  return calls[index]?.[0];
}

function gitInstallCall(index = 0): Record<string, unknown> | undefined {
  const calls = installPluginFromGitSpecMock.mock.calls as unknown as Array<
    [Record<string, unknown>]
  >;
  return calls[index]?.[0];
}

function npmViewCall(): [unknown, Record<string, unknown>] | undefined {
  const calls = runCommandWithTimeoutMock.mock.calls as unknown as Array<
    [unknown, Record<string, unknown>]
  >;
  return calls.find(([argv]) => Array.isArray(argv) && argv[0] === "npm" && argv[1] === "view");
}

function expectRecordFields(
  actual: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual?.[key]).toEqual(value);
  }
}

function expectNpmUpdateCall(params: {
  spec: string;
  expectedIntegrity?: string;
  expectedPluginId?: string;
  timeoutMs?: number;
}) {
  const call = npmInstallCall();
  expect(call?.spec).toBe(params.spec);
  expect(call?.expectedIntegrity).toBe(params.expectedIntegrity);
  if (params.expectedPluginId) {
    expect(call?.expectedPluginId).toBe(params.expectedPluginId);
  }
  if (params.timeoutMs) {
    expect(call?.timeoutMs).toBe(params.timeoutMs);
  }
}

function createBundledSource(params?: { pluginId?: string; localPath?: string; npmSpec?: string }) {
  const pluginId = params?.pluginId ?? "feishu";
  return {
    pluginId,
    localPath: params?.localPath ?? appBundledPluginRoot(pluginId),
    npmSpec: params?.npmSpec ?? `@actagent/${pluginId}`,
  };
}

function mockBundledSources(...sources: ReturnType<typeof createBundledSource>[]) {
  resolveBundledPluginSourcesMock.mockReturnValue(
    new Map(sources.map((source) => [source.pluginId, source])),
  );
}

function expectBundledPathInstall(params: {
  install: Record<string, unknown> | undefined;
  sourcePath: string;
  installPath: string;
  spec?: string;
}) {
  expect(params.install?.source).toBe("path");
  expect(params.install?.sourcePath).toBe(params.sourcePath);
  expect(params.install?.installPath).toBe(params.installPath);
  if (params.spec) {
    expect(params.install?.spec).toBe(params.spec);
  }
}

function expectCodexAppServerInstallState(params: {
  result: Awaited<ReturnType<typeof updateNpmInstalledPlugins>>;
  spec: string;
  version: string;
  resolvedSpec?: string;
}) {
  const install = params.result.config.plugins?.installs?.["actagent-codex-app-server"];
  expect(install?.source).toBe("npm");
  expect(install?.spec).toBe(params.spec);
  expect(install?.installPath).toBe("/tmp/actagent-codex-app-server");
  expect(install?.version).toBe(params.version);
  if (params.resolvedSpec) {
    expect(install?.resolvedSpec).toBe(params.resolvedSpec);
  }
}

describe("updateNpmInstalledPlugins", () => {
  let timeoutBudgetCase: {
    installCall: Record<string, unknown> | undefined;
    npmViewTimeoutMs: unknown;
  };

  beforeAll(async () => {
    installPluginFromNpmSpecMock.mockReset();
    installPluginFromMarketplaceMock.mockReset();
    installPluginFromACTAgentHubMock.mockReset();
    installPluginFromGitSpecMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    runCommandWithTimeoutMock.mockReset();
    const installPath = createInstalledPackageDir({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
    });
    mockNpmViewMetadata({
      name: "@martian-engineering/lossless-actagent",
      version: "0.10.0",
      integrity: "sha512-next",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "lossless-actagent",
        targetDir: installPath,
        version: "0.10.0",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "lossless-actagent",
        spec: "@martian-engineering/lossless-actagent",
        installPath,
        resolvedName: "@martian-engineering/lossless-actagent",
        resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
        resolvedVersion: "0.9.0",
      }),
      pluginIds: ["lossless-actagent"],
      timeoutMs: 1_800_000,
    });

    timeoutBudgetCase = {
      installCall: npmInstallCall(),
      npmViewTimeoutMs: npmViewCall()?.[1]?.timeoutMs,
    };
  });

  beforeEach(() => {
    installPluginFromNpmSpecMock.mockReset();
    installPluginFromMarketplaceMock.mockReset();
    installPluginFromACTAgentHubMock.mockReset();
    installPluginFromGitSpecMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    runCommandWithTimeoutMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: "skips integrity drift checks for unpinned npm specs during dry-run updates",
      config: createNpmInstallConfig({
        pluginId: "opik-actagent",
        spec: "@opik/opik-actagent",
        integrity: "sha512-old",
        installPath: "/tmp/opik-actagent",
      }),
      pluginIds: ["opik-actagent"],
      dryRun: true,
      expectedCall: {
        spec: "@opik/opik-actagent",
        expectedIntegrity: undefined,
      },
    },
    {
      name: "keeps integrity drift checks for exact-version npm specs during dry-run updates",
      config: createNpmInstallConfig({
        pluginId: "opik-actagent",
        spec: "@opik/opik-actagent@0.2.5",
        integrity: "sha512-old",
        installPath: "/tmp/opik-actagent",
      }),
      pluginIds: ["opik-actagent"],
      dryRun: true,
      expectedCall: {
        spec: "@opik/opik-actagent@0.2.5",
        expectedIntegrity: "sha512-old",
      },
    },
    {
      name: "skips recorded integrity checks when an explicit npm version override changes the spec",
      config: createNpmInstallConfig({
        pluginId: "actagent-codex-app-server",
        spec: "actagent-codex-app-server@0.2.0-beta.3",
        integrity: "sha512-old",
        installPath: "/tmp/actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      specOverrides: {
        "actagent-codex-app-server": "actagent-codex-app-server@0.2.0-beta.4",
      },
      installerResult: createSuccessfulNpmUpdateResult({
        pluginId: "actagent-codex-app-server",
        targetDir: "/tmp/actagent-codex-app-server",
        version: "0.2.0-beta.4",
      }),
      expectedCall: {
        spec: "actagent-codex-app-server@0.2.0-beta.4",
        expectedIntegrity: undefined,
      },
    },
  ] as const)(
    "$name",
    async ({ config, pluginIds, dryRun, specOverrides, installerResult, expectedCall }) => {
      installPluginFromNpmSpecMock.mockResolvedValue(
        installerResult ?? createSuccessfulNpmUpdateResult(),
      );

      await updateNpmInstalledPlugins({
        config,
        pluginIds: [...pluginIds],
        ...(dryRun ? { dryRun: true } : {}),
        ...(specOverrides ? { specOverrides } : {}),
      });

      expectNpmUpdateCall(expectedCall);
    },
  );

  it("passes timeout budget to npm plugin metadata checks and installs", async () => {
    expect(timeoutBudgetCase.npmViewTimeoutMs).toBe(1_800_000);
    expectRecordFields(timeoutBudgetCase.installCall, {
      spec: "@martian-engineering/lossless-actagent",
      expectedPluginId: "lossless-actagent",
      timeoutMs: 1_800_000,
    });
  });

  it("trusts official catalog npm updates when the installed package matches the catalog", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2-beta.1",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2-beta.2",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.2-beta.2",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.2-beta.2",
          resolvedSpec: "@actagent/acpx@2026.5.2-beta.2",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2-beta.1",
        resolvedVersion: "2026.5.2-beta.1",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/acpx");
    expect(npmInstallCall()?.expectedPluginId).toBe("acpx");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(result.config.plugins?.installs?.acpx?.spec).toBe("@actagent/acpx@2026.5.2-beta.2");
  });

  it("pins unchanged official npm records during official sync", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-old",
    });

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
        installedAt: "2026-05-01T00:00:00.000Z",
        resolvedAt: "2026-05-01T00:00:01.000Z",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
    });

    expect(result.changed).toBe(true);
    expect(result.outcomes[0]?.status).toBe("unchanged");
    expect(result.config.plugins?.installs?.acpx?.spec).toBe("@actagent/acpx@2026.5.2");
    expect(result.config.plugins?.installs?.acpx?.installedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(result.config.plugins?.installs?.acpx?.resolvedAt).toBe("2026-05-01T00:00:01.000Z");
    expect(npmInstallCall()).toBeUndefined();
  });

  it("keeps integrity drift checks for exact official pins during official sync", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-new",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.2",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.2",
          resolvedSpec: "@actagent/acpx@2026.5.2",
        },
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
    });

    expectNpmUpdateCall({
      spec: "@actagent/acpx",
      expectedPluginId: "acpx",
      expectedIntegrity: "sha512-old",
    });
  });

  it("skips integrity checks when official sync may choose a compatible fallback", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-old",
      actagent: {
        compat: { pluginApi: ">=9999.0.0" },
      },
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.1",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.1",
          resolvedSpec: "@actagent/acpx@2026.5.1",
        },
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
    });

    expectNpmUpdateCall({
      spec: "@actagent/acpx",
      expectedPluginId: "acpx",
      expectedIntegrity: undefined,
    });
  });

  it("keeps integrity drift checks when official latest falls back to pinned stable", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-beta.1",
      integrity: "sha512-beta",
    });
    mockNpmViewVersions(["2026.5.2", "2026.5.3-beta.1"]);
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-old",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.2",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.2",
          resolvedSpec: "@actagent/acpx@2026.5.2",
        },
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
    });

    expectNpmUpdateCall({
      spec: "@actagent/acpx",
      expectedPluginId: "acpx",
      expectedIntegrity: "sha512-old",
    });
  });

  it("keeps integrity drift checks for exact prerelease-only official pins", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/voice-call",
      version: "0.0.2-beta.1",
    });
    mockNpmViewMetadata({
      name: "@actagent/voice-call",
      version: "0.0.2-beta.1",
      integrity: "sha512-beta",
    });
    mockNpmViewVersions(["0.0.1-beta.1", "0.0.2-beta.1"]);
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "voice-call",
        targetDir: installPath,
        version: "0.0.2-beta.1",
        npmResolution: {
          name: "@actagent/voice-call",
          version: "0.0.2-beta.1",
          resolvedSpec: "@actagent/voice-call@0.0.2-beta.1",
        },
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "voice-call",
        spec: "@actagent/voice-call@0.0.2-beta.1",
        installPath,
        resolvedName: "@actagent/voice-call",
        resolvedSpec: "@actagent/voice-call@0.0.2-beta.1",
        resolvedVersion: "0.0.2-beta.1",
        integrity: "sha512-old",
      }),
      pluginIds: ["voice-call"],
      syncOfficialPluginInstalls: true,
    });

    expectNpmUpdateCall({
      spec: "@actagent/voice-call",
      expectedPluginId: "voice-call",
      expectedIntegrity: "sha512-old",
    });
  });

  it("keeps integrity drift checks for exact official pins during beta fallback", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-beta.1",
      integrity: "sha512-beta",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-old",
    });
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error: "No matching version found for @actagent/acpx@beta",
        code: "npm_package_not_found",
      })
      .mockResolvedValueOnce(
        createSuccessfulNpmUpdateResult({
          pluginId: "acpx",
          targetDir: installPath,
          version: "2026.5.2",
          npmResolution: {
            name: "@actagent/acpx",
            version: "2026.5.2",
            resolvedSpec: "@actagent/acpx@2026.5.2",
          },
        }),
      );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
      updateChannel: "beta",
    });

    expect(npmInstallCall(0)?.spec).toBe("@actagent/acpx@beta");
    expect(npmInstallCall(0)?.expectedIntegrity).toBeUndefined();
    expect(npmInstallCall(1)?.spec).toBe("@actagent/acpx");
    expect(npmInstallCall(1)?.expectedIntegrity).toBe("sha512-old");
  });

  it("keeps integrity checks when beta fallback bare spec resolves to a prerelease first", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-beta.1",
      integrity: "sha512-beta",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-beta.1",
      integrity: "sha512-beta",
    });
    mockNpmViewVersions(["2026.5.2", "2026.5.3-beta.1"]);
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-old",
    });
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error: "No matching version found for @actagent/acpx@beta",
        code: "npm_package_not_found",
      })
      .mockResolvedValueOnce(
        createSuccessfulNpmUpdateResult({
          pluginId: "acpx",
          targetDir: installPath,
          version: "2026.5.2",
          npmResolution: {
            name: "@actagent/acpx",
            version: "2026.5.2",
            resolvedSpec: "@actagent/acpx@2026.5.2",
          },
        }),
      );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
      updateChannel: "beta",
    });

    expect(npmInstallCall(0)?.spec).toBe("@actagent/acpx@beta");
    expect(npmInstallCall(0)?.expectedIntegrity).toBeUndefined();
    expect(npmInstallCall(1)?.spec).toBe("@actagent/acpx");
    expect(npmInstallCall(1)?.expectedIntegrity).toBe("sha512-old");
  });

  it("skips fallback integrity checks when official fallback may choose a compatible version", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-beta.1",
      integrity: "sha512-beta",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2",
      integrity: "sha512-old",
      actagent: {
        compat: { pluginApi: ">=9999.0.0" },
      },
    });
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error: "No matching version found for @actagent/acpx@beta",
        code: "npm_package_not_found",
      })
      .mockResolvedValueOnce(
        createSuccessfulNpmUpdateResult({
          pluginId: "acpx",
          targetDir: installPath,
          version: "2026.5.1",
          npmResolution: {
            name: "@actagent/acpx",
            version: "2026.5.1",
            resolvedSpec: "@actagent/acpx@2026.5.1",
          },
        }),
      );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
        integrity: "sha512-old",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
      updateChannel: "beta",
    });

    expect(npmInstallCall(0)?.spec).toBe("@actagent/acpx@beta");
    expect(npmInstallCall(0)?.expectedIntegrity).toBeUndefined();
    expect(npmInstallCall(1)?.spec).toBe("@actagent/acpx");
    expect(npmInstallCall(1)?.expectedIntegrity).toBeUndefined();
  });

  it("keeps third-party moving npm specs when their updates resolve exact artifacts", async () => {
    const installPath = createInstalledPackageDir({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
    });
    mockNpmViewMetadata({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.1",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "lossless-actagent",
        targetDir: installPath,
        version: "0.9.1",
        npmResolution: {
          name: "@martian-engineering/lossless-actagent",
          version: "0.9.1",
          resolvedSpec: "@martian-engineering/lossless-actagent@0.9.1",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "lossless-actagent",
        spec: "@martian-engineering/lossless-actagent",
        installPath,
        resolvedName: "@martian-engineering/lossless-actagent",
        resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
        resolvedVersion: "0.9.0",
      }),
      pluginIds: ["lossless-actagent"],
    });

    expect(result.config.plugins?.installs?.["lossless-actagent"]?.spec).toBe(
      "@martian-engineering/lossless-actagent",
    );
    expect(result.config.plugins?.installs?.["lossless-actagent"]?.resolvedSpec).toBe(
      "@martian-engineering/lossless-actagent@0.9.1",
    );
  });

  it("does not skip trusted official default updates when latest resolves to the installed prerelease", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2-beta.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.2-beta.2",
      integrity: "sha512-beta",
      shasum: "beta",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.2",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.2",
          resolvedSpec: "@actagent/acpx@2026.5.2",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx@2026.5.2-beta.2",
        installPath,
        integrity: "sha512-beta",
        shasum: "beta",
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2-beta.2",
        resolvedVersion: "2026.5.2-beta.2",
      }),
      pluginIds: ["acpx"],
      syncOfficialPluginInstalls: true,
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/acpx");
    expect(npmInstallCall()?.expectedIntegrity).toBeUndefined();
    expect(npmInstallCall()?.expectedPluginId).toBe("acpx");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(result.outcomes[0]?.pluginId).toBe("acpx");
    expect(result.outcomes[0]?.status).toBe("updated");
    expect(result.outcomes[0]?.currentVersion).toBe("2026.5.2-beta.2");
    expect(result.outcomes[0]?.nextVersion).toBe("2026.5.2");
  });

  it("updates trusted official npm plugins when latest resolves to a stable correction release", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.3",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-1",
      integrity: "sha512-correction",
      shasum: "correction",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.3-1",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.3-1",
          resolvedSpec: "@actagent/acpx@2026.5.3-1",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.3",
        resolvedVersion: "2026.5.3",
      }),
      pluginIds: ["acpx"],
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/acpx");
    expect(npmInstallCall()?.expectedPluginId).toBe("acpx");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(result.outcomes[0]?.pluginId).toBe("acpx");
    expect(result.outcomes[0]?.status).toBe("updated");
    expect(result.outcomes[0]?.currentVersion).toBe("2026.5.3");
    expect(result.outcomes[0]?.nextVersion).toBe("2026.5.3-1");
  });

  it("does not trust official npm updates when the install record package mismatches", async () => {
    const installPath = createInstalledPackageDir({
      name: "@vendor/acpx-fork",
      version: "1.0.0",
    });
    mockNpmViewMetadata({
      name: "@vendor/acpx-fork",
      version: "1.0.1",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "1.0.1",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@vendor/acpx-fork",
        installPath,
        resolvedName: "@vendor/acpx-fork",
        resolvedSpec: "@vendor/acpx-fork@1.0.0",
        resolvedVersion: "1.0.0",
      }),
      pluginIds: ["acpx"],
    });

    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).not.toBe(true);
  });

  it("skips npm reinstall and config rewrite when the installed artifact is unchanged", async () => {
    const installPath = createInstalledPackageDir({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
    });
    mockNpmViewMetadata({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockRejectedValue(new Error("installer should not run"));
    const config: ACTAgentConfig = {
      plugins: {
        installs: {
          "lossless-actagent": {
            source: "npm",
            spec: "@martian-engineering/lossless-actagent",
            installPath,
            resolvedName: "@martian-engineering/lossless-actagent",
            resolvedVersion: "0.9.0",
            resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
            integrity: "sha512-same",
            shasum: "same",
          },
        },
      },
    };

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["lossless-actagent"],
    });

    expect(npmViewCall()?.[0]).toEqual([
      "npm",
      "view",
      "@martian-engineering/lossless-actagent",
      "name",
      "version",
      "dist.integrity",
      "dist.shasum",
      "actagent",
      "--json",
    ]);
    if (npmViewCall()?.[1] === undefined) {
      throw new Error("Expected npm view command options");
    }
    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.outcomes).toEqual([
      {
        pluginId: "lossless-actagent",
        status: "unchanged",
        currentVersion: "0.9.0",
        nextVersion: "0.9.0",
        message: "lossless-actagent is up to date (0.9.0).",
      },
    ]);
  });

  it("does not skip unchanged npm plugins when package metadata requires a newer plugin API", async () => {
    vi.stubEnv("ACTAGENT_COMPATIBILITY_HOST_VERSION", "2026.5.28-beta.3");
    const installPath = createInstalledPackageDir({
      name: "@actagent/msteams",
      version: "2026.5.28-beta.4",
    });
    mockNpmViewMetadata({
      name: "@actagent/msteams",
      version: "2026.5.28-beta.4",
      integrity: "sha512-newer",
      shasum: "newer",
      actagent: {
        extensions: ["./dist/index.js"],
        compat: { pluginApi: ">=2026.5.28-beta.4" },
      },
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "msteams",
        targetDir: installPath,
        version: "2026.5.28-beta.3",
        npmResolution: {
          name: "@actagent/msteams",
          version: "2026.5.28-beta.3",
          resolvedSpec: "@actagent/msteams@2026.5.28-beta.3",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "msteams",
        spec: "@actagent/msteams",
        installPath,
        resolvedName: "@actagent/msteams",
        resolvedVersion: "2026.5.28-beta.4",
        resolvedSpec: "@actagent/msteams@2026.5.28-beta.4",
        integrity: "sha512-newer",
        shasum: "newer",
      }),
      pluginIds: ["msteams"],
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/msteams");
    expect(npmInstallCall()?.mode).toBe("update");
    expect(npmInstallCall()?.expectedPluginId).toBe("msteams");
    expect(result.changed).toBe(true);
    expectRecordFields(result.config.plugins?.installs?.msteams, {
      source: "npm",
      version: "2026.5.28-beta.3",
      resolvedName: "@actagent/msteams",
      resolvedVersion: "2026.5.28-beta.3",
      resolvedSpec: "@actagent/msteams@2026.5.28-beta.3",
    });
    expect(result.outcomes).toEqual([
      {
        pluginId: "msteams",
        status: "updated",
        currentVersion: "2026.5.28-beta.4",
        nextVersion: "2026.5.28-beta.3",
        message: "Updated msteams: 2026.5.28-beta.4 -> 2026.5.28-beta.3.",
      },
    ]);
  });

  it("does not skip unchanged npm plugins when package metadata requires a newer host", async () => {
    vi.stubEnv("ACTAGENT_COMPATIBILITY_HOST_VERSION", "2026.5.28-beta.3");
    const installPath = createInstalledPackageDir({
      name: "@actagent/msteams",
      version: "2026.5.28-beta.4",
    });
    mockNpmViewMetadata({
      name: "@actagent/msteams",
      version: "2026.5.28-beta.4",
      integrity: "sha512-newer",
      shasum: "newer",
      actagent: {
        extensions: ["./dist/index.js"],
        install: { minHostVersion: ">=2026.5.28-beta.4" },
      },
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "msteams",
        targetDir: installPath,
        version: "2026.5.28-beta.3",
        npmResolution: {
          name: "@actagent/msteams",
          version: "2026.5.28-beta.3",
          resolvedSpec: "@actagent/msteams@2026.5.28-beta.3",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "msteams",
        spec: "@actagent/msteams",
        installPath,
        resolvedName: "@actagent/msteams",
        resolvedVersion: "2026.5.28-beta.4",
        resolvedSpec: "@actagent/msteams@2026.5.28-beta.4",
        integrity: "sha512-newer",
        shasum: "newer",
      }),
      pluginIds: ["msteams"],
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/msteams");
    expect(npmInstallCall()?.mode).toBe("update");
    expect(result.changed).toBe(true);
    expectRecordFields(result.config.plugins?.installs?.msteams, {
      source: "npm",
      version: "2026.5.28-beta.3",
      resolvedName: "@actagent/msteams",
      resolvedVersion: "2026.5.28-beta.3",
      resolvedSpec: "@actagent/msteams@2026.5.28-beta.3",
    });
  });

  it("repairs missing actagent peer links before skipping unchanged npm plugins", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/codex",
      version: "2026.5.3",
      peerDependencies: { actagent: ">=2026.5.3" },
    });
    mockNpmViewMetadata({
      name: "@actagent/codex",
      version: "2026.5.3",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "codex",
        targetDir: installPath,
        version: "2026.5.3",
        npmResolution: {
          name: "@actagent/codex",
          version: "2026.5.3",
          resolvedSpec: "@actagent/codex@2026.5.3",
        },
      }),
    );
    const config: ACTAgentConfig = {
      plugins: {
        installs: {
          codex: {
            source: "npm",
            spec: "@actagent/codex",
            installPath,
            resolvedName: "@actagent/codex",
            resolvedVersion: "2026.5.3",
            resolvedSpec: "@actagent/codex@2026.5.3",
            integrity: "sha512-same",
            shasum: "same",
          },
        },
      },
    };

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["codex"],
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/codex");
    expect(npmInstallCall()?.mode).toBe("update");
    expect(npmInstallCall()?.expectedPluginId).toBe("codex");
    expect(result.changed).toBe(true);
    expect(result.outcomes).toEqual([
      {
        pluginId: "codex",
        status: "unchanged",
        currentVersion: "2026.5.3",
        nextVersion: "2026.5.3",
        message: "codex already at 2026.5.3.",
      },
    ]);
  });

  it("skips unchanged npm plugins when the actagent peer link already resolves", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/codex",
      version: "2026.5.3",
      peerDependencies: { actagent: ">=2026.5.3" },
    });
    fs.mkdirSync(path.join(installPath, "node_modules", "actagent"), { recursive: true });
    mockNpmViewMetadata({
      name: "@actagent/codex",
      version: "2026.5.3",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockRejectedValue(new Error("installer should not run"));

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: {
            codex: {
              source: "npm",
              spec: "@actagent/codex",
              installPath,
              resolvedName: "@actagent/codex",
              resolvedVersion: "2026.5.3",
              resolvedSpec: "@actagent/codex@2026.5.3",
              integrity: "sha512-same",
              shasum: "same",
            },
          },
        },
      },
      pluginIds: ["codex"],
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.outcomes).toEqual([
      {
        pluginId: "codex",
        status: "unchanged",
        currentVersion: "2026.5.3",
        nextVersion: "2026.5.3",
        message: "codex is up to date (2026.5.3).",
      },
    ]);
  });

  it("repairs actagent peer links after batch npm updates prune earlier plugin links", async () => {
    const plugins = [
      { pluginId: "brave", packageName: "@actagent/brave-plugin" },
      { pluginId: "codex", packageName: "@actagent/codex" },
      { pluginId: "discord", packageName: "@actagent/discord" },
    ];
    const { installPaths, peerLinkPath, linkPeer } = createACTAgentPeerLinkFixtures(plugins);
    for (const { packageName } of plugins) {
      mockNpmViewMetadata({
        name: packageName,
        version: "2026.5.4",
        integrity: "sha512-same",
        shasum: "same",
      });
    }
    installPluginFromNpmSpecMock.mockImplementation(
      (params: { expectedPluginId?: string; spec: string }) => {
        const pluginId = requireExpectedPluginId(params);
        for (const { pluginId: installedPluginId } of plugins) {
          fs.rmSync(peerLinkPath(installedPluginId), { recursive: true, force: true });
        }
        linkPeer(pluginId);
        const packageName = requirePluginPackageName(plugins, pluginId);
        return Promise.resolve(
          createSuccessfulNpmUpdateResult({
            pluginId,
            targetDir: installPaths[pluginId],
            version: "2026.5.4",
            npmResolution: {
              name: packageName,
              version: "2026.5.4",
              resolvedSpec: `${packageName}@2026.5.4`,
            },
          }),
        );
      },
    );

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: Object.fromEntries(
            plugins.map(({ pluginId, packageName }) => [
              pluginId,
              {
                source: "npm",
                spec: packageName,
                installPath: installPaths[pluginId],
                resolvedName: packageName,
                resolvedVersion: "2026.5.4",
                resolvedSpec: `${packageName}@2026.5.4`,
                integrity: "sha512-same",
                shasum: "same",
              },
            ]),
          ),
        },
      },
      pluginIds: plugins.map((plugin) => plugin.pluginId),
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(3);
    for (const { pluginId } of plugins) {
      expect(fs.existsSync(peerLinkPath(pluginId))).toBe(true);
    }
    expect(result.outcomes).toEqual(
      plugins.map(({ pluginId }) => ({
        pluginId,
        status: "unchanged",
        currentVersion: "2026.5.4",
        nextVersion: "2026.5.4",
        message: `${pluginId} already at 2026.5.4.`,
      })),
    );
  });

  it("repairs sibling actagent peer links after a targeted npm update prunes the shared install tree", async () => {
    const plugins = [
      { pluginId: "brave", packageName: "@actagent/brave-plugin" },
      { pluginId: "codex", packageName: "@actagent/codex" },
      { pluginId: "discord", packageName: "@actagent/discord" },
    ];
    const { installPaths, peerLinkPath, linkPeer } = createACTAgentPeerLinkFixtures(plugins);
    linkPeer("brave");
    linkPeer("discord");
    mockNpmViewMetadata({
      name: "@actagent/codex",
      version: "2026.5.4",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockImplementation(() => {
      for (const { pluginId } of plugins) {
        fs.rmSync(peerLinkPath(pluginId), { recursive: true, force: true });
      }
      linkPeer("codex");
      return Promise.resolve(
        createSuccessfulNpmUpdateResult({
          pluginId: "codex",
          targetDir: installPaths.codex,
          version: "2026.5.4",
          npmResolution: {
            name: "@actagent/codex",
            version: "2026.5.4",
            resolvedSpec: "@actagent/codex@2026.5.4",
          },
        }),
      );
    });

    await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: Object.fromEntries(
            plugins.map(({ pluginId, packageName }) => [
              pluginId,
              {
                source: "npm",
                spec: packageName,
                installPath: installPaths[pluginId],
                resolvedName: packageName,
                resolvedVersion: "2026.5.4",
                resolvedSpec: `${packageName}@2026.5.4`,
                integrity: "sha512-same",
                shasum: "same",
              },
            ]),
          ),
        },
      },
      pluginIds: ["codex"],
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(1);
    for (const { pluginId } of plugins) {
      expect(fs.existsSync(peerLinkPath(pluginId))).toBe(true);
    }
  });

  it("continues repairing sibling actagent peer links after one recorded npm install cannot be relinked", async () => {
    const plugins = [
      { pluginId: "brave", packageName: "@actagent/brave-plugin" },
      { pluginId: "codex", packageName: "@actagent/codex" },
    ];
    const { installPaths, peerLinkPath, linkPeer } = createACTAgentPeerLinkFixtures(plugins);
    const brokenInstallPath = createInstalledPackageDir({
      name: "@actagent/broken-plugin",
      version: "2026.5.4",
      peerDependencies: { actagent: ">=2026.5.4" },
    });
    fs.writeFileSync(path.join(brokenInstallPath, "node_modules"), "not a directory");
    linkPeer("brave");
    mockNpmViewMetadata({
      name: "@actagent/codex",
      version: "2026.5.4",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockImplementation(() => {
      for (const { pluginId } of plugins) {
        fs.rmSync(peerLinkPath(pluginId), { recursive: true, force: true });
      }
      linkPeer("codex");
      return Promise.resolve(
        createSuccessfulNpmUpdateResult({
          pluginId: "codex",
          targetDir: installPaths.codex,
          version: "2026.5.4",
          npmResolution: {
            name: "@actagent/codex",
            version: "2026.5.4",
            resolvedSpec: "@actagent/codex@2026.5.4",
          },
        }),
      );
    });
    const warnMessages: string[] = [];

    await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: {
            broken: {
              source: "npm",
              spec: "@actagent/broken-plugin",
              installPath: brokenInstallPath,
              resolvedName: "@actagent/broken-plugin",
              resolvedVersion: "2026.5.4",
              resolvedSpec: "@actagent/broken-plugin@2026.5.4",
            },
            ...Object.fromEntries(
              plugins.map(({ pluginId, packageName }) => [
                pluginId,
                {
                  source: "npm",
                  spec: packageName,
                  installPath: installPaths[pluginId],
                  resolvedName: packageName,
                  resolvedVersion: "2026.5.4",
                  resolvedSpec: `${packageName}@2026.5.4`,
                  integrity: "sha512-same",
                  shasum: "same",
                },
              ]),
            ),
          },
        },
      },
      pluginIds: ["codex"],
      logger: { warn: (message) => warnMessages.push(message) },
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(peerLinkPath("brave"))).toBe(true);
    expect(fs.existsSync(peerLinkPath("codex"))).toBe(true);
    expect(warnMessages).toEqual([
      `Could not repair actagent peer link for "broken" at ${brokenInstallPath}: Skipping actagent peerDependency link because ${path.join(brokenInstallPath, "node_modules")} is not a real directory.`,
    ]);
  });

  it("refreshes legacy npm install records before skipping unchanged artifacts", async () => {
    const installPath = createInstalledPackageDir({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
    });
    mockNpmViewMetadata({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "lossless-actagent",
        targetDir: installPath,
        version: "0.9.0",
        npmResolution: {
          name: "@martian-engineering/lossless-actagent",
          version: "0.9.0",
          resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "lossless-actagent",
        spec: "@martian-engineering/lossless-actagent",
        installPath,
      }),
      pluginIds: ["lossless-actagent"],
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(1);
    expect(result.changed).toBe(true);
    expectRecordFields(result.outcomes[0], {
      pluginId: "lossless-actagent",
      status: "unchanged",
      currentVersion: "0.9.0",
      nextVersion: "0.9.0",
    });
    expectRecordFields(result.config.plugins?.installs?.["lossless-actagent"], {
      source: "npm",
      spec: "@martian-engineering/lossless-actagent",
      resolvedName: "@martian-engineering/lossless-actagent",
      resolvedVersion: "0.9.0",
      resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
    });
  });

  it("expands home-relative install paths before checking installed npm versions", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "actagent-plugin-update-home-"));
    tempDirs.push(home);
    const installPath = path.join(home, ".actagent", "extensions", "lossless-actagent");
    fs.mkdirSync(installPath, { recursive: true });
    fs.writeFileSync(
      path.join(installPath, "package.json"),
      JSON.stringify({ name: "@martian-engineering/lossless-actagent", version: "0.9.0" }),
    );
    vi.stubEnv("HOME", home);
    mockNpmViewMetadata({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
      integrity: "sha512-same",
      shasum: "same",
    });
    installPluginFromNpmSpecMock.mockRejectedValue(new Error("installer should not run"));

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "lossless-actagent",
        spec: "@martian-engineering/lossless-actagent",
        installPath: "~/.actagent/extensions/lossless-actagent",
        resolvedName: "@martian-engineering/lossless-actagent",
        resolvedVersion: "0.9.0",
        resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
        integrity: "sha512-same",
        shasum: "same",
      }),
      pluginIds: ["lossless-actagent"],
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.outcomes).toHaveLength(1);
    expectRecordFields(result.outcomes[0], {
      pluginId: "lossless-actagent",
      status: "unchanged",
      currentVersion: "0.9.0",
    });
  });

  it("falls through to npm reinstall when the recorded integrity differs", async () => {
    const installPath = createInstalledPackageDir({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
    });
    mockNpmViewMetadata({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
      integrity: "sha512-new",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "lossless-actagent",
        targetDir: installPath,
        version: "0.9.0",
        npmResolution: {
          name: "@martian-engineering/lossless-actagent",
          version: "0.9.0",
          resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: {
            "lossless-actagent": {
              source: "npm",
              spec: "@martian-engineering/lossless-actagent",
              installPath,
              resolvedName: "@martian-engineering/lossless-actagent",
              resolvedVersion: "0.9.0",
              resolvedSpec: "@martian-engineering/lossless-actagent@0.9.0",
              integrity: "sha512-old",
            },
          },
        },
      },
      pluginIds: ["lossless-actagent"],
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(1);
    expect(result.changed).toBe(true);
    expectRecordFields(result.outcomes[0], {
      pluginId: "lossless-actagent",
      status: "unchanged",
      currentVersion: "0.9.0",
      nextVersion: "0.9.0",
    });
  });

  it("falls through to npm reinstall when metadata probing fails", async () => {
    const warn = vi.fn();
    const installPath = createInstalledPackageDir({
      name: "@martian-engineering/lossless-actagent",
      version: "0.9.0",
    });
    runCommandWithTimeoutMock.mockResolvedValueOnce({
      code: 1,
      stdout: "",
      stderr: "registry timeout",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "lossless-actagent",
        targetDir: installPath,
        version: "0.9.0",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "lossless-actagent",
        spec: "@martian-engineering/lossless-actagent",
        installPath,
      }),
      pluginIds: ["lossless-actagent"],
      logger: { warn },
    });

    expect(warn).toHaveBeenCalledWith(
      "Could not check lossless-actagent before update; falling back to installer path: npm view failed: registry timeout",
    );
    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      source: "npm",
      config: {
        plugins: {
          entries: {
            demo: {
              enabled: false,
              config: { preserved: true },
            },
          },
          installs: {
            demo: {
              source: "npm" as const,
              spec: "@acme/demo",
              installPath: "/tmp/demo",
              resolvedName: "@acme/demo",
            },
          },
        },
      } satisfies ACTAgentConfig,
    },
    {
      source: "ACTAgentHub",
      config: {
        plugins: {
          entries: {
            demo: {
              enabled: false,
              config: { preserved: true },
            },
          },
          installs: {
            demo: {
              source: "actagenthub" as const,
              spec: "actagenthub:demo",
              installPath: "/tmp/demo",
              actagenthubUrl: "https://actagenthub.ai",
              actagenthubPackage: "demo",
              actagenthubFamily: "code-plugin",
              actagenthubChannel: "official",
            },
          },
        },
      } satisfies ACTAgentConfig,
    },
    {
      source: "marketplace",
      config: {
        plugins: {
          entries: {
            demo: {
              enabled: false,
              config: { preserved: true },
            },
          },
          installs: {
            demo: {
              source: "marketplace" as const,
              installPath: "/tmp/demo",
              marketplaceSource: "acme/plugins",
              marketplacePlugin: "demo",
            },
          },
        },
      } satisfies ACTAgentConfig,
    },
  ])("skips disabled $source installs before update network calls", async ({ config }) => {
    installPluginFromNpmSpecMock.mockRejectedValue(new Error("npm installer should not run"));
    installPluginFromACTAgentHubMock.mockRejectedValue(new Error("ACTAgentHub installer should not run"));
    installPluginFromMarketplaceMock.mockRejectedValue(
      new Error("marketplace installer should not run"),
    );

    const result = await updateNpmInstalledPlugins({
      config,
      skipDisabledPlugins: true,
    });

    expect(runCommandWithTimeoutMock).not.toHaveBeenCalled();
    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(installPluginFromACTAgentHubMock).not.toHaveBeenCalled();
    expect(installPluginFromMarketplaceMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.config.plugins?.installs?.demo).toEqual(config.plugins.installs.demo);
    expect(result.config.plugins?.entries?.demo).toEqual({
      enabled: false,
      config: { preserved: true },
    });
    expect(result.outcomes).toEqual([
      {
        pluginId: "demo",
        status: "skipped",
        message: 'Skipping "demo" (disabled in config).',
      },
    ]);
  });

  it("updates disabled trusted official npm installs from the channel spec when requested", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/codex",
      version: "2026.5.3",
    });
    mockNpmViewMetadata({
      name: "@actagent/codex",
      version: "2026.5.4",
      integrity: "sha512-next",
      shasum: "next",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "codex",
        targetDir: installPath,
        version: "2026.5.4",
        npmResolution: {
          name: "@actagent/codex",
          version: "2026.5.4",
          resolvedSpec: "@actagent/codex@2026.5.4",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          entries: {
            codex: {
              enabled: false,
              config: { preserved: true },
            },
          },
          installs: {
            codex: {
              source: "npm",
              spec: "@actagent/codex@2026.5.3",
              installPath,
            },
          },
        },
      },
      skipDisabledPlugins: true,
      syncOfficialPluginInstalls: true,
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/codex");
    expect(npmInstallCall()?.expectedPluginId).toBe("codex");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.entries?.codex).toEqual({
      enabled: false,
      config: { preserved: true },
    });
    expectRecordFields(result.config.plugins?.installs?.codex, {
      source: "npm",
      spec: "@actagent/codex@2026.5.4",
      version: "2026.5.4",
      resolvedName: "@actagent/codex",
      resolvedVersion: "2026.5.4",
      resolvedSpec: "@actagent/codex@2026.5.4",
    });
    expectRecordFields(result.outcomes[0], {
      pluginId: "codex",
      status: "updated",
      currentVersion: "2026.5.3",
      nextVersion: "2026.5.4",
    });
  });

  it("preserves exact official npm pins when official install sync is not requested", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/codex",
      version: "2026.5.28",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "codex",
        targetDir: installPath,
        version: "2026.5.28",
        npmResolution: {
          name: "@actagent/codex",
          version: "2026.5.28",
          resolvedSpec: "@actagent/codex@2026.5.28",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "codex",
        spec: "@actagent/codex@2026.5.28",
        installPath,
        resolvedName: "@actagent/codex",
        resolvedSpec: "@actagent/codex@2026.5.28",
        resolvedVersion: "2026.5.28",
      }),
      pluginIds: ["codex"],
      dryRun: true,
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/codex@2026.5.28");
    expect(npmInstallCall()?.expectedPluginId).toBe("codex");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(result.changed).toBe(false);
    expectRecordFields(result.outcomes[0], {
      pluginId: "codex",
      status: "unchanged",
      currentVersion: "2026.5.28",
      nextVersion: "2026.5.28",
    });
  });

  it("reinstalls missing exact official npm pins without official install sync", async () => {
    const extensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "actagent-missing-plugin-"));
    tempDirs.push(extensionsDir);
    const installPath = path.join(extensionsDir, "codex");
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "codex",
        targetDir: installPath,
        version: "2026.5.28",
        npmResolution: {
          name: "@actagent/codex",
          version: "2026.5.28",
          resolvedSpec: "@actagent/codex@2026.5.28",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "codex",
        spec: "@actagent/codex@2026.5.28",
        installPath,
        resolvedName: "@actagent/codex",
        resolvedSpec: "@actagent/codex@2026.5.28",
        resolvedVersion: "2026.5.28",
      }),
      pluginIds: ["codex"],
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/codex@2026.5.28");
    expect(npmInstallCall()?.extensionsDir).toBe(extensionsDir);
    expect(runCommandWithTimeoutMock).not.toHaveBeenCalled();
    expectRecordFields(result.config.plugins?.installs?.codex, {
      source: "npm",
      spec: "@actagent/codex@2026.5.28",
      installPath,
      version: "2026.5.28",
      resolvedName: "@actagent/codex",
      resolvedSpec: "@actagent/codex@2026.5.28",
      resolvedVersion: "2026.5.28",
    });
    expectRecordFields(result.outcomes[0], {
      pluginId: "codex",
      status: "updated",
      nextVersion: "2026.5.28",
    });
  });

  it("keeps integrity checks when official sync repairs missing exact npm pins", async () => {
    const extensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "actagent-missing-plugin-"));
    tempDirs.push(extensionsDir);
    const installPath = path.join(extensionsDir, "codex");
    mockNpmViewMetadata({
      name: "@actagent/codex",
      version: "2026.5.28",
      integrity: "sha512-old",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "codex",
        targetDir: installPath,
        version: "2026.5.28",
        npmResolution: {
          name: "@actagent/codex",
          version: "2026.5.28",
          resolvedSpec: "@actagent/codex@2026.5.28",
        },
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "codex",
        spec: "@actagent/codex@2026.5.28",
        installPath,
        resolvedName: "@actagent/codex",
        resolvedSpec: "@actagent/codex@2026.5.28",
        resolvedVersion: "2026.5.28",
        integrity: "sha512-old",
      }),
      pluginIds: ["codex"],
      syncOfficialPluginInstalls: true,
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/codex");
    expect(npmInstallCall()?.expectedIntegrity).toBe("sha512-old");
  });

  it("keeps third-party exact pinned npm specs pinned during official install sync", async () => {
    const installPath = createInstalledPackageDir({
      name: "@acme/demo",
      version: "1.2.3",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "demo",
        targetDir: installPath,
        version: "1.2.3",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "demo",
        spec: "@acme/demo@1.2.3",
        installPath,
      }),
      pluginIds: ["demo"],
      dryRun: true,
      syncOfficialPluginInstalls: true,
    });

    expect(npmInstallCall()?.spec).toBe("@acme/demo@1.2.3");
    expect(npmInstallCall()?.expectedPluginId).toBe("demo");
  });

  it("uses exact npm spec selectors as dry-run target versions when probes omit metadata", async () => {
    const installPath = createInstalledPackageDir({
      name: "@acme/demo",
      version: "1.2.3",
    });
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: installPath,
      extensions: ["index.ts"],
    });

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "demo",
        spec: "@acme/demo@1.2.4",
        installPath,
      }),
      pluginIds: ["demo"],
      dryRun: true,
    });

    expectRecordFields(result.outcomes[0], {
      pluginId: "demo",
      status: "updated",
      currentVersion: "1.2.3",
      nextVersion: "1.2.4",
      message: "Would update demo: 1.2.3 -> 1.2.4.",
    });
  });

  it("keeps exact npm dry-runs unchanged when probe metadata is absent but spec matches", async () => {
    const installPath = createInstalledPackageDir({
      name: "@acme/demo",
      version: "1.2.3",
    });
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: installPath,
      extensions: ["index.ts"],
    });

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "demo",
        spec: "@acme/demo@1.2.3",
        installPath,
      }),
      pluginIds: ["demo"],
      dryRun: true,
    });

    expectRecordFields(result.outcomes[0], {
      pluginId: "demo",
      status: "unchanged",
      currentVersion: "1.2.3",
      nextVersion: "1.2.3",
      message: "demo is up to date (1.2.3).",
    });
  });

  it("updates disabled trusted official ACTAgentHub installs through the catalog spec", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "diagnostics-otel",
        targetDir: "/tmp/diagnostics-otel",
        version: "2026.5.4",
        actagenthubPackage: "@actagent/diagnostics-otel",
      }),
    );

    const config = createACTAgentHubInstallConfig({
      pluginId: "diagnostics-otel",
      installPath: "/tmp/diagnostics-otel",
      actagenthubUrl: "https://actagenthub.ai",
      actagenthubPackage: "@actagent/diagnostics-otel",
      actagenthubFamily: "code-plugin",
      actagenthubChannel: "official",
      spec: "actagenthub:@actagent/diagnostics-otel@2026.5.3",
    });
    const result = await updateNpmInstalledPlugins({
      config: {
        ...config,
        plugins: {
          ...config.plugins,
          entries: {
            "diagnostics-otel": {
              enabled: false,
              config: { preserved: true },
            },
          },
        },
      },
      skipDisabledPlugins: true,
      syncOfficialPluginInstalls: true,
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:@actagent/diagnostics-otel");
    expect(actAgentHubInstallCall()?.expectedPluginId).toBe("diagnostics-otel");
    expectRecordFields(result.config.plugins?.installs?.["diagnostics-otel"], {
      source: "actagenthub",
      spec: "actagenthub:@actagent/diagnostics-otel",
      version: "2026.5.4",
      actagenthubPackage: "@actagent/diagnostics-otel",
      actagenthubChannel: "official",
    });
    expect(result.config.plugins?.entries?.["diagnostics-otel"]).toEqual({
      enabled: false,
      config: { preserved: true },
    });
  });

  it("updates bare trusted official ACTAgentHub installs through the catalog spec", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "diagnostics-prometheus",
        targetDir: "/tmp/diagnostics-prometheus",
        version: "2026.5.4",
        actagenthubPackage: "@actagent/diagnostics-prometheus",
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: {
            "diagnostics-prometheus": {
              source: "actagenthub",
              spec: "actagenthub:@actagent/diagnostics-prometheus@2026.5.3",
              installPath: "/tmp/diagnostics-prometheus",
            },
          },
        },
      },
      syncOfficialPluginInstalls: true,
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:@actagent/diagnostics-prometheus");
    expect(actAgentHubInstallCall()?.expectedPluginId).toBe("diagnostics-prometheus");
    expectRecordFields(result.config.plugins?.installs?.["diagnostics-prometheus"], {
      source: "actagenthub",
      spec: "actagenthub:@actagent/diagnostics-prometheus",
      version: "2026.5.4",
      actagenthubPackage: "@actagent/diagnostics-prometheus",
      actagenthubChannel: "official",
    });
  });

  it("keeps enabled tracked plugin update failures fatal when disabled skipping is enabled", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: false,
      error: "registry timeout",
    });
    const config = {
      plugins: {
        entries: {
          demo: {
            enabled: true,
          },
        },
        installs: {
          demo: {
            source: "npm" as const,
            spec: "@acme/demo",
            installPath: "/tmp/demo",
          },
        },
      },
    } satisfies ACTAgentConfig;

    const result = await updateNpmInstalledPlugins({
      config,
      skipDisabledPlugins: true,
      dryRun: true,
    });

    expect(npmInstallCall()?.spec).toBe("@acme/demo");
    expect(npmInstallCall()?.expectedPluginId).toBe("demo");
    expect(npmInstallCall()?.dryRun).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.outcomes).toEqual([
      {
        pluginId: "demo",
        status: "error",
        message: "Failed to check demo: registry timeout",
      },
    ]);
  });

  it("disables enabled tracked plugin update failures when requested", async () => {
    const warn = vi.fn();
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: false,
      error: "registry timeout",
    });
    const config = {
      plugins: {
        entries: {
          demo: {
            enabled: true,
            config: { preserved: true },
          },
        },
        installs: {
          demo: {
            source: "npm" as const,
            spec: "@acme/demo",
            installPath: "/tmp/demo",
          },
        },
      },
    } satisfies ACTAgentConfig;

    const result = await updateNpmInstalledPlugins({
      config,
      skipDisabledPlugins: true,
      disableOnFailure: true,
      logger: { warn },
    });

    expect(npmInstallCall()?.spec).toBe("@acme/demo");
    expect(npmInstallCall()?.expectedPluginId).toBe("demo");
    const message =
      'Disabled "demo" after plugin update failure; ACTAgent will continue without it. Failed to update demo: registry timeout';
    expect(warn).toHaveBeenCalledWith(message);
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.entries?.demo).toEqual({
      enabled: false,
      config: { preserved: true },
    });
    expect(result.config.plugins?.installs?.demo).toEqual(config.plugins.installs.demo);
    expect(result.outcomes).toEqual([
      {
        pluginId: "demo",
        status: "skipped",
        message,
      },
    ]);
  });

  it("clears stale plugin policy and slot references when disabling failed updates", async () => {
    const warn = vi.fn();
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: false,
      error: "security scan blocked install",
    });
    const config = {
      plugins: {
        allow: ["demo", "keep"],
        deny: ["demo", "blocked"],
        slots: {
          memory: "demo",
          contextEngine: "demo",
        },
        entries: {
          demo: {
            enabled: true,
          },
        },
        installs: {
          demo: {
            source: "npm" as const,
            spec: "@acme/demo",
            installPath: "/tmp/demo",
          },
        },
      },
    } satisfies ACTAgentConfig;

    const result = await updateNpmInstalledPlugins({
      config,
      disableOnFailure: true,
      logger: { warn },
    });

    const message =
      'Disabled "demo" after plugin update failure; ACTAgent will continue without it. Failed to update demo: security scan blocked install';
    expect(warn).toHaveBeenCalledWith(message);
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.entries?.demo).toEqual({
      enabled: false,
    });
    expect(result.config.plugins?.installs?.demo).toEqual(config.plugins.installs.demo);
    expect(result.config.plugins?.allow).toEqual(["keep"]);
    expect(result.config.plugins?.deny).toEqual(["blocked"]);
    expect(result.config.plugins?.slots).toEqual({
      memory: "memory-core",
      contextEngine: "legacy",
    });
    expect(result.outcomes).toEqual([
      {
        pluginId: "demo",
        status: "skipped",
        message,
      },
    ]);
  });

  it("aborts exact pinned npm plugin updates on integrity drift by default", async () => {
    const warn = vi.fn();
    installPluginFromNpmSpecMock.mockImplementation(
      async (params: {
        spec: string;
        onIntegrityDrift?: (drift: PluginNpmIntegrityDriftParams) => boolean | Promise<boolean>;
      }) => {
        const proceed = await params.onIntegrityDrift?.({
          spec: params.spec,
          expectedIntegrity: "sha512-old",
          actualIntegrity: "sha512-new",
          resolution: {
            integrity: "sha512-new",
            resolvedSpec: "@opik/opik-actagent@0.2.5",
            version: "0.2.5",
          },
        });
        if (proceed === false) {
          return {
            ok: false,
            error: "aborted: npm package integrity drift detected for @opik/opik-actagent@0.2.5",
          };
        }
        return createSuccessfulNpmUpdateResult();
      },
    );

    const config = createNpmInstallConfig({
      pluginId: "opik-actagent",
      spec: "@opik/opik-actagent@0.2.5",
      integrity: "sha512-old",
      installPath: "/tmp/opik-actagent",
    });
    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["opik-actagent"],
      logger: { warn },
    });

    expect(warn).toHaveBeenCalledWith(
      'Integrity drift for "opik-actagent" (@opik/opik-actagent@0.2.5): expected sha512-old, got sha512-new',
    );
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.outcomes).toEqual([
      {
        pluginId: "opik-actagent",
        status: "error",
        message:
          "Failed to update opik-actagent: aborted: npm package integrity drift detected for @opik/opik-actagent@0.2.5",
      },
    ]);
  });

  it.each([
    {
      name: "formats package-not-found updates with a stable message",
      installerResult: {
        ok: false,
        code: "npm_package_not_found",
        error: "Package not found on npm: @actagent/missing.",
      },
      config: createNpmInstallConfig({
        pluginId: "missing",
        spec: "@actagent/missing",
        installPath: "/tmp/missing",
      }),
      pluginId: "missing",
      expectedMessage: "Failed to check missing: npm package not found for @actagent/missing.",
    },
    {
      name: "falls back to raw installer error for unknown error codes",
      installerResult: {
        ok: false,
        code: "invalid_npm_spec",
        error: "unsupported npm spec: github:evil/evil",
      },
      config: createNpmInstallConfig({
        pluginId: "bad",
        spec: "github:evil/evil",
        installPath: "/tmp/bad",
      }),
      pluginId: "bad",
      expectedMessage: "Failed to check bad: unsupported npm spec: github:evil/evil",
    },
  ] as const)("$name", async ({ installerResult, config, pluginId, expectedMessage }) => {
    installPluginFromNpmSpecMock.mockResolvedValue(installerResult);

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: [pluginId],
      dryRun: true,
    });

    expect(result.outcomes).toEqual([
      {
        pluginId,
        status: "error",
        message: expectedMessage,
      },
    ]);
  });

  it.each([
    {
      name: "reuses a recorded npm dist-tag spec for id-based updates",
      installerResult: {
        ok: true,
        pluginId: "actagent-codex-app-server",
        targetDir: "/tmp/actagent-codex-app-server",
        version: "0.2.0-beta.4",
        extensions: ["index.ts"],
      },
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server@beta",
        resolvedName: "actagent-codex-app-server",
        resolvedSpec: "actagent-codex-app-server@0.2.0-beta.3",
      }),
      expectedSpec: "actagent-codex-app-server@beta",
      expectedVersion: "0.2.0-beta.4",
    },
    {
      name: "uses and persists an explicit npm spec override during updates",
      installerResult: {
        ok: true,
        pluginId: "actagent-codex-app-server",
        targetDir: "/tmp/actagent-codex-app-server",
        version: "0.2.0-beta.4",
        extensions: ["index.ts"],
        npmResolution: {
          name: "actagent-codex-app-server",
          version: "0.2.0-beta.4",
          resolvedSpec: "actagent-codex-app-server@0.2.0-beta.4",
        },
      },
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      specOverrides: {
        "actagent-codex-app-server": "actagent-codex-app-server@beta",
      },
      expectedSpec: "actagent-codex-app-server@beta",
      expectedRecordSpec: "actagent-codex-app-server@beta",
      expectedVersion: "0.2.0-beta.4",
      expectedResolvedSpec: "actagent-codex-app-server@0.2.0-beta.4",
    },
  ] as const)(
    "$name",
    async ({
      installerResult,
      config,
      specOverrides,
      expectedSpec,
      expectedRecordSpec,
      expectedVersion,
      expectedResolvedSpec,
    }) => {
      installPluginFromNpmSpecMock.mockResolvedValue(installerResult);

      const result = await updateNpmInstalledPlugins({
        config,
        pluginIds: ["actagent-codex-app-server"],
        ...(specOverrides ? { specOverrides } : {}),
      });

      expectNpmUpdateCall({
        spec: expectedSpec,
        expectedPluginId: "actagent-codex-app-server",
      });
      expectCodexAppServerInstallState({
        result,
        spec: expectedRecordSpec ?? expectedSpec,
        version: expectedVersion,
        ...(expectedResolvedSpec ? { resolvedSpec: expectedResolvedSpec } : {}),
      });
    },
  );

  it("preserves explicit official npm tag overrides during manual updates", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/acpx",
      version: "2026.5.2",
    });
    mockNpmViewMetadata({
      name: "@actagent/acpx",
      version: "2026.5.3-beta.1",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "acpx",
        targetDir: installPath,
        version: "2026.5.3-beta.1",
        npmResolution: {
          name: "@actagent/acpx",
          version: "2026.5.3-beta.1",
          resolvedSpec: "@actagent/acpx@2026.5.3-beta.1",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "acpx",
        spec: "@actagent/acpx",
        installPath,
        resolvedName: "@actagent/acpx",
        resolvedSpec: "@actagent/acpx@2026.5.2",
        resolvedVersion: "2026.5.2",
      }),
      pluginIds: ["acpx"],
      specOverrides: {
        acpx: "@actagent/acpx@beta",
      },
    });

    expectNpmUpdateCall({
      spec: "@actagent/acpx@beta",
      expectedPluginId: "acpx",
    });
    expectRecordFields(result.config.plugins?.installs?.acpx, {
      spec: "@actagent/acpx@beta",
      version: "2026.5.3-beta.1",
      resolvedSpec: "@actagent/acpx@2026.5.3-beta.1",
    });
  });

  it("tries npm beta for default npm specs on beta channel and preserves the default selector", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "actagent-codex-app-server",
        targetDir: "/tmp/actagent-codex-app-server",
        version: "0.2.0-beta.4",
        npmResolution: {
          name: "actagent-codex-app-server",
          version: "0.2.0-beta.4",
          resolvedSpec: "actagent-codex-app-server@0.2.0-beta.4",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
    });

    expectNpmUpdateCall({
      spec: "actagent-codex-app-server@beta",
      expectedPluginId: "actagent-codex-app-server",
    });
    expectCodexAppServerInstallState({
      result,
      spec: "actagent-codex-app-server",
      version: "0.2.0-beta.4",
      resolvedSpec: "actagent-codex-app-server@0.2.0-beta.4",
    });
  });

  it("falls back to the default npm spec when a beta tag is unavailable", async () => {
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error:
          "npm ERR! code ETARGET\nnpm ERR! No matching version found for actagent-codex-app-server@beta.",
      })
      .mockResolvedValueOnce(
        createSuccessfulNpmUpdateResult({
          pluginId: "actagent-codex-app-server",
          targetDir: "/tmp/actagent-codex-app-server",
          version: "0.2.6",
          npmResolution: {
            name: "actagent-codex-app-server",
            version: "0.2.6",
            resolvedSpec: "actagent-codex-app-server@0.2.6",
          },
        }),
      );

    const warnMessages: string[] = [];
    const result = await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
      logger: { warn: (msg) => warnMessages.push(msg) },
    });

    expect(npmInstallCall(0)?.spec).toBe("actagent-codex-app-server@beta");
    expect(npmInstallCall(1)?.spec).toBe("actagent-codex-app-server");
    expect(warnMessages).toEqual([
      'Plugin "actagent-codex-app-server" has no beta npm release for actagent-codex-app-server@beta; using actagent-codex-app-server instead. Core update can still complete.',
    ]);
    expectCodexAppServerInstallState({
      result,
      spec: "actagent-codex-app-server",
      version: "0.2.6",
      resolvedSpec: "actagent-codex-app-server@0.2.6",
    });
    expect(result.outcomes[0]?.message).toBe(
      "Updated actagent-codex-app-server: unknown -> 0.2.6. (warning: beta channel fallback used actagent-codex-app-server because actagent-codex-app-server@beta could not be used).",
    );
    expect(result.outcomes[0]?.channelFallback).toEqual({
      requestedSpec: "actagent-codex-app-server@beta",
      usedSpec: "actagent-codex-app-server",
      requestedLabel: "@beta",
      usedLabel: "@latest",
      reason: "unavailable",
      message:
        "plugin channel fallback: actagent-codex-app-server used @latest because @beta was unavailable",
    });
  });

  it("reports npm beta fallback as tentative during dry-run checks", async () => {
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error:
          "npm ERR! code ETARGET\nnpm ERR! No matching version found for actagent-codex-app-server@beta.",
      })
      .mockResolvedValueOnce(
        createSuccessfulNpmUpdateResult({
          pluginId: "actagent-codex-app-server",
          targetDir: "/tmp/actagent-codex-app-server",
          version: "0.2.6",
          npmResolution: {
            name: "actagent-codex-app-server",
            version: "0.2.6",
            resolvedSpec: "actagent-codex-app-server@0.2.6",
          },
        }),
      );

    const result = await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
      dryRun: true,
    });

    expect(result.outcomes[0]?.message).toBe(
      "Would update actagent-codex-app-server: unknown -> 0.2.6. (warning: beta channel fallback would use actagent-codex-app-server because actagent-codex-app-server@beta could not be used).",
    );
    expect(result.outcomes[0]?.channelFallback?.message).toBe(
      "plugin channel fallback: actagent-codex-app-server would use @latest because @beta was unavailable",
    );
  });

  it("falls back to the default npm spec when the beta package exists but is invalid", async () => {
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error: "Installed plugin package uses a TypeScript entry without compiled runtime output.",
      })
      .mockResolvedValueOnce(
        createSuccessfulNpmUpdateResult({
          pluginId: "actagent-codex-app-server",
          targetDir: "/tmp/actagent-codex-app-server",
          version: "0.2.6",
          npmResolution: {
            name: "actagent-codex-app-server",
            version: "0.2.6",
            resolvedSpec: "actagent-codex-app-server@0.2.6",
          },
        }),
      );

    const warnMessages: string[] = [];
    const result = await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
      logger: { warn: (msg) => warnMessages.push(msg) },
    });

    expect(npmInstallCall(0)?.spec).toBe("actagent-codex-app-server@beta");
    expect(npmInstallCall(1)?.spec).toBe("actagent-codex-app-server");
    expect(warnMessages).toEqual([
      'Plugin "actagent-codex-app-server" failed beta npm update for actagent-codex-app-server@beta; using actagent-codex-app-server instead. Core update can still complete.',
    ]);
    expectCodexAppServerInstallState({
      result,
      spec: "actagent-codex-app-server",
      version: "0.2.6",
      resolvedSpec: "actagent-codex-app-server@0.2.6",
    });
    expect(result.outcomes[0]?.message).toBe(
      "Updated actagent-codex-app-server: unknown -> 0.2.6. (warning: beta channel fallback used actagent-codex-app-server because actagent-codex-app-server@beta could not be used).",
    );
    expect(result.outcomes[0]?.channelFallback).toMatchObject({
      requestedLabel: "@beta",
      usedLabel: "@latest",
      reason: "failed",
      message: "plugin channel fallback: actagent-codex-app-server used @latest after @beta failed",
    });
  });

  it("reports the fallback npm spec when beta fallback also fails", async () => {
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error: "Installed plugin package uses a TypeScript entry without compiled runtime output.",
      })
      .mockResolvedValueOnce({
        ok: false,
        code: "npm_package_not_found",
        error: "npm package not found",
      });

    const result = await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledTimes(2);
    expect(result.outcomes).toEqual([
      {
        pluginId: "actagent-codex-app-server",
        status: "error",
        message:
          "Failed to update actagent-codex-app-server: npm package not found for actagent-codex-app-server.",
        channelFallback: {
          requestedSpec: "actagent-codex-app-server@beta",
          usedSpec: "actagent-codex-app-server",
          requestedLabel: "@beta",
          usedLabel: "@latest",
          reason: "failed",
          message:
            "plugin channel fallback: actagent-codex-app-server used @latest after @beta failed",
        },
      },
    ]);
  });

  it("keeps fallback metadata when a dry-run beta fallback also fails", async () => {
    installPluginFromNpmSpecMock
      .mockResolvedValueOnce({
        ok: false,
        error: "Installed plugin package uses a TypeScript entry without compiled runtime output.",
      })
      .mockResolvedValueOnce({
        ok: false,
        code: "npm_package_not_found",
        error: "npm package not found",
      });

    const result = await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
      dryRun: true,
    });

    expect(result.outcomes).toEqual([
      {
        pluginId: "actagent-codex-app-server",
        status: "error",
        message:
          "Failed to check actagent-codex-app-server: npm package not found for actagent-codex-app-server.",
        channelFallback: {
          requestedSpec: "actagent-codex-app-server@beta",
          usedSpec: "actagent-codex-app-server",
          requestedLabel: "@beta",
          usedLabel: "@latest",
          reason: "failed",
          message:
            "plugin channel fallback: actagent-codex-app-server would use @latest after @beta failed",
        },
      },
    ]);
  });

  it("preserves explicit npm tags when updating on the beta channel", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "actagent-codex-app-server",
        targetDir: "/tmp/actagent-codex-app-server",
        version: "0.2.0-rc.1",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server@rc",
      }),
      pluginIds: ["actagent-codex-app-server"],
      updateChannel: "beta",
      dryRun: true,
    });

    expectNpmUpdateCall({
      spec: "actagent-codex-app-server@rc",
      expectedPluginId: "actagent-codex-app-server",
    });
  });

  it("updates ACTAgentHub-installed plugins via recorded package metadata", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/demo",
      version: "1.2.4",
      actagenthub: {
        source: "actagenthub",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        artifactKind: "npm-pack",
        artifactFormat: "tgz",
        npmIntegrity: "sha512-next",
        npmShasum: "1".repeat(40),
        npmTarballName: "demo-1.2.4.tgz",
        integrity: "sha256-next",
        resolvedAt: "2026-03-22T00:00:00.000Z",
        actagentpackSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        actagentpackSpecVersion: 1,
        actagentpackManifestSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        actagentpackSize: 4096,
      },
    });

    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
      }),
      pluginIds: ["demo"],
      timeoutMs: 1_800_000,
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:demo");
    expect(actAgentHubInstallCall()?.baseUrl).toBe("https://actagenthub.ai");
    expect(actAgentHubInstallCall()?.expectedPluginId).toBe("demo");
    expect(actAgentHubInstallCall()?.mode).toBe("update");
    expect(actAgentHubInstallCall()?.timeoutMs).toBe(1_800_000);
    expectRecordFields(result.config.plugins?.installs?.demo, {
      source: "actagenthub",
      spec: "actagenthub:demo",
      installPath: "/tmp/demo",
      version: "1.2.4",
      actagenthubPackage: "demo",
      actagenthubFamily: "code-plugin",
      actagenthubChannel: "official",
      artifactKind: "npm-pack",
      artifactFormat: "tgz",
      npmIntegrity: "sha512-next",
      npmShasum: "1".repeat(40),
      npmTarballName: "demo-1.2.4.tgz",
      integrity: "sha256-next",
      actagentpackSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      actagentpackSpecVersion: 1,
      actagentpackManifestSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      actagentpackSize: 4096,
    });
  });

  it("tries ACTAgentHub beta for default ACTAgentHub specs on beta channel without persisting the beta tag", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "demo",
        targetDir: "/tmp/demo",
        version: "1.3.0-beta.1",
        actagenthubPackage: "demo",
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
      }),
      pluginIds: ["demo"],
      updateChannel: "beta",
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:demo@beta");
    expect(actAgentHubInstallCall()?.baseUrl).toBe("https://actagenthub.ai");
    expect(actAgentHubInstallCall()?.expectedPluginId).toBe("demo");
    expectRecordFields(result.config.plugins?.installs?.demo, {
      source: "actagenthub",
      spec: "actagenthub:demo",
      installPath: "/tmp/demo",
      version: "1.3.0-beta.1",
      actagenthubPackage: "demo",
    });
  });

  it("falls back to the default ACTAgentHub spec when a beta release is unavailable", async () => {
    installPluginFromACTAgentHubMock
      .mockResolvedValueOnce({
        ok: false,
        code: "version_not_found",
        error: "version not found: beta",
      })
      .mockResolvedValueOnce(
        createSuccessfulACTAgentHubUpdateResult({
          pluginId: "demo",
          targetDir: "/tmp/demo",
          version: "1.2.4",
          actagenthubPackage: "demo",
        }),
      );

    const warnMessages: string[] = [];
    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
      }),
      pluginIds: ["demo"],
      updateChannel: "beta",
      logger: { warn: (msg) => warnMessages.push(msg) },
    });

    expect(actAgentHubInstallCall(0)?.spec).toBe("actagenthub:demo@beta");
    expect(actAgentHubInstallCall(1)?.spec).toBe("actagenthub:demo");
    expect(warnMessages).toEqual([
      'Plugin "demo" has no beta ACTAgentHub release for actagenthub:demo@beta; using actagenthub:demo instead. Core update can still complete.',
    ]);
    expectRecordFields(result.config.plugins?.installs?.demo, {
      source: "actagenthub",
      spec: "actagenthub:demo",
      installPath: "/tmp/demo",
      version: "1.2.4",
      actagenthubPackage: "demo",
    });
    expect(result.outcomes[0]?.message).toBe(
      "Updated demo: unknown -> 1.2.4. (warning: beta channel fallback used actagenthub:demo because actagenthub:demo@beta could not be used).",
    );
  });

  it("falls back to npm for trusted official ACTAgentHub artifact blocks", async () => {
    const warnMessages: string[] = [];
    const installPath = createInstalledPackageDir({
      name: "@actagent/discord",
      version: "2026.5.12",
    });
    installPluginFromACTAgentHubMock.mockResolvedValueOnce({
      ok: false,
      code: "artifact_unavailable",
      error:
        'ACTAgentHub artifact download for "@actagent/discord@2026.5.16-beta.5" is not available yet (ACTAgentHub /api/v1/packages/%40actagent%2Fdiscord/versions/2026.5.16-beta.5/artifact/download failed (403): Blocked: this package release has been flagged as malicious and cannot be downloaded.). Use "npm:@actagent/discord@2026.5.16-beta.5" for launch installs while ACTAgentHub artifact routing is being rolled out.',
    });
    installPluginFromNpmSpecMock.mockResolvedValueOnce(
      createSuccessfulNpmUpdateResult({
        pluginId: "discord",
        targetDir: "/tmp/actagent-plugins/discord",
        version: "2026.5.16-beta.5",
        npmResolution: {
          name: "@actagent/discord",
          version: "2026.5.16-beta.5",
          resolvedSpec: "@actagent/discord@2026.5.16-beta.5",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "discord",
        installPath,
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "@actagent/discord",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        spec: "actagenthub:@actagent/discord",
      }),
      pluginIds: ["discord"],
      updateChannel: "beta",
      disableOnFailure: true,
      logger: { warn: (msg) => warnMessages.push(msg) },
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:@actagent/discord@beta");
    expect(npmInstallCall()?.spec).toBe("@actagent/discord@beta");
    expect(npmInstallCall()?.expectedPluginId).toBe("discord");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(result.config.plugins?.entries?.discord?.enabled).toBeUndefined();
    expectRecordFields(result.config.plugins?.installs?.discord, {
      source: "npm",
      spec: "@actagent/discord@2026.5.16-beta.5",
      installPath: "/tmp/actagent-plugins/discord",
      version: "2026.5.16-beta.5",
    });
    expect(result.config.plugins?.installs?.discord?.actagenthubPackage).toBeUndefined();
    expect(result.config.plugins?.installs?.discord?.actagenthubUrl).toBeUndefined();
    expect(result.config.plugins?.installs?.discord?.artifactKind).toBeUndefined();
    expect(result.outcomes).toEqual([
      {
        pluginId: "discord",
        status: "updated",
        currentVersion: "2026.5.12",
        nextVersion: "2026.5.16-beta.5",
        message:
          "Updated discord: 2026.5.12 -> 2026.5.16-beta.5. (warning: official ACTAgentHub artifact fallback used @actagent/discord@beta).",
      },
    ]);
    expect(warnMessages).toEqual([
      'Plugin "discord" could not download official ACTAgentHub artifact for actagenthub:@actagent/discord@beta; using npm @actagent/discord@beta instead. Core update can still complete.',
    ]);
  });

  it("uses the default npm spec when beta ACTAgentHub falls back before an artifact block", async () => {
    const warnMessages: string[] = [];
    const installPath = createInstalledPackageDir({
      name: "@actagent/discord",
      version: "2026.5.12",
    });
    installPluginFromACTAgentHubMock
      .mockResolvedValueOnce({
        ok: false,
        code: "version_not_found",
        error: "version not found: beta",
      })
      .mockResolvedValueOnce({
        ok: false,
        code: "artifact_unavailable",
        error: "artifact unavailable",
      });
    installPluginFromNpmSpecMock.mockResolvedValueOnce(
      createSuccessfulNpmUpdateResult({
        pluginId: "discord",
        targetDir: "/tmp/actagent-plugins/discord",
        version: "2026.5.16",
        npmResolution: {
          name: "@actagent/discord",
          version: "2026.5.16",
          resolvedSpec: "@actagent/discord@2026.5.16",
        },
      }),
    );

    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "discord",
        installPath,
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "@actagent/discord",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        spec: "actagenthub:@actagent/discord",
      }),
      pluginIds: ["discord"],
      updateChannel: "beta",
      logger: { warn: (msg) => warnMessages.push(msg) },
    });

    expect(actAgentHubInstallCall(0)?.spec).toBe("actagenthub:@actagent/discord@beta");
    expect(actAgentHubInstallCall(1)?.spec).toBe("actagenthub:@actagent/discord");
    expect(npmInstallCall()?.spec).toBe("@actagent/discord");
    expectRecordFields(result.config.plugins?.installs?.discord, {
      source: "npm",
      spec: "@actagent/discord@2026.5.16",
      installPath: "/tmp/actagent-plugins/discord",
      version: "2026.5.16",
    });
    expect(result.outcomes[0]?.message).toBe(
      "Updated discord: 2026.5.12 -> 2026.5.16. (warning: official ACTAgentHub artifact fallback used @actagent/discord).",
    );
    expect(warnMessages).toEqual([
      'Plugin "discord" has no beta ACTAgentHub release for actagenthub:@actagent/discord@beta; using actagenthub:@actagent/discord instead. Core update can still complete.',
      'Plugin "discord" could not download official ACTAgentHub artifact for actagenthub:@actagent/discord; using npm @actagent/discord instead. Core update can still complete.',
    ]);
  });

  it("reports npm dry-run versions for trusted official ACTAgentHub artifact fallback", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/discord",
      version: "2026.5.16-beta.5",
    });
    installPluginFromACTAgentHubMock.mockResolvedValueOnce({
      ok: false,
      code: "artifact_unavailable",
      error: "artifact unavailable",
    });
    installPluginFromNpmSpecMock.mockResolvedValueOnce({
      ok: true,
      pluginId: "discord",
      targetDir: "/tmp/actagent-plugins/discord",
      extensions: [],
      npmResolution: {
        name: "@actagent/discord",
        version: "2026.5.16-beta.5",
        resolvedSpec: "@actagent/discord@2026.5.16-beta.5",
      },
    });

    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "discord",
        installPath,
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "@actagent/discord",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        spec: "actagenthub:@actagent/discord",
      }),
      pluginIds: ["discord"],
      updateChannel: "beta",
      dryRun: true,
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/discord@beta");
    expect(npmInstallCall()?.dryRun).toBe(true);
    expect(result.outcomes).toEqual([
      {
        pluginId: "discord",
        status: "unchanged",
        currentVersion: "2026.5.16-beta.5",
        nextVersion: "2026.5.16-beta.5",
        message:
          "discord is up to date (2026.5.16-beta.5). (warning: official ACTAgentHub artifact fallback would use @actagent/discord@beta).",
      },
    ]);
  });

  it("does not fall back to trusted npm from custom ACTAgentHub provenance", async () => {
    const installPath = createInstalledPackageDir({
      name: "@actagent/discord",
      version: "2026.5.12",
    });
    installPluginFromACTAgentHubMock.mockResolvedValueOnce({
      ok: false,
      code: "artifact_unavailable",
      error: "artifact unavailable",
    });

    const result = await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "discord",
        installPath,
        actagenthubUrl: "https://custom-actagenthub.example",
        actagenthubPackage: "@actagent/discord",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        spec: "actagenthub:@actagent/discord",
      }),
      pluginIds: ["discord"],
      updateChannel: "beta",
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.outcomes).toEqual([
      {
        pluginId: "discord",
        status: "error",
        message:
          "Failed to update discord: artifact unavailable (ACTAgentHub actagenthub:@actagent/discord@beta).",
      },
    ]);
  });

  it("preserves explicit ACTAgentHub tags when updating on the beta channel", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "demo",
        targetDir: "/tmp/demo",
        version: "1.3.0-rc.1",
        actagenthubPackage: "demo",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        spec: "actagenthub:demo@rc",
      }),
      pluginIds: ["demo"],
      updateChannel: "beta",
      dryRun: true,
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:demo@rc");
  });

  it("skips ACTAgentHub plugin update when bundled version is newer", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(
      new Map([
        [
          "whatsapp",
          {
            pluginId: "whatsapp",
            localPath: appBundledPluginRoot("whatsapp"),
            version: "2026.4.20",
          },
        ],
      ]),
    );

    const config = createACTAgentHubInstallConfig({
      pluginId: "whatsapp",
      installPath: "/tmp/whatsapp",
      actagenthubUrl: "https://actagenthub.ai",
      actagenthubPackage: "whatsapp",
      actagenthubFamily: "bundle-plugin",
      actagenthubChannel: "community",
    });
    (config.plugins!.installs!.whatsapp as Record<string, unknown>).version = "2026.2.9";

    const warnMessages: string[] = [];
    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["whatsapp"],
      logger: { warn: (msg) => warnMessages.push(msg) },
    });

    expect(installPluginFromACTAgentHubMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.pluginId).toBe("whatsapp");
    expect(result.outcomes[0]?.status).toBe("skipped");
    expect(result.outcomes[0]?.message).toContain("bundled version 2026.4.20 is newer");
    expect(warnMessages).toHaveLength(1);
    expect(warnMessages[0]).toContain("bundled version 2026.4.20 is newer");
  });

  it("proceeds with ACTAgentHub plugin update when bundled version is older", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(
      new Map([
        [
          "demo",
          {
            pluginId: "demo",
            localPath: appBundledPluginRoot("demo"),
            version: "1.0.0",
          },
        ],
      ]),
    );
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/demo",
      version: "2.0.0",
      actagenthub: {
        source: "actagenthub",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        integrity: "sha256-new",
        resolvedAt: "2026-04-30T00:00:00.000Z",
      },
    });

    const config = createACTAgentHubInstallConfig({
      pluginId: "demo",
      installPath: "/tmp/demo",
      actagenthubUrl: "https://actagenthub.ai",
      actagenthubPackage: "demo",
      actagenthubFamily: "code-plugin",
      actagenthubChannel: "official",
    });
    (config.plugins!.installs!.demo as Record<string, unknown>).version = "1.5.0";

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["demo"],
    });

    expect(installPluginFromACTAgentHubMock).toHaveBeenCalled();
    expect(result.changed).toBe(true);
  });

  it("does not treat an older bundled stable release as newer than an installed correction release", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(
      new Map([
        [
          "demo",
          {
            pluginId: "demo",
            localPath: appBundledPluginRoot("demo"),
            version: "2026.5.3",
          },
        ],
      ]),
    );
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "demo",
        targetDir: "/tmp/demo",
        version: "2026.5.3-2",
        actagenthubPackage: "demo",
      }),
    );

    const config = createACTAgentHubInstallConfig({
      pluginId: "demo",
      installPath: "/tmp/demo",
      actagenthubUrl: "https://actagenthub.ai",
      actagenthubPackage: "demo",
      actagenthubFamily: "code-plugin",
      actagenthubChannel: "official",
    });
    (config.plugins!.installs!.demo as Record<string, unknown>).version = "2026.5.3-1";

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["demo"],
    });

    expect(installPluginFromACTAgentHubMock).toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expectRecordFields(result.outcomes[0], {
      pluginId: "demo",
      status: "updated",
      currentVersion: undefined,
      nextVersion: "2026.5.3-2",
    });
  });

  it("migrates legacy unscoped install keys when a scoped npm package updates", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "@actagent/voice-call",
      targetDir: "/tmp/actagent-voice-call",
      version: "0.0.2",
      extensions: ["index.ts"],
    });

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          allow: ["voice-call"],
          deny: ["voice-call"],
          slots: { memory: "voice-call" },
          entries: {
            "voice-call": {
              enabled: false,
              hooks: { allowPromptInjection: false },
            },
          },
          installs: {
            "voice-call": {
              source: "npm",
              spec: "@actagent/voice-call",
              installPath: "/tmp/voice-call",
            },
          },
        },
      },
      pluginIds: ["voice-call"],
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/voice-call");
    expect(npmInstallCall()?.expectedPluginId).toBe("voice-call");
    expect(result.config.plugins?.allow).toEqual(["@actagent/voice-call"]);
    expect(result.config.plugins?.deny).toEqual(["@actagent/voice-call"]);
    expect(result.config.plugins?.slots?.memory).toBe("@actagent/voice-call");
    expect(result.config.plugins?.entries?.["@actagent/voice-call"]).toEqual({
      enabled: false,
      hooks: { allowPromptInjection: false },
    });
    expect(result.config.plugins?.entries?.["voice-call"]).toBeUndefined();
    expectRecordFields(result.config.plugins?.installs?.["@actagent/voice-call"], {
      source: "npm",
      spec: "@actagent/voice-call",
      installPath: "/tmp/actagent-voice-call",
      version: "0.0.2",
    });
    expect(result.config.plugins?.installs?.["voice-call"]).toBeUndefined();
  });

  it("migrates context engine slot when a plugin id changes during update", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "@actagent/context-engine",
      targetDir: "/tmp/actagent-context-engine",
      version: "0.0.2",
      extensions: ["index.ts"],
    });

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          slots: { contextEngine: "context-engine" },
          installs: {
            "context-engine": {
              source: "npm",
              spec: "@actagent/context-engine",
              installPath: "/tmp/context-engine",
            },
          },
        },
      } as ACTAgentConfig,
      pluginIds: ["context-engine"],
    });

    expect(result.config.plugins?.slots?.contextEngine).toBe("@actagent/context-engine");
    expectRecordFields(result.config.plugins?.installs?.["@actagent/context-engine"], {
      source: "npm",
      spec: "@actagent/context-engine",
      installPath: "/tmp/actagent-context-engine",
      version: "0.0.2",
    });
    expect(result.config.plugins?.installs?.["context-engine"]).toBeUndefined();
  });

  it("checks marketplace installs during dry-run updates", async () => {
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "claude-bundle",
      targetDir: "/tmp/claude-bundle",
      version: "1.2.0",
      extensions: ["index.ts"],
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });

    const result = await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "claude-bundle",
        installPath: "/tmp/claude-bundle",
        marketplaceSource: "vincentkoc/claude-marketplace",
        marketplacePlugin: "claude-bundle",
      }),
      pluginIds: ["claude-bundle"],
      timeoutMs: 1_800_000,
      dryRun: true,
    });

    expect(marketplaceInstallCall()?.marketplace).toBe("vincentkoc/claude-marketplace");
    expect(marketplaceInstallCall()?.plugin).toBe("claude-bundle");
    expect(marketplaceInstallCall()?.expectedPluginId).toBe("claude-bundle");
    expect(marketplaceInstallCall()?.dryRun).toBe(true);
    expect(marketplaceInstallCall()?.timeoutMs).toBe(1_800_000);
    expect(result.outcomes).toEqual([
      {
        pluginId: "claude-bundle",
        status: "updated",
        currentVersion: undefined,
        nextVersion: "1.2.0",
        message: "Would update claude-bundle: unknown -> 1.2.0.",
      },
    ]);
  });

  it("updates marketplace installs and preserves source metadata", async () => {
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "claude-bundle",
      targetDir: "/tmp/claude-bundle",
      version: "1.3.0",
      extensions: ["index.ts"],
      marketplaceName: "Vincent's Claude Plugins",
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });

    const result = await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "claude-bundle",
        installPath: "/tmp/claude-bundle",
        marketplaceName: "Vincent's Claude Plugins",
        marketplaceSource: "vincentkoc/claude-marketplace",
        marketplacePlugin: "claude-bundle",
      }),
      pluginIds: ["claude-bundle"],
    });

    expect(result.changed).toBe(true);
    expectRecordFields(result.config.plugins?.installs?.["claude-bundle"], {
      source: "marketplace",
      installPath: "/tmp/claude-bundle",
      version: "1.3.0",
      marketplaceName: "Vincent's Claude Plugins",
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });
  });

  it("updates git installs and records resolved commit metadata", async () => {
    installPluginFromGitSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/demo",
      version: "1.3.0",
      extensions: ["index.ts"],
      git: {
        url: "https://github.com/acme/demo.git",
        ref: "main",
        commit: "def456",
        resolvedAt: "2026-04-30T00:00:00.000Z",
      },
    });

    const result = await updateNpmInstalledPlugins({
      config: createGitInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        spec: "git:github.com/acme/demo@main",
        commit: "abc123",
      }),
      pluginIds: ["demo"],
    });

    expect(gitInstallCall()?.spec).toBe("git:github.com/acme/demo@main");
    expect(gitInstallCall()?.expectedPluginId).toBe("demo");
    expect(gitInstallCall()?.mode).toBe("update");
    expect(result.changed).toBe(true);
    expectRecordFields(result.config.plugins?.installs?.demo, {
      source: "git",
      spec: "git:github.com/acme/demo@main",
      installPath: "/tmp/demo",
      version: "1.3.0",
      gitUrl: "https://github.com/acme/demo.git",
      gitRef: "main",
      gitCommit: "def456",
    });
  });

  it("forwards dangerous force unsafe install to plugin update installers", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "actagent-codex-app-server",
        targetDir: "/tmp/actagent-codex-app-server",
        version: "0.2.0-beta.4",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "actagent-codex-app-server@beta",
      }),
      pluginIds: ["actagent-codex-app-server"],
      dangerouslyForceUnsafeInstall: true,
    });

    expect(npmInstallCall()?.spec).toBe("actagent-codex-app-server@beta");
    expect(npmInstallCall()?.dangerouslyForceUnsafeInstall).toBe(true);
    expect(npmInstallCall()?.expectedPluginId).toBe("actagent-codex-app-server");
  });

  it("reuses the recorded managed extensions root when updating external plugins", async () => {
    const installPath = "/var/actagent/extensions/demo";
    const extensionsDir = "/var/actagent/extensions";
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "demo",
        targetDir: installPath,
        version: "1.2.0",
      }),
    );
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: installPath,
      version: "1.2.0",
      extensions: ["index.ts"],
      actagenthub: {
        source: "actagenthub",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        integrity: "sha256-next",
        resolvedAt: "2026-03-22T00:00:00.000Z",
      },
    });
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: installPath,
      version: "1.2.0",
      extensions: ["index.ts"],
      marketplaceSource: "acme/plugins",
      marketplacePlugin: "demo",
    });
    installPluginFromGitSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: installPath,
      version: "1.2.0",
      extensions: ["index.ts"],
      git: {
        url: "https://github.com/acme/demo.git",
        ref: "main",
        commit: "abc123",
        resolvedAt: "2026-04-30T00:00:00.000Z",
      },
    });

    await updateNpmInstalledPlugins({
      config: createNpmInstallConfig({
        pluginId: "demo",
        spec: "@acme/demo",
        installPath,
      }),
      pluginIds: ["demo"],
    });
    await updateNpmInstalledPlugins({
      config: createACTAgentHubInstallConfig({
        pluginId: "demo",
        installPath,
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
      }),
      pluginIds: ["demo"],
    });
    await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "demo",
        installPath,
        marketplaceSource: "acme/plugins",
        marketplacePlugin: "demo",
      }),
      pluginIds: ["demo"],
    });
    await updateNpmInstalledPlugins({
      config: createGitInstallConfig({
        pluginId: "demo",
        installPath,
        spec: "git:github.com/acme/demo@main",
      }),
      pluginIds: ["demo"],
    });

    expect(npmInstallCall()?.extensionsDir).toBe(extensionsDir);
    expect(actAgentHubInstallCall()?.extensionsDir).toBe(extensionsDir);
    expect(marketplaceInstallCall()?.extensionsDir).toBe(extensionsDir);
    expect(gitInstallCall()?.extensionsDir).toBe(extensionsDir);
  });
});

describe("syncPluginsForUpdateChannel", () => {
  beforeEach(() => {
    installPluginFromNpmSpecMock.mockReset();
    installPluginFromACTAgentHubMock.mockReset();
    installPluginFromGitSpecMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
  });

  it.each([
    {
      name: "keeps bundled path installs on beta without reinstalling from npm",
      config: createBundledPathInstallConfig({
        loadPaths: [appBundledPluginRoot("feishu")],
        installPath: appBundledPluginRoot("feishu"),
        spec: "@actagent/feishu",
      }),
      expectedChanged: false,
      expectedLoadPaths: [appBundledPluginRoot("feishu")],
      expectedInstallPath: appBundledPluginRoot("feishu"),
    },
    {
      name: "repairs bundled install metadata when the load path is re-added",
      config: createBundledPathInstallConfig({
        loadPaths: [],
        installPath: "/tmp/old-feishu",
        spec: "@actagent/feishu",
      }),
      expectedChanged: true,
      expectedLoadPaths: [appBundledPluginRoot("feishu")],
      expectedInstallPath: appBundledPluginRoot("feishu"),
    },
  ] as const)(
    "$name",
    async ({ config, expectedChanged, expectedLoadPaths, expectedInstallPath }) => {
      mockBundledSources(createBundledSource());

      const result = await syncPluginsForUpdateChannel({
        channel: "beta",
        config,
      });

      expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
      expect(result.changed).toBe(expectedChanged);
      expect(result.summary.switchedToNpm).toStrictEqual([]);
      expect(result.config.plugins?.load?.paths).toEqual(expectedLoadPaths);
      expectBundledPathInstall({
        install: result.config.plugins?.installs?.feishu,
        sourcePath: appBundledPluginRoot("feishu"),
        installPath: expectedInstallPath,
        spec: "@actagent/feishu",
      });
    },
  );

  it("forwards an explicit env to bundled plugin source resolution", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    const env = { ACTAGENT_HOME: "/srv/actagent-home" } as NodeJS.ProcessEnv;

    await syncPluginsForUpdateChannel({
      channel: "beta",
      config: {},
      workspaceDir: "/workspace",
      env,
    });

    expect(resolveBundledPluginSourcesMock).toHaveBeenCalledWith({
      workspaceDir: "/workspace",
      env,
    });
  });

  it("uses the provided env when matching bundled load and install paths", async () => {
    const bundledHome = "/tmp/actagent-home";
    mockBundledSources(
      createBundledSource({
        localPath: `${bundledHome}/plugins/feishu`,
      }),
    );

    const previousHome = process.env.HOME;
    process.env.HOME = "/tmp/process-home";
    try {
      const result = await syncPluginsForUpdateChannel({
        channel: "beta",
        env: {
          ...process.env,
          ACTAGENT_HOME: bundledHome,
          HOME: "/tmp/ignored-home",
        },
        config: {
          plugins: {
            load: { paths: ["~/plugins/feishu"] },
            installs: {
              feishu: {
                source: "path",
                sourcePath: "~/plugins/feishu",
                installPath: "~/plugins/feishu",
                spec: "@actagent/feishu",
              },
            },
          },
        },
      });

      expect(result.changed).toBe(false);
      expect(result.config.plugins?.load?.paths).toEqual(["~/plugins/feishu"]);
      expectBundledPathInstall({
        install: result.config.plugins?.installs?.feishu,
        sourcePath: "~/plugins/feishu",
        installPath: "~/plugins/feishu",
      });
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });

  it("installs an externalized bundled plugin and rewrites its old bundled path plugin index", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "legacy-chat",
        targetDir: "/tmp/actagent-plugins/legacy-chat",
        version: "2.0.0",
        npmResolution: {
          name: "@actagent/legacy-chat",
          version: "2.0.0",
          resolvedSpec: "@actagent/legacy-chat@2.0.0",
        },
      }),
    );

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: [appBundledPluginRoot("legacy-chat")] },
          installs: {
            "legacy-chat": {
              source: "path",
              sourcePath: appBundledPluginRoot("legacy-chat"),
              installPath: appBundledPluginRoot("legacy-chat"),
            },
          },
        },
      },
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/legacy-chat");
    expect(npmInstallCall()?.mode).toBe("update");
    expect(npmInstallCall()?.expectedPluginId).toBe("legacy-chat");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).not.toBe(true);
    expect(result.changed).toBe(true);
    expect(result.summary.switchedToNpm).toEqual(["legacy-chat"]);
    expect(result.summary.errors).toStrictEqual([]);
    expect(result.config.plugins?.load?.paths).toStrictEqual([]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "npm",
      spec: "@actagent/legacy-chat",
      installPath: "/tmp/actagent-plugins/legacy-chat",
      version: "2.0.0",
      resolvedName: "@actagent/legacy-chat",
      resolvedVersion: "2.0.0",
      resolvedSpec: "@actagent/legacy-chat@2.0.0",
    });
  });

  it("marks official externalized bundled npm installs as trusted", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "voice-call",
        targetDir: "/tmp/actagent-plugins/voice-call",
        version: "0.0.2-beta.1",
      }),
    );

    await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "voice-call",
          npmSpec: "@actagent/voice-call",
          channelIds: ["voice-call"],
        },
      ],
      config: {
        channels: {
          "voice-call": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: [appBundledPluginRoot("voice-call")] },
          installs: {
            "voice-call": {
              source: "path",
              sourcePath: appBundledPluginRoot("voice-call"),
              installPath: appBundledPluginRoot("voice-call"),
            },
          },
        },
      },
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/voice-call");
    expect(npmInstallCall()?.expectedPluginId).toBe("voice-call");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
  });

  it("installs a ACTAgentHub-preferred externalized bundled plugin", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "legacy-chat",
        targetDir: "/tmp/actagent-plugins/legacy-chat",
        version: "2026.5.1-beta.2",
        actagenthubPackage: "legacy-chat",
      }),
    );

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:legacy-chat@2026.5.1-beta.2",
          actagenthubUrl: "https://actagenthub.ai",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: [appBundledPluginRoot("legacy-chat")] },
          installs: {
            "legacy-chat": {
              source: "path",
              sourcePath: appBundledPluginRoot("legacy-chat"),
              installPath: appBundledPluginRoot("legacy-chat"),
            },
          },
        },
      },
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:legacy-chat@2026.5.1-beta.2");
    expect(actAgentHubInstallCall()?.baseUrl).toBe("https://actagenthub.ai");
    expect(actAgentHubInstallCall()?.mode).toBe("update");
    expect(actAgentHubInstallCall()?.expectedPluginId).toBe("legacy-chat");
    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expect(result.summary.switchedToACTAgentHub).toEqual(["legacy-chat"]);
    expect(result.summary.switchedToNpm).toStrictEqual([]);
    expect(result.summary.errors).toStrictEqual([]);
    expect(result.config.plugins?.load?.paths).toStrictEqual([]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "actagenthub",
      spec: "actagenthub:legacy-chat@2026.5.1-beta.2",
      installPath: "/tmp/actagent-plugins/legacy-chat",
      version: "2026.5.1-beta.2",
      integrity: "sha256-actagentpack",
      actagenthubUrl: "https://actagenthub.ai",
      actagenthubPackage: "legacy-chat",
      actagenthubFamily: "code-plugin",
      actagenthubChannel: "official",
      artifactKind: "npm-pack",
      artifactFormat: "tgz",
      npmIntegrity: "sha512-actagentpack",
      npmShasum: "2".repeat(40),
      npmTarballName: "legacy-chat-2026.5.1-beta.2.tgz",
      actagentpackSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      actagentpackSpecVersion: 1,
      actagentpackManifestSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      actagentpackSize: 4096,
    });
  });

  it("falls back from ACTAgentHub to npm only when the ACTAgentHub package is absent", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: false,
      code: "package_not_found",
      error: "Package not found on ACTAgentHub.",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "legacy-chat",
        targetDir: "/tmp/actagent-plugins/legacy-chat",
        version: "2.0.0",
      }),
    );

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:legacy-chat@2026.5.1-beta.2",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: [appBundledPluginRoot("legacy-chat")] },
          installs: {
            "legacy-chat": {
              source: "path",
              sourcePath: appBundledPluginRoot("legacy-chat"),
              installPath: appBundledPluginRoot("legacy-chat"),
            },
          },
        },
      },
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/legacy-chat");
    expect(npmInstallCall()?.mode).toBe("update");
    expect(npmInstallCall()?.expectedPluginId).toBe("legacy-chat");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).not.toBe(true);
    expect(result.changed).toBe(true);
    expect(result.summary.switchedToACTAgentHub).toStrictEqual([]);
    expect(result.summary.switchedToNpm).toEqual(["legacy-chat"]);
    expect(result.summary.warnings).toEqual([
      "ACTAgentHub actagenthub:legacy-chat@2026.5.1-beta.2 unavailable for legacy-chat; falling back to npm @actagent/legacy-chat.",
    ]);
    expect(result.summary.errors).toStrictEqual([]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "npm",
      spec: "@actagent/legacy-chat",
      installPath: "/tmp/actagent-plugins/legacy-chat",
      version: "2.0.0",
    });
  });

  it("does not fall back from ACTAgentHub to non-ACTAgent npm packages", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: false,
      code: "package_not_found",
      error: "Package not found on ACTAgentHub.",
    });
    const config: ACTAgentConfig = {
      channels: {
        "legacy-chat": {
          enabled: true,
        },
      },
      plugins: {
        load: { paths: [appBundledPluginRoot("legacy-chat")] },
        installs: {
          "legacy-chat": {
            source: "path",
            sourcePath: appBundledPluginRoot("legacy-chat"),
            installPath: appBundledPluginRoot("legacy-chat"),
          },
        },
      },
    };

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:legacy-chat@2026.5.1-beta.2",
          npmSpec: "@someone-else/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config,
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.summary.switchedToNpm).toStrictEqual([]);
    expect(result.summary.warnings).toStrictEqual([]);
    expect(result.summary.errors).toEqual([
      "Failed to update legacy-chat: Package not found on ACTAgentHub. (ACTAgentHub actagenthub:legacy-chat@2026.5.1-beta.2).",
    ]);
  });

  it("falls back from official ACTAgentHub artifact misses to trusted npm packages", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: false,
      code: "artifact_download_unavailable",
      error: "ACTAgentHub actagentpack artifact is unavailable.",
    });
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "voice-call",
        targetDir: "/tmp/actagent-plugins/voice-call",
        version: "0.0.2-beta.1",
      }),
    );

    await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "voice-call",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:@actagent/voice-call",
          npmSpec: "@actagent/voice-call",
          channelIds: ["voice-call"],
        },
      ],
      config: {
        channels: {
          "voice-call": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: [appBundledPluginRoot("voice-call")] },
          installs: {
            "voice-call": {
              source: "path",
              sourcePath: appBundledPluginRoot("voice-call"),
              installPath: appBundledPluginRoot("voice-call"),
            },
          },
        },
      },
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/voice-call");
    expect(npmInstallCall()?.expectedPluginId).toBe("voice-call");
    expect(npmInstallCall()?.trustedSourceLinkedOfficialInstall).toBe(true);
  });

  it("moves ACTAgentHub-preferred externalized plugin fallbacks back to ACTAgentHub", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromACTAgentHubMock.mockResolvedValue(
      createSuccessfulACTAgentHubUpdateResult({
        pluginId: "legacy-chat",
        targetDir: "/tmp/actagent-plugins/legacy-chat",
        version: "2026.5.1-beta.2",
        actagenthubPackage: "legacy-chat",
      }),
    );

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:legacy-chat@2026.5.1-beta.2",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          installs: {
            "legacy-chat": {
              source: "npm",
              spec: "@actagent/legacy-chat",
              installPath: "/tmp/actagent-plugins/legacy-chat",
            },
          },
        },
      },
    });

    expect(actAgentHubInstallCall()?.spec).toBe("actagenthub:legacy-chat@2026.5.1-beta.2");
    expect(actAgentHubInstallCall()?.mode).toBe("update");
    expect(actAgentHubInstallCall()?.expectedPluginId).toBe("legacy-chat");
    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expect(result.summary.switchedToACTAgentHub).toEqual(["legacy-chat"]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "actagenthub",
      spec: "actagenthub:legacy-chat@2026.5.1-beta.2",
      installPath: "/tmp/actagent-plugins/legacy-chat",
    });
  });

  it("fails closed without npm fallback when ACTAgentHub returns integrity drift", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: false,
      code: "archive_integrity_mismatch",
      error: "ACTAgentHub actagentpack integrity mismatch.",
    });
    const config: ACTAgentConfig = {
      channels: {
        "legacy-chat": {
          enabled: true,
        },
      },
      plugins: {
        load: { paths: [appBundledPluginRoot("legacy-chat")] },
        installs: {
          "legacy-chat": {
            source: "path",
            sourcePath: appBundledPluginRoot("legacy-chat"),
            installPath: appBundledPluginRoot("legacy-chat"),
          },
        },
      },
    };

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:legacy-chat@2026.5.1-beta.2",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config,
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.summary.errors).toEqual([
      "Failed to update legacy-chat: ACTAgentHub actagentpack integrity mismatch. (ACTAgentHub actagenthub:legacy-chat@2026.5.1-beta.2).",
    ]);
  });

  it("externalizes bundled plugins that were enabled by default", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "default-chat",
        targetDir: "/tmp/actagent-plugins/default-chat",
        version: "2.0.0",
      }),
    );

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "default-chat",
          enabledByDefault: true,
          npmSpec: "@actagent/default-chat",
          channelIds: ["default-chat"],
        },
      ],
      config: {},
    });

    expect(npmInstallCall()?.spec).toBe("@actagent/default-chat");
    expect(npmInstallCall()?.mode).toBe("update");
    expect(npmInstallCall()?.expectedPluginId).toBe("default-chat");
    expect(result.changed).toBe(true);
    expect(result.summary.switchedToNpm).toEqual(["default-chat"]);
    expectRecordFields(result.config.plugins?.installs?.["default-chat"], {
      source: "npm",
      spec: "@actagent/default-chat",
      installPath: "/tmp/actagent-plugins/default-chat",
      version: "2.0.0",
    });
  });

  it("does not externalize disabled bundled plugins", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        plugins: {
          entries: {
            "legacy-chat": {
              enabled: false,
            },
          },
          load: { paths: [appBundledPluginRoot("legacy-chat")] },
          installs: {
            "legacy-chat": {
              source: "path",
              sourcePath: appBundledPluginRoot("legacy-chat"),
              installPath: appBundledPluginRoot("legacy-chat"),
            },
          },
        },
      },
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "path",
    });
  });

  it("leaves config unchanged when externalized plugin installation fails", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: false,
      error: "package unavailable",
    });
    const config: ACTAgentConfig = {
      channels: {
        "legacy-chat": {
          enabled: true,
        },
      },
      plugins: {
        load: { paths: [appBundledPluginRoot("legacy-chat")] },
        installs: {
          "legacy-chat": {
            source: "path",
            sourcePath: appBundledPluginRoot("legacy-chat"),
            installPath: appBundledPluginRoot("legacy-chat"),
          },
        },
      },
    };

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config,
    });

    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.summary.errors).toEqual(["Failed to update legacy-chat: package unavailable"]);
  });

  it("does not externalize custom local path installs that only share the old plugin id", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: ["/workspace/plugins/legacy-chat"] },
          installs: {
            "legacy-chat": {
              source: "path",
              sourcePath: "/workspace/plugins/legacy-chat",
              installPath: "/workspace/plugins/legacy-chat",
            },
          },
        },
      },
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "path",
      sourcePath: "/workspace/plugins/legacy-chat",
    });
  });

  it("does not externalize while the bundled source is still present in the current build", async () => {
    mockBundledSources(
      createBundledSource({
        pluginId: "legacy-chat",
        localPath: appBundledPluginRoot("legacy-chat"),
      }),
    );

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: { paths: [appBundledPluginRoot("legacy-chat")] },
          installs: {
            "legacy-chat": {
              source: "path",
              sourcePath: appBundledPluginRoot("legacy-chat"),
              installPath: appBundledPluginRoot("legacy-chat"),
            },
          },
        },
      },
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "path",
    });
  });

  it("removes stale bundled load paths for already-externalized npm installs", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: {
            paths: [appBundledPluginRoot("legacy-chat"), "/workspace/plugins/other"],
          },
          installs: {
            "legacy-chat": {
              source: "npm",
              spec: "@actagent/legacy-chat",
              installPath: "/tmp/actagent-plugins/legacy-chat",
            },
          },
        },
      },
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.load?.paths).toEqual(["/workspace/plugins/other"]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "npm",
      spec: "@actagent/legacy-chat",
    });
  });

  it("removes stale bundled load paths for already-externalized resolved-name-only npm installs", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: {
            paths: [appBundledPluginRoot("legacy-chat"), "/workspace/plugins/other"],
          },
          installs: {
            "legacy-chat": {
              source: "npm",
              resolvedName: "@actagent/legacy-chat",
              installPath: "/tmp/actagent-plugins/legacy-chat",
            },
          },
        },
      },
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.load?.paths).toEqual(["/workspace/plugins/other"]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "npm",
      resolvedName: "@actagent/legacy-chat",
    });
  });

  it("removes stale bundled load paths for already-externalized pinned npm installs", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: {
            paths: [appBundledPluginRoot("legacy-chat"), "/workspace/plugins/other"],
          },
          installs: {
            "legacy-chat": {
              source: "npm",
              spec: "@actagent/legacy-chat@1.2.3",
              resolvedSpec: "@actagent/legacy-chat@1.2.3",
              installPath: "/tmp/actagent-plugins/legacy-chat",
            },
          },
        },
      },
    });

    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.load?.paths).toEqual(["/workspace/plugins/other"]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "npm",
      spec: "@actagent/legacy-chat@1.2.3",
    });
  });

  it("removes stale bundled load paths for already-externalized pinned ACTAgentHub installs", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());

    const result = await syncPluginsForUpdateChannel({
      channel: "stable",
      externalizedBundledPluginBridges: [
        {
          bundledPluginId: "legacy-chat",
          preferredSource: "actagenthub",
          actagenthubSpec: "actagenthub:legacy-chat",
          npmSpec: "@actagent/legacy-chat",
          channelIds: ["legacy-chat"],
        },
      ],
      config: {
        channels: {
          "legacy-chat": {
            enabled: true,
          },
        },
        plugins: {
          load: {
            paths: [appBundledPluginRoot("legacy-chat"), "/workspace/plugins/other"],
          },
          installs: {
            "legacy-chat": {
              source: "actagenthub",
              spec: "actagenthub:legacy-chat@2026.5.1",
              actagenthubPackage: "legacy-chat",
              installPath: "/tmp/actagent-plugins/legacy-chat",
            },
          },
        },
      },
    });

    expect(installPluginFromACTAgentHubMock).not.toHaveBeenCalled();
    expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.load?.paths).toEqual(["/workspace/plugins/other"]);
    expectRecordFields(result.config.plugins?.installs?.["legacy-chat"], {
      source: "actagenthub",
      spec: "actagenthub:legacy-chat@2026.5.1",
    });
  });
});
