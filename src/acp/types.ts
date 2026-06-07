/** ACP server option re-exports and ACTAgent agent identity metadata. */
export type { AcpProvenanceMode, AcpServerOptions, AcpSession } from "@actagent/acp-core/types";
export { normalizeAcpProvenanceMode } from "@actagent/acp-core/types";
import { VERSION } from "../version.js";

/** ACP agent identity advertised during protocol initialization. */
export const ACP_AGENT_INFO = {
  name: "actagent-acp",
  title: "ACTAgent ACP Gateway",
  version: VERSION,
};
