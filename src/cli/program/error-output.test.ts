// Error output tests cover program-level error display and exit messaging.
import { describe, expect, it } from "vitest";
import { formatCliParseErrorOutput } from "./error-output.js";

describe("formatCliParseErrorOutput", () => {
  it("explains unknown commands with root help and plugin hints", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'wat'\n", {
      argv: ["node", "actagent", "wat"],
    });

    expect(output).toBe(
      'ACTAgent does not know the command "wat".\nTry: actagent --help\nPlugin command? actagent plugins list\nDocs: https://docs.actagent.ai/cli\n',
    );
  });

  it("points unknown options at the active command help", () => {
    const output = formatCliParseErrorOutput("error: unknown option '--wat'\n", {
      argv: ["node", "actagent", "channels", "status", "--wat"],
    });

    expect(output).toBe(
      'ACTAgent does not recognize option "--wat".\nTry: actagent channels status --help\n',
    );
  });

  it("points missing required arguments at command help", () => {
    const output = formatCliParseErrorOutput("error: missing required argument 'name'\n", {
      argv: ["node", "actagent", "plugins", "install"],
    });

    expect(output).toBe(
      'Missing required argument "name".\nTry: actagent plugins install --help\n',
    );
  });
});
