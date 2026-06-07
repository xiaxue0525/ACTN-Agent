// Provider-index types describe install hints, auth choices, and preview catalogs for discoverable providers.
import type { ModelCatalogProvider } from "@actagent/model-catalog-core/model-catalog-types";

// Normalized provider-index schema. It describes providers discoverable before
// plugin install, including install hints, auth choices, and preview catalogs.
export type ACTAgentProviderIndexPluginInstall = {
  actagenthubSpec?: string;
  npmSpec?: string;
  defaultChoice?: "actagenthub" | "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type ACTAgentProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: ACTAgentProviderIndexPluginInstall;
};

export type ACTAgentProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation" | "music-generation")[];
};

export type ACTAgentProviderIndexProvider = {
  id: string;
  name: string;
  plugin: ACTAgentProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly ACTAgentProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type ACTAgentProviderIndex = {
  version: number;
  providers: Readonly<Record<string, ACTAgentProviderIndexProvider>>;
};
