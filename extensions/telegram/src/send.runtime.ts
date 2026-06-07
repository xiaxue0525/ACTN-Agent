// Telegram plugin module implements send behavior.
export { requireRuntimeConfig } from "actagent/plugin-sdk/plugin-config-runtime";
export { resolveMarkdownTableMode } from "actagent/plugin-sdk/markdown-table-runtime";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
export type { PollInput, MediaKind } from "actagent/plugin-sdk/media-runtime";
export {
  buildOutboundMediaLoadOptions,
  getImageMetadata,
  isGifMedia,
  kindFromMime,
  normalizePollInput,
  probeVideoDimensions,
} from "actagent/plugin-sdk/media-runtime";
export { loadWebMedia } from "actagent/plugin-sdk/web-media";
