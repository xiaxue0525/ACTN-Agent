// Packed Plugin Sdk Type Smoke script supports ACTAgent repository automation.
type PublicPluginSdkModules = [
  typeof import("actagent/plugin-sdk"),
  typeof import("actagent/plugin-sdk/channel-entry-contract"),
  typeof import("actagent/plugin-sdk/config-contracts"),
  typeof import("actagent/plugin-sdk/provider-entry"),
  typeof import("actagent/plugin-sdk/runtime-env"),
];

const resolvedModules = null as unknown as PublicPluginSdkModules;

void resolvedModules;
