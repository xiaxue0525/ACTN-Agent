// ACTAgent root resolution imports fs through this facade so tests can replace
// filesystem behavior without mocking node:fs globally.
export { default as actAgentRootFsSync } from "node:fs";
export { default as actAgentRootFs } from "node:fs/promises";
