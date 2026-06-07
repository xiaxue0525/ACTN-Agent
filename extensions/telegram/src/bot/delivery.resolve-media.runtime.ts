// Telegram plugin module implements delivery.resolve media behavior.
import { logVerbose, retryAsync, warn } from "actagent/plugin-sdk/runtime-env";
import { formatErrorMessage } from "actagent/plugin-sdk/ssrf-runtime";
import { resolveTelegramApiBase, shouldRetryTelegramTransportFallback } from "../fetch.js";
import {
  readRemoteMediaBuffer,
  MediaFetchError,
  saveMediaBuffer,
  saveRemoteMedia,
} from "../telegram-media.runtime.js";

export {
  readRemoteMediaBuffer,
  formatErrorMessage,
  logVerbose,
  MediaFetchError,
  resolveTelegramApiBase,
  retryAsync,
  saveMediaBuffer,
  saveRemoteMedia,
  shouldRetryTelegramTransportFallback,
  warn,
};
