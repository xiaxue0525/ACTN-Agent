// Together provider module implements model/runtime integration.
import { buildManifestModelProviderConfig } from "actagent/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "actagent/plugin-sdk/provider-model-shared";
import manifest from "./actagent.plugin.json" with { type: "json" };

export function buildTogetherProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "together",
    catalog: manifest.modelCatalog.providers.together,
  });
}
