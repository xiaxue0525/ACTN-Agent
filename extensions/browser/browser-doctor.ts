/**
 * Browser doctor API barrel. It exposes legacy profile cleanup and Chrome MCP
 * readiness helpers for ACTAgent doctor.
 */
export {
  detectLegacyactagentdBrowserProfileResidue,
  maybeArchiveLegacyactagentdBrowserProfileResidue,
  noteChromeMcpBrowserReadiness,
} from "./src/doctor-browser.js";
export type { LegacyactagentdBrowserProfileResidue } from "./src/doctor-browser.js";
