// Memory Core plugin module implements public artifacts behavior.
import {
  listMemoryHostPublicArtifacts,
  type MemoryPluginPublicArtifact,
} from "actagent/plugin-sdk/memory-host-core";
import type { ACTAgentConfig } from "../api.js";

export async function listMemoryCorePublicArtifacts(params: {
  cfg: ACTAgentConfig;
}): Promise<MemoryPluginPublicArtifact[]> {
  return await listMemoryHostPublicArtifacts(params);
}
