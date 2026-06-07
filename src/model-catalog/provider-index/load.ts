// Provider-index loader normalizes bundled installable-provider metadata and falls back to an empty index.
import { normalizeACTAgentProviderIndex } from "./normalize.js";
import { ACTAGENT_PROVIDER_INDEX } from "./actagent-provider-index.js";
import type { ACTAgentProviderIndex } from "./types.js";

// Load the bundled provider index through the normalizer. Invalid generated or
// caller-supplied data falls back to an empty v1 index instead of leaking shape.
export function loadACTAgentProviderIndex(
  source: unknown = ACTAGENT_PROVIDER_INDEX,
): ACTAgentProviderIndex {
  return normalizeACTAgentProviderIndex(source) ?? { version: 1, providers: {} };
}
