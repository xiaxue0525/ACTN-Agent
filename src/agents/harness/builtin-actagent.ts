/**
 * Built-in ACTAgent harness registration.
 *
 * Harness selection uses this factory to expose the embedded ACTAgent runtime
 * through the same AgentHarness contract as external harness plugins.
 */
import { ACTAGENT_EMBEDDED_CONTEXT_ENGINE_HOST } from "../../context-engine/host-compat.js";
import { runEmbeddedAttempt } from "../embedded-agent-runner/run/attempt.js";
import type { AgentHarness } from "./types.js";

/** Creates the built-in harness backed by the embedded ACTAgent agent runner. */
export function createACTAgentAgentHarness(): AgentHarness {
  return {
    id: "actagent",
    label: "ACTAgent embedded agent",
    contextEngineHostCapabilities: ACTAGENT_EMBEDDED_CONTEXT_ENGINE_HOST.capabilities,
    supports: () => ({ supported: true, priority: 0 }),
    runAttempt: runEmbeddedAttempt,
  };
}
