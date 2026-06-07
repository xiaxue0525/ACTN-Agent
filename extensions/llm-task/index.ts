// Llm Task plugin entrypoint registers its ACTAgent integration.
import { optionalPositiveIntegerSchema } from "actagent/plugin-sdk/channel-actions";
import { defineToolPlugin } from "actagent/plugin-sdk/tool-plugin";
import { Type } from "typebox";
import type { AnyAgentTool } from "./api.js";
import { createLlmTaskTool, llmTaskToolDefinition } from "./src/llm-task-tool.js";

export default defineToolPlugin({
  id: "llm-task",
  name: "LLM Task",
  description: "Generic JSON-only LLM tool for structured tasks callable from workflows.",
  configSchema: Type.Object(
    {
      defaultProvider: Type.Optional(Type.String()),
      defaultModel: Type.Optional(Type.String()),
      defaultAuthProfileId: Type.Optional(Type.String()),
      allowedModels: Type.Optional(
        Type.Array(Type.String(), {
          description: "Allowlist of provider/model keys like openai/gpt-5.5.",
        }),
      ),
      maxTokens: optionalPositiveIntegerSchema(),
      timeoutMs: optionalPositiveIntegerSchema(),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    tool({
      ...llmTaskToolDefinition,
      optional: true,
      factory: ({ api }) => createLlmTaskTool(api) as unknown as AnyAgentTool,
    }),
  ],
});
