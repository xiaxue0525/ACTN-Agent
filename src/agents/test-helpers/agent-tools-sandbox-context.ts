/**
 * Sandbox context fixture builder for agent-tool tests.
 *
 * Produces Docker-shaped contexts with safe defaults and caller-controlled filesystem bridges.
 */
import type { SandboxContext, SandboxToolPolicy, SandboxWorkspaceAccess } from "../sandbox.js";
import type { SandboxFsBridge } from "../sandbox/fs-bridge.js";

type AgentToolsSandboxContextParams = {
  workspaceDir: string;
  agentWorkspaceDir?: string;
  workspaceAccess?: SandboxWorkspaceAccess;
  fsBridge?: SandboxFsBridge;
  tools?: SandboxToolPolicy;
  browserAllowHostControl?: boolean;
  sessionKey?: string;
  containerName?: string;
  containerWorkdir?: string;
  dockerOverrides?: Partial<SandboxContext["docker"]>;
};

/** Builds a Docker-shaped sandbox context with safe test defaults. */
export function createAgentToolsSandboxContext(
  params: AgentToolsSandboxContextParams,
): SandboxContext {
  const workspaceDir = params.workspaceDir;
  return {
    enabled: true,
    backendId: "docker",
    sessionKey: params.sessionKey ?? "sandbox:test",
    workspaceDir,
    agentWorkspaceDir: params.agentWorkspaceDir ?? workspaceDir,
    workspaceAccess: params.workspaceAccess ?? "rw",
    runtimeId: params.containerName ?? "actagent-sbx-test",
    runtimeLabel: params.containerName ?? "actagent-sbx-test",
    containerName: params.containerName ?? "actagent-sbx-test",
    containerWorkdir: params.containerWorkdir ?? "/workspace",
    fsBridge: params.fsBridge,
    docker: {
      image: "actagent-sandbox:bookworm-slim",
      containerPrefix: "actagent-sbx-",
      workdir: "/workspace",
      readOnlyRoot: true,
      tmpfs: [],
      network: "none",
      user: "1000:1000",
      capDrop: ["ALL"],
      env: { LANG: "C.UTF-8" },
      ...params.dockerOverrides,
    },
    tools: params.tools ?? { allow: [], deny: [] },
    browserAllowHostControl: params.browserAllowHostControl ?? false,
  };
}
