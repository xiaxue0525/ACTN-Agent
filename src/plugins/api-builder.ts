// Builds plugin API objects from config, registries, and runtime helpers.
import type { ACTAgentConfig } from "../config/types.actagent.js";
import { attachPluginApiFacades, type ACTAgentPluginApiWithoutFacades } from "./api-facades.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { ACTAgentPluginApi, PluginLogger } from "./types.js";

export type BuildPluginApiParams = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  registrationMode: ACTAgentPluginApi["registrationMode"];
  config: ACTAgentConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  handlers?: Partial<
    Pick<
      ACTAgentPluginApi,
      | "registerTool"
      | "registerHook"
      | "registerHttpRoute"
      | "registerHostedMediaResolver"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerReload"
      | "registerNodeHostCommand"
      | "registerNodeInvokePolicy"
      | "registerSecurityAuditCollector"
      | "registerService"
      | "registerGatewayDiscoveryService"
      | "registerCliBackend"
      | "registerTextTransforms"
      | "registerConfigMigration"
      | "registerMigrationProvider"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerModelCatalogProvider"
      | "registerEmbeddingProvider"
      | "registerSpeechProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerMediaUnderstandingProvider"
      | "registerTranscriptSourceProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerWebFetchProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerCompactionProvider"
      | "registerAgentHarness"
      | "registerCodexAppServerExtensionFactory"
      | "registerAgentToolResultMiddleware"
      | "registerSessionExtension"
      | "enqueueNextTurnInjection"
      | "registerTrustedToolPolicy"
      | "registerToolMetadata"
      | "registerControlUiDescriptor"
      | "registerRuntimeLifecycle"
      | "registerAgentEventSubscription"
      | "emitAgentEvent"
      | "setRunContext"
      | "getRunContext"
      | "clearRunContext"
      | "registerSessionSchedulerJob"
      | "registerSessionAction"
      | "sendSessionAttachment"
      | "scheduleSessionTurn"
      | "unscheduleSessionTurnsByTag"
      | "registerDetachedTaskRuntime"
      | "registerMemoryCapability"
      | "registerMemoryPromptSection"
      | "registerMemoryPromptSupplement"
      | "registerMemoryCorpusSupplement"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: ACTAgentPluginApi["registerTool"] = () => {};
const noopRegisterHook: ACTAgentPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: ACTAgentPluginApi["registerHttpRoute"] = () => {};
const noopRegisterHostedMediaResolver: ACTAgentPluginApi["registerHostedMediaResolver"] = () => {};
const noopRegisterChannel: ACTAgentPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: ACTAgentPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: ACTAgentPluginApi["registerCli"] = () => {};
const noopRegisterReload: ACTAgentPluginApi["registerReload"] = () => {};
const noopRegisterNodeHostCommand: ACTAgentPluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterNodeInvokePolicy: ACTAgentPluginApi["registerNodeInvokePolicy"] = () => {};
const noopRegisterSecurityAuditCollector: ACTAgentPluginApi["registerSecurityAuditCollector"] =
  () => {};
const noopRegisterService: ACTAgentPluginApi["registerService"] = () => {};
const noopRegisterGatewayDiscoveryService: ACTAgentPluginApi["registerGatewayDiscoveryService"] =
  () => {};
const noopRegisterCliBackend: ACTAgentPluginApi["registerCliBackend"] = () => {};
const noopRegisterTextTransforms: ACTAgentPluginApi["registerTextTransforms"] = () => {};
const noopRegisterConfigMigration: ACTAgentPluginApi["registerConfigMigration"] = () => {};
const noopRegisterMigrationProvider: ACTAgentPluginApi["registerMigrationProvider"] = () => {};
const noopRegisterAutoEnableProbe: ACTAgentPluginApi["registerAutoEnableProbe"] = () => {};
const noopRegisterProvider: ACTAgentPluginApi["registerProvider"] = () => {};
const noopRegisterModelCatalogProvider: ACTAgentPluginApi["registerModelCatalogProvider"] =
  () => {};
const noopRegisterEmbeddingProvider: ACTAgentPluginApi["registerEmbeddingProvider"] = () => {};
const noopRegisterSpeechProvider: ACTAgentPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterRealtimeTranscriptionProvider: ACTAgentPluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: ACTAgentPluginApi["registerRealtimeVoiceProvider"] =
  () => {};
const noopRegisterMediaUnderstandingProvider: ACTAgentPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterTranscriptsSourceProvider: ACTAgentPluginApi["registerTranscriptSourceProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: ACTAgentPluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: ACTAgentPluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: ACTAgentPluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterWebFetchProvider: ACTAgentPluginApi["registerWebFetchProvider"] = () => {};
const noopRegisterWebSearchProvider: ACTAgentPluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: ACTAgentPluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: ACTAgentPluginApi["onConversationBindingResolved"] =
  () => {};
const noopRegisterCommand: ACTAgentPluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: ACTAgentPluginApi["registerContextEngine"] = () => {};
const noopRegisterCompactionProvider: ACTAgentPluginApi["registerCompactionProvider"] = () => {};
const noopRegisterAgentHarness: ACTAgentPluginApi["registerAgentHarness"] = () => {};
const noopRegisterCodexAppServerExtensionFactory: ACTAgentPluginApi["registerCodexAppServerExtensionFactory"] =
  () => {};
const noopRegisterAgentToolResultMiddleware: ACTAgentPluginApi["registerAgentToolResultMiddleware"] =
  () => {};
const noopRegisterSessionExtension: ACTAgentPluginApi["registerSessionExtension"] = () => {};
const noopEnqueueNextTurnInjection: ACTAgentPluginApi["enqueueNextTurnInjection"] = async (
  injection,
) => ({ enqueued: false, id: "", sessionKey: injection.sessionKey });
const noopRegisterTrustedToolPolicy: ACTAgentPluginApi["registerTrustedToolPolicy"] = () => {};
const noopRegisterToolMetadata: ACTAgentPluginApi["registerToolMetadata"] = () => {};
const noopRegisterControlUiDescriptor: ACTAgentPluginApi["registerControlUiDescriptor"] = () => {};
const noopRegisterRuntimeLifecycle: ACTAgentPluginApi["registerRuntimeLifecycle"] = () => {};
const noopRegisterAgentEventSubscription: ACTAgentPluginApi["registerAgentEventSubscription"] =
  () => {};
const noopEmitAgentEvent: ACTAgentPluginApi["emitAgentEvent"] = () => ({
  emitted: false,
  reason: "not wired",
});
const noopSetRunContext: ACTAgentPluginApi["setRunContext"] = () => false;
const noopGetRunContext: ACTAgentPluginApi["getRunContext"] = () => undefined;
const noopClearRunContext: ACTAgentPluginApi["clearRunContext"] = () => {};
const noopRegisterSessionSchedulerJob: ACTAgentPluginApi["registerSessionSchedulerJob"] = () =>
  undefined;
const noopRegisterSessionAction: ACTAgentPluginApi["registerSessionAction"] = () => {};
const noopSendSessionAttachment: ACTAgentPluginApi["sendSessionAttachment"] = async () => ({
  ok: false,
  error: "not wired",
});
const noopScheduleSessionTurn: ACTAgentPluginApi["scheduleSessionTurn"] = async () => undefined;
const noopUnscheduleSessionTurnsByTag: ACTAgentPluginApi["unscheduleSessionTurnsByTag"] =
  async () => ({ removed: 0, failed: 0 });
const noopRegisterDetachedTaskRuntime: ACTAgentPluginApi["registerDetachedTaskRuntime"] = () => {};
const noopRegisterMemoryCapability: ACTAgentPluginApi["registerMemoryCapability"] = () => {};
const noopRegisterMemoryPromptSection: ACTAgentPluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryPromptSupplement: ACTAgentPluginApi["registerMemoryPromptSupplement"] =
  () => {};
const noopRegisterMemoryCorpusSupplement: ACTAgentPluginApi["registerMemoryCorpusSupplement"] =
  () => {};
const noopRegisterMemoryFlushPlan: ACTAgentPluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: ACTAgentPluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: ACTAgentPluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopOn: ACTAgentPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): ACTAgentPluginApi {
  const handlers = params.handlers ?? {};
  const registerCli = handlers.registerCli ?? noopRegisterCli;
  const api: ACTAgentPluginApiWithoutFacades = {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerHostedMediaResolver:
      handlers.registerHostedMediaResolver ?? noopRegisterHostedMediaResolver,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli,
    registerNodeCliFeature: (registrar, opts) =>
      registerCli(registrar, {
        ...opts,
        parentPath: ["nodes"],
      }),
    registerReload: handlers.registerReload ?? noopRegisterReload,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerNodeInvokePolicy: handlers.registerNodeInvokePolicy ?? noopRegisterNodeInvokePolicy,
    registerSecurityAuditCollector:
      handlers.registerSecurityAuditCollector ?? noopRegisterSecurityAuditCollector,
    registerService: handlers.registerService ?? noopRegisterService,
    registerGatewayDiscoveryService:
      handlers.registerGatewayDiscoveryService ?? noopRegisterGatewayDiscoveryService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerTextTransforms: handlers.registerTextTransforms ?? noopRegisterTextTransforms,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerMigrationProvider: handlers.registerMigrationProvider ?? noopRegisterMigrationProvider,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerModelCatalogProvider:
      handlers.registerModelCatalogProvider ?? noopRegisterModelCatalogProvider,
    registerEmbeddingProvider: handlers.registerEmbeddingProvider ?? noopRegisterEmbeddingProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerTranscriptSourceProvider:
      handlers.registerTranscriptSourceProvider ?? noopRegisterTranscriptsSourceProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerWebFetchProvider: handlers.registerWebFetchProvider ?? noopRegisterWebFetchProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerCompactionProvider:
      handlers.registerCompactionProvider ?? noopRegisterCompactionProvider,
    registerAgentHarness: handlers.registerAgentHarness ?? noopRegisterAgentHarness,
    registerCodexAppServerExtensionFactory:
      handlers.registerCodexAppServerExtensionFactory ?? noopRegisterCodexAppServerExtensionFactory,
    registerAgentToolResultMiddleware:
      handlers.registerAgentToolResultMiddleware ?? noopRegisterAgentToolResultMiddleware,
    registerSessionExtension: handlers.registerSessionExtension ?? noopRegisterSessionExtension,
    enqueueNextTurnInjection: handlers.enqueueNextTurnInjection ?? noopEnqueueNextTurnInjection,
    registerTrustedToolPolicy: handlers.registerTrustedToolPolicy ?? noopRegisterTrustedToolPolicy,
    registerToolMetadata: handlers.registerToolMetadata ?? noopRegisterToolMetadata,
    registerControlUiDescriptor:
      handlers.registerControlUiDescriptor ?? noopRegisterControlUiDescriptor,
    registerRuntimeLifecycle: handlers.registerRuntimeLifecycle ?? noopRegisterRuntimeLifecycle,
    registerAgentEventSubscription:
      handlers.registerAgentEventSubscription ?? noopRegisterAgentEventSubscription,
    emitAgentEvent: handlers.emitAgentEvent ?? noopEmitAgentEvent,
    setRunContext: handlers.setRunContext ?? noopSetRunContext,
    getRunContext: handlers.getRunContext ?? noopGetRunContext,
    clearRunContext: handlers.clearRunContext ?? noopClearRunContext,
    registerSessionSchedulerJob:
      handlers.registerSessionSchedulerJob ?? noopRegisterSessionSchedulerJob,
    registerSessionAction: handlers.registerSessionAction ?? noopRegisterSessionAction,
    sendSessionAttachment: handlers.sendSessionAttachment ?? noopSendSessionAttachment,
    scheduleSessionTurn: handlers.scheduleSessionTurn ?? noopScheduleSessionTurn,
    unscheduleSessionTurnsByTag:
      handlers.unscheduleSessionTurnsByTag ?? noopUnscheduleSessionTurnsByTag,
    registerDetachedTaskRuntime:
      handlers.registerDetachedTaskRuntime ?? noopRegisterDetachedTaskRuntime,
    registerMemoryCapability: handlers.registerMemoryCapability ?? noopRegisterMemoryCapability,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryPromptSupplement:
      handlers.registerMemoryPromptSupplement ?? noopRegisterMemoryPromptSupplement,
    registerMemoryCorpusSupplement:
      handlers.registerMemoryCorpusSupplement ?? noopRegisterMemoryCorpusSupplement,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
  return attachPluginApiFacades(api);
}
