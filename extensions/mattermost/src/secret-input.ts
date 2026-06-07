// Mattermost plugin module implements secret input behavior.
export type { SecretInput } from "actagent/plugin-sdk/secret-input";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "actagent/plugin-sdk/secret-input";
