// Matrix plugin module implements monitor route test support behavior.
export {
  registerSessionBindingAdapter,
  testing,
} from "actagent/plugin-sdk/session-binding-runtime";
export { resolveAgentRoute } from "actagent/plugin-sdk/routing";
export {
  createTestRegistry,
  setActivePluginRegistry,
} from "actagent/plugin-sdk/plugin-test-runtime";
export type { ACTAgentConfig } from "actagent/plugin-sdk/config-contracts";
