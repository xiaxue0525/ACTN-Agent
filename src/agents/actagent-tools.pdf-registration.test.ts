// Verifies PDF tool factory output is included in ACTAgent tool registration.
import { describe, expect, it } from "vitest";
import { collectPresentACTAgentTools } from "./actagent-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createACTAgentTools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/actagent-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentACTAgentTools([pdfTool]).map((tool) => tool.name)).toEqual(["pdf"]);
  });
});
