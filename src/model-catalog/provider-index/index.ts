// Provider-index public facade for normalized provider discovery metadata.
export { loadACTAgentProviderIndex } from "./load.js";
export { normalizeACTAgentProviderIndex } from "./normalize.js";
export type {
  ACTAgentProviderIndex,
  ACTAgentProviderIndexPluginInstall,
  ACTAgentProviderIndexPlugin,
  ACTAgentProviderIndexProviderAuthChoice,
  ACTAgentProviderIndexProvider,
} from "./types.js";
