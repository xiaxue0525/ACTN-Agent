/** Process env key that marks child commands as launched by the ACTAgent CLI. */
export const ACTAGENT_CLI_ENV_VAR = "ACTAGENT_CLI";

/** Stable marker value used for ACTAgent-launched subprocess detection. */
export const ACTAGENT_CLI_ENV_VALUE = "1";

/** Returns a cloned env object with the ACTAgent CLI marker set. */
export function markACTAgentExecEnv<T extends Record<string, string | undefined>>(
  /** Source environment to clone before adding the subprocess marker. */
  env: T,
): T {
  return {
    ...env,
    [ACTAGENT_CLI_ENV_VAR]: ACTAGENT_CLI_ENV_VALUE,
  };
}

/** Mutates an existing process env object so current-process children inherit the marker. */
export function ensureACTAgentExecMarkerOnProcess(
  /** Process env object to mutate; defaults to the current process environment. */
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[ACTAGENT_CLI_ENV_VAR] = ACTAGENT_CLI_ENV_VALUE;
  return env;
}
