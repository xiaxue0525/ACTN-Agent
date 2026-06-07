// Verifies image-generation tool registration through the shared generation harness.
import { describeACTAgentGenerationToolRegistration } from "./actagent-tools.generation.test-support.js";

describeACTAgentGenerationToolRegistration({
  suiteName: "actagent tools image generation registration",
  toolName: "image_generate",
  toolLabel: "an image-generation tool",
});
