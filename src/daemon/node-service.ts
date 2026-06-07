/** Adapts the generic gateway service manager for ACTAgent node-host services. */
import {
  NODE_SERVICE_KIND,
  NODE_SERVICE_MARKER,
  NODE_WINDOWS_TASK_SCRIPT_NAME,
  resolveNodeLaunchAgentLabel,
  resolveNodeSystemdServiceName,
  resolveNodeWindowsTaskName,
} from "./constants.js";
import type { GatewayService, GatewayServiceInstallArgs } from "./service.js";
import { resolveGatewayService } from "./service.js";

// Wraps the generic gateway service with node-specific service identifiers and env.
function withNodeServiceEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  // Node services reuse gateway platform installers; env overrides select the
  // node-specific labels, logs, task script, and service marker.
  return {
    ...env,
    ACTAGENT_LAUNCHD_LABEL: resolveNodeLaunchAgentLabel(),
    ACTAGENT_SYSTEMD_UNIT: resolveNodeSystemdServiceName(),
    ACTAGENT_WINDOWS_TASK_NAME: resolveNodeWindowsTaskName(),
    ACTAGENT_WINDOWS_TASK_HIDDEN_LAUNCHER: "1",
    ACTAGENT_TASK_SCRIPT_NAME: NODE_WINDOWS_TASK_SCRIPT_NAME,
    ACTAGENT_LOG_PREFIX: "node",
    ACTAGENT_SERVICE_MARKER: NODE_SERVICE_MARKER,
    ACTAGENT_SERVICE_KIND: NODE_SERVICE_KIND,
  };
}

function withNodeInstallEnv(args: GatewayServiceInstallArgs): GatewayServiceInstallArgs {
  return {
    ...args,
    env: withNodeServiceEnv(args.env),
    environment: {
      ...args.environment,
      ACTAGENT_LAUNCHD_LABEL: resolveNodeLaunchAgentLabel(),
      ACTAGENT_SYSTEMD_UNIT: resolveNodeSystemdServiceName(),
      ACTAGENT_WINDOWS_TASK_NAME: resolveNodeWindowsTaskName(),
      ACTAGENT_WINDOWS_TASK_HIDDEN_LAUNCHER: "1",
      ACTAGENT_TASK_SCRIPT_NAME: NODE_WINDOWS_TASK_SCRIPT_NAME,
      ACTAGENT_LOG_PREFIX: "node",
      ACTAGENT_SERVICE_MARKER: NODE_SERVICE_MARKER,
      ACTAGENT_SERVICE_KIND: NODE_SERVICE_KIND,
    },
  };
}

/** Returns a service controller bound to node-host labels across all platforms. */
export function resolveNodeService(): GatewayService {
  const base = resolveGatewayService();
  return {
    ...base,
    stage: async (args) => {
      return base.stage(withNodeInstallEnv(args));
    },
    install: async (args) => {
      return base.install(withNodeInstallEnv(args));
    },
    uninstall: async (args) => {
      return base.uninstall({ ...args, env: withNodeServiceEnv(args.env) });
    },
    stop: async (args) => {
      return base.stop({ ...args, env: withNodeServiceEnv(args.env ?? {}) });
    },
    restart: async (args) => {
      return base.restart({ ...args, env: withNodeServiceEnv(args.env ?? {}) });
    },
    isLoaded: async (args) => {
      return base.isLoaded({ env: withNodeServiceEnv(args.env ?? {}) });
    },
    readCommand: (env) => base.readCommand(withNodeServiceEnv(env)),
    readRuntime: (env) => base.readRuntime(withNodeServiceEnv(env)),
  };
}
