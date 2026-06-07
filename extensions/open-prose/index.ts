// Open Prose plugin entrypoint registers its ACTAgent integration.
import { definePluginEntry, type ACTAgentPluginApi } from "./runtime-api.js";

export default definePluginEntry({
  id: "open-prose",
  name: "OpenProse",
  description: "Plugin-shipped prose skills bundle",
  register(_api: ACTAgentPluginApi) {
    // OpenProse is delivered via plugin-shipped skills.
  },
});
