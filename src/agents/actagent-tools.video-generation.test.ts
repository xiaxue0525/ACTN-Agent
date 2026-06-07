// Verifies video-generation tool registration through the shared generation harness.
import { describeACTAgentGenerationToolRegistration } from "./actagent-tools.generation.test-support.js";

describeACTAgentGenerationToolRegistration({
  suiteName: "actagent tools video generation registration",
  toolName: "video_generate",
  toolLabel: "a video-generation tool",
});
