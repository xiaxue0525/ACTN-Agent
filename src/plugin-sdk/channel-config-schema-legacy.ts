/**
 * @deprecated Compatibility surface for bundled channel schemas.
 *
 * ACTAgent-maintained bundled plugins should import
 * actagent/plugin-sdk/bundled-channel-config-schema. Third-party plugins should
 * define plugin-local schemas and import primitives from
 * actagent/plugin-sdk/channel-config-schema instead of depending on bundled
 * channel schemas.
 */
export * from "./bundled-channel-config-schema.js";
