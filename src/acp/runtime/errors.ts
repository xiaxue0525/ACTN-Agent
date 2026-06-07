/** ACP runtime error exports wired to ACTAgent secret redaction. */
import { configureAcpErrorRedactor } from "@actagent/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

// Ensure ACP-core runtime errors use ACTAgent's secret redaction before re-export.
configureAcpErrorRedactor(redactSensitiveText);

export * from "@actagent/acp-core/runtime/errors";
