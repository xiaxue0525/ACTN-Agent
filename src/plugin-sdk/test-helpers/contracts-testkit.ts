/**
 * Core plugin SDK contract-test fixture builders and registration helpers.
 */
import type { PluginRegistryParams } from "../../plugins/registry-types.js";
import type { ACTAgentPluginApi } from "../plugin-entry.js";
import {
  createPluginRecord,
  createPluginRegistry,
  registerProviderPlugins as registerProviders,
  requireRegisteredProvider as requireProvider,
  type ACTAgentConfig,
  type PluginRecord,
  type PluginRuntime,
} from "../testing.js";
export { assertNoImportTimeSideEffects } from "./import-side-effects.js";
import { uniqueSortedStrings } from "./string-utils.js";

export { registerProviders, requireProvider, uniqueSortedStrings };

/** Creates a minimal plugin registry fixture with quiet logger defaults. */
export function createPluginRegistryFixture(
  config = {} as ACTAgentConfig,
  params: { hostServices?: PluginRegistryParams["hostServices"] } = {},
) {
  return {
    config,
    registry: createPluginRegistry({
      logger: {
        info() {},
        warn() {},
        error() {},
        debug() {},
      },
      runtime: {} as PluginRuntime,
      ...(params.hostServices ? { hostServices: params.hostServices } : {}),
    }),
  };
}

/** Registers one plugin record against a registry fixture and invokes its register hook. */
export function registerTestPlugin(params: {
  registry: ReturnType<typeof createPluginRegistry>;
  config: ACTAgentConfig;
  record: PluginRecord;
  register(api: ACTAgentPluginApi): void;
}) {
  params.registry.registry.plugins.push(params.record);
  params.register(
    params.registry.createApi(params.record, {
      config: params.config,
    }),
  );
}

/** Registers a virtual plugin record for tests that do not need a real package path. */
export function registerVirtualTestPlugin(params: {
  registry: ReturnType<typeof createPluginRegistry>;
  config: ACTAgentConfig;
  id: string;
  name: string;
  source?: string;
  kind?: PluginRecord["kind"];
  contracts?: PluginRecord["contracts"];
  register(this: void, api: ACTAgentPluginApi): void;
}) {
  registerTestPlugin({
    registry: params.registry,
    config: params.config,
    record: createPluginRecord({
      id: params.id,
      name: params.name,
      source: params.source ?? `/virtual/${params.id}/index.ts`,
      ...(params.kind ? { kind: params.kind } : {}),
      ...(params.contracts ? { contracts: params.contracts } : {}),
    }),
    register: params.register,
  });
}
