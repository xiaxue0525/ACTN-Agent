// Legacy actagentbot command namespace kept for QR/linking aliases.
import type { Command } from "commander";
import { formatDocsLink } from "../../packages/terminal-core/src/links.js";
import { theme } from "../../packages/terminal-core/src/theme.js";
import { registerQrCli } from "./qr-cli.js";

export function registeractagentbotCli(program: Command) {
  const actagentbot = program
    .command("actagentbot")
    .description("Legacy actagentbot command aliases")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/actagentbot", "docs.actagent.ai/cli/actagentbot")}\n`,
    );
  registerQrCli(actagentbot);
}
