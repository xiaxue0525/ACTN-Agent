/** Tests plugin install command handling and config updates. */
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "../../config/home-env.test-harness.js";
import { expectObjectFields, mockFirstObjectArg } from "../../test-utils/mock-call-assertions.js";
import { createCommandWorkspaceHarness } from "./commands-filesystem.test-support.js";
import { handlePluginsCommand } from "./commands-plugins.js";
import { buildPluginsCommandParams } from "./commands.test-harness.js";

const {
  installPluginFromNpmSpecMock,
  installPluginFromPathMock,
  installPluginFromACTAgentHubMock,
  installPluginFromGitSpecMock,
  persistPluginInstallMock,
} = vi.hoisted(() => ({
  installPluginFromNpmSpecMock: vi.fn(),
  installPluginFromPathMock: vi.fn(),
  installPluginFromACTAgentHubMock: vi.fn(),
  installPluginFromGitSpecMock: vi.fn(),
  persistPluginInstallMock: vi.fn(),
}));

vi.mock("../../plugins/install.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/install.js")>(
    "../../plugins/install.js",
  );
  return {
    ...actual,
    installPluginFromNpmSpec: installPluginFromNpmSpecMock,
    installPluginFromPath: installPluginFromPathMock,
  };
});

vi.mock("../../plugins/actagenthub.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/actagenthub.js")>(
    "../../plugins/actagenthub.js",
  );
  return {
    ...actual,
    installPluginFromACTAgentHub: installPluginFromACTAgentHubMock,
  };
});

vi.mock("../../plugins/git-install.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/git-install.js")>(
    "../../plugins/git-install.js",
  );
  return {
    ...actual,
    installPluginFromGitSpec: installPluginFromGitSpecMock,
  };
});

vi.mock("../../cli/plugins-install-persist.js", () => ({
  persistPluginInstall: persistPluginInstallMock,
}));

const workspaceHarness = createCommandWorkspaceHarness("actagent-command-plugins-install-");

function buildPluginsParams(commandBodyNormalized: string, workspaceDir: string) {
  return buildPluginsCommandParams({
    commandBodyNormalized,
    workspaceDir,
    gatewayClientScopes: ["operator.admin", "operator.write", "operator.pairing"],
  });
}

function expectPersistedInstall(pluginId: string, expectedInstall: Record<string, unknown>): void {
  const persisted = mockFirstObjectArg(persistPluginInstallMock);
  expect(persisted.pluginId).toBe(pluginId);
  expectObjectFields(persisted.install, expectedInstall);
}

describe("handleCommands /plugins install", () => {
  afterEach(async () => {
    installPluginFromNpmSpecMock.mockReset();
    installPluginFromPathMock.mockReset();
    installPluginFromACTAgentHubMock.mockReset();
    installPluginFromGitSpecMock.mockReset();
    persistPluginInstallMock.mockReset();
    await workspaceHarness.cleanupWorkspaces();
  });

  it("installs a plugin from a local path", async () => {
    installPluginFromPathMock.mockResolvedValue({
      ok: true,
      pluginId: "path-install-plugin",
      targetDir: "/tmp/path-install-plugin",
      version: "0.0.1",
      extensions: ["index.js"],
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("actagent-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const pluginDir = path.join(workspaceDir, "fixtures", "path-install-plugin");
      await fs.mkdir(pluginDir, { recursive: true });

      const params = buildPluginsParams(`/plugins install ${pluginDir}`, workspaceDir);
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "path-install-plugin"');
      expect(mockFirstObjectArg(installPluginFromPathMock).path).toBe(pluginDir);
      expectPersistedInstall("path-install-plugin", {
        source: "path",
        sourcePath: pluginDir,
        installPath: "/tmp/path-install-plugin",
        version: "0.0.1",
      });
    });
  });

  it("installs from an explicit actagenthub: spec", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: true,
      pluginId: "actagenthub-demo",
      targetDir: "/tmp/actagenthub-demo",
      version: "1.2.3",
      extensions: ["index.js"],
      packageName: "@actagent/actagenthub-demo",
      actagenthub: {
        source: "actagenthub",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "@actagent/actagenthub-demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        version: "1.2.3",
        integrity: "sha512-demo",
        resolvedAt: "2026-03-22T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("actagent-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildPluginsParams(
        "/plugins install actagenthub:@actagent/actagenthub-demo@1.2.3",
        workspaceDir,
      );
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "actagenthub-demo"');
      expect(mockFirstObjectArg(installPluginFromACTAgentHubMock).spec).toBe(
        "actagenthub:@actagent/actagenthub-demo@1.2.3",
      );
      expectPersistedInstall("actagenthub-demo", {
        source: "actagenthub",
        spec: "actagenthub:@actagent/actagenthub-demo@1.2.3",
        installPath: "/tmp/actagenthub-demo",
        version: "1.2.3",
        integrity: "sha512-demo",
        actagenthubPackage: "@actagent/actagenthub-demo",
        actagenthubChannel: "official",
      });
    });
  });

  it("refuses plugin installs in Nix mode before package installer side effects", async () => {
    const previousNixMode = process.env.ACTAGENT_NIX_MODE;
    process.env.ACTAGENT_NIX_MODE = "1";
    try {
      await withTempHome("actagent-command-plugins-home-", async () => {
        const workspaceDir = await workspaceHarness.createWorkspace();
        const params = buildPluginsParams("/plugins install @acme/demo", workspaceDir);
        const result = await handlePluginsCommand(params, true);
        if (result === null) {
          throw new Error("expected plugin install result");
        }

        expect(result.reply?.text).toContain("ACTAGENT_NIX_MODE=1");
        expect(result.reply?.text).toContain("nix-actagent#quick-start");
        expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
        expect(installPluginFromPathMock).not.toHaveBeenCalled();
        expect(installPluginFromACTAgentHubMock).not.toHaveBeenCalled();
        expect(installPluginFromGitSpecMock).not.toHaveBeenCalled();
        expect(persistPluginInstallMock).not.toHaveBeenCalled();
      });
    } finally {
      if (previousNixMode === undefined) {
        delete process.env.ACTAGENT_NIX_MODE;
      } else {
        process.env.ACTAGENT_NIX_MODE = previousNixMode;
      }
    }
  });

  it("installs from an explicit git: spec", async () => {
    installPluginFromGitSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "git-demo",
      targetDir: "/tmp/git-demo",
      version: "1.2.3",
      extensions: ["index.js"],
      git: {
        url: "https://github.com/acme/git-demo.git",
        ref: "v1.2.3",
        commit: "abc123",
        resolvedAt: "2026-04-30T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("actagent-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildPluginsParams(
        "/plugins install git:github.com/acme/git-demo@v1.2.3",
        workspaceDir,
      );
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "git-demo"');
      expect(mockFirstObjectArg(installPluginFromGitSpecMock).spec).toBe(
        "git:github.com/acme/git-demo@v1.2.3",
      );
      expectPersistedInstall("git-demo", {
        source: "git",
        spec: "git:github.com/acme/git-demo@v1.2.3",
        installPath: "/tmp/git-demo",
        version: "1.2.3",
        gitUrl: "https://github.com/acme/git-demo.git",
        gitRef: "v1.2.3",
        gitCommit: "abc123",
      });
    });
  });

  it("treats /plugin add as an install alias", async () => {
    installPluginFromACTAgentHubMock.mockResolvedValue({
      ok: true,
      pluginId: "alias-demo",
      targetDir: "/tmp/alias-demo",
      version: "1.0.0",
      extensions: ["index.js"],
      packageName: "@actagent/alias-demo",
      actagenthub: {
        source: "actagenthub",
        actagenthubUrl: "https://actagenthub.ai",
        actagenthubPackage: "@actagent/alias-demo",
        actagenthubFamily: "code-plugin",
        actagenthubChannel: "official",
        version: "1.0.0",
        integrity: "sha512-alias",
        resolvedAt: "2026-03-23T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("actagent-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildPluginsParams(
        "/plugin add actagenthub:@actagent/alias-demo@1.0.0",
        workspaceDir,
      );
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "alias-demo"');
      expect(mockFirstObjectArg(installPluginFromACTAgentHubMock).spec).toBe(
        "actagenthub:@actagent/alias-demo@1.0.0",
      );
    });
  });

  it("trusts catalog npm package installs with alternate selectors", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "wecom-actagent-plugin",
      targetDir: "/tmp/wecom-actagent-plugin",
      version: "2026.4.23",
      extensions: ["index.js"],
      npmResolution: {
        name: "@wecom/wecom-actagent-plugin",
        version: "2026.4.23",
        resolvedSpec: "@wecom/wecom-actagent-plugin@2026.4.23",
        integrity: "sha512-wecom",
        resolvedAt: "2026-05-04T20:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("actagent-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildPluginsParams(
        "/plugins install @wecom/wecom-actagent-plugin@latest",
        workspaceDir,
      );
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "wecom-actagent-plugin"');
      const npmInstallArgs = mockFirstObjectArg(installPluginFromNpmSpecMock);
      expectObjectFields(npmInstallArgs, {
        spec: "@wecom/wecom-actagent-plugin@latest",
        expectedPluginId: "wecom-actagent-plugin",
        trustedSourceLinkedOfficialInstall: true,
      });
      expect(npmInstallArgs.expectedIntegrity).toBeUndefined();
      expectPersistedInstall("wecom-actagent-plugin", {
        source: "npm",
        spec: "@wecom/wecom-actagent-plugin@latest",
        installPath: "/tmp/wecom-actagent-plugin",
        version: "2026.4.23",
        resolvedName: "@wecom/wecom-actagent-plugin",
        resolvedVersion: "2026.4.23",
      });
    });
  });
});
