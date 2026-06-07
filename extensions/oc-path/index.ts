// OC Path plugin entrypoint registers its ACTAgent integration.
import { definePluginEntry } from "actagent/plugin-sdk/plugin-entry";
import { registerOcPathCli } from "./cli-registration.js";

export default definePluginEntry({
  id: "oc-path",
  name: "OC Path",
  description: "Adds the actagent path CLI for oc:// workspace file addressing.",
  register(api) {
    registerOcPathCli(api);
  },
});
