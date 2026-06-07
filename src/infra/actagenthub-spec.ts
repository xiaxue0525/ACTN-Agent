// Parses explicit ACTAgentHub package install specs.
import { normalizeLowercaseStringOrEmpty } from "@actagent/normalization-core/string-coerce";

/** Parses explicit `actagenthub:<name>[@version]` package specs for ACTAgentHub installs. */
export function parseACTAgentHubPluginSpec(raw: string): {
  name: string;
  version?: string;
  baseUrl?: string;
} | null {
  const trimmed = raw.trim();
  if (!normalizeLowercaseStringOrEmpty(trimmed).startsWith("actagenthub:")) {
    return null;
  }
  const spec = trimmed.slice("actagenthub:".length).trim();
  if (!spec) {
    return null;
  }
  const atIndex = spec.lastIndexOf("@");
  if (atIndex <= 0) {
    return { name: spec };
  }
  if (atIndex >= spec.length - 1) {
    return null;
  }
  const name = spec.slice(0, atIndex).trim();
  const version = spec.slice(atIndex + 1).trim();
  if (!name || !version) {
    return null;
  }
  return {
    name,
    version,
  };
}
