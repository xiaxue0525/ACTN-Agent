// Openai plugin module implements transport policy behavior.
import type {
  ProviderResolveTransportTurnStateContext,
  ProviderResolveWebSocketSessionPolicyContext,
  ProviderTransportTurnState,
  ProviderWebSocketSessionPolicy,
} from "actagent/plugin-sdk/plugin-entry";
import { normalizeProviderId } from "actagent/plugin-sdk/provider-model-shared";
import { normalizeLowercaseStringOrEmpty } from "actagent/plugin-sdk/string-coerce-runtime";
import { isOpenAIApiBaseUrl, isOpenAICodexBaseUrl } from "./base-url.js";

const DEFAULT_OPENAI_WS_DEGRADE_COOLDOWN_MS = 60_000;
const AZURE_PROVIDER_IDS = new Set(["azure-openai", "azure-openai-responses"]);

function isAzureOpenAIBaseUrl(baseUrl?: string): boolean {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return false;
  }
  try {
    return normalizeLowercaseStringOrEmpty(new URL(trimmed).hostname).endsWith(".openai.azure.com");
  } catch {
    return false;
  }
}

function normalizeIdentityValue(value: string, maxLength = 160): string {
  const trimmed = value.trim().replace(/[\r\n]+/g, " ");
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function usesKnownNativeOpenAIRoute(provider: string, baseUrl?: string): boolean {
  const normalizedProvider = normalizeProviderId(provider);
  if (!normalizedProvider) {
    return false;
  }
  if (normalizedProvider === "openai") {
    return !baseUrl || isOpenAIApiBaseUrl(baseUrl) || isOpenAICodexBaseUrl(baseUrl);
  }
  if (AZURE_PROVIDER_IDS.has(normalizedProvider)) {
    return !baseUrl || isAzureOpenAIBaseUrl(baseUrl);
  }
  return false;
}

function resolveSessionHeaders(params: {
  provider: string;
  baseUrl?: string;
  sessionId?: string;
}): Record<string, string> | undefined {
  if (!params.sessionId || !usesKnownNativeOpenAIRoute(params.provider, params.baseUrl)) {
    return undefined;
  }
  const sessionId = normalizeIdentityValue(params.sessionId);
  if (!sessionId) {
    return undefined;
  }
  return {
    "x-client-request-id": sessionId,
    "x-actagent-session-id": sessionId,
  };
}

export function resolveOpenAITransportTurnState(
  ctx: ProviderResolveTransportTurnStateContext,
): ProviderTransportTurnState | undefined {
  const sessionHeaders = resolveSessionHeaders({
    provider: ctx.provider,
    baseUrl: ctx.model?.baseUrl,
    sessionId: ctx.sessionId,
  });
  if (!sessionHeaders) {
    return undefined;
  }

  const turnId = normalizeIdentityValue(ctx.turnId);
  const attempt = String(Math.max(1, ctx.attempt));

  return {
    headers: {
      ...sessionHeaders,
      "x-actagent-turn-id": turnId,
      "x-actagent-turn-attempt": attempt,
    },
    metadata: {
      actagent_session_id: sessionHeaders["x-actagent-session-id"] ?? "",
      actagent_turn_id: turnId,
      actagent_turn_attempt: attempt,
      actagent_transport: ctx.transport,
    },
  };
}

export function resolveOpenAIWebSocketSessionPolicy(
  ctx: ProviderResolveWebSocketSessionPolicyContext,
): ProviderWebSocketSessionPolicy | undefined {
  if (!usesKnownNativeOpenAIRoute(ctx.provider, ctx.model?.baseUrl)) {
    return undefined;
  }
  return {
    headers: resolveSessionHeaders({
      provider: ctx.provider,
      baseUrl: ctx.model?.baseUrl,
      sessionId: ctx.sessionId,
    }),
    degradeCooldownMs: DEFAULT_OPENAI_WS_DEGRADE_COOLDOWN_MS,
  };
}
