// Argv tests cover CLI argument parsing helpers and platform-specific normalization.
import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getCommandPositionalsWithRootOptions,
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  isHelpOrVersionInvocation,
  isRootHelpInvocation,
  isRootVersionInvocation,
  normalizeGeneratedHelpCommandArgv,
  normalizeRootHelpTargetArgv,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "actagent", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "actagent", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "actagent", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "actagent", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "actagent", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "actagent", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "actagent", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "actagent", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "actagent", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "known command group help command help flag",
      argv: ["node", "actagent", "backup", "help", "--help"],
      expected: ["node", "actagent", "backup", "help"],
    },
    {
      name: "known command group help command short help flag",
      argv: ["node", "actagent", "--profile", "work", "backup", "help", "-h"],
      expected: ["node", "actagent", "--profile", "work", "backup", "help"],
    },
    {
      name: "leaf positional help remains untouched",
      argv: ["node", "actagent", "docs", "help", "--help"],
      expected: ["node", "actagent", "docs", "help", "--help"],
    },
    {
      name: "known command group help target",
      argv: ["node", "actagent", "plugins", "help", "list"],
      expected: ["node", "actagent", "plugins", "list", "--help"],
    },
    {
      name: "known command group help target help flag",
      argv: ["node", "actagent", "plugins", "help", "list", "--help"],
      expected: ["node", "actagent", "plugins", "list", "--help"],
    },
    {
      name: "unknown plugin command group help target",
      argv: ["node", "actagent", "external-plugin", "help", "inspect"],
      expected: ["node", "actagent", "external-plugin", "inspect", "--help"],
    },
    {
      name: "unknown plugin command group help target help flag",
      argv: ["node", "actagent", "external-plugin", "help", "inspect", "--help"],
      expected: ["node", "actagent", "external-plugin", "inspect", "--help"],
    },
    {
      name: "generated help target with trailing root option",
      argv: ["node", "actagent", "memory", "help", "status", "--no-color"],
      expected: ["node", "actagent", "--no-color", "memory", "status", "--help"],
    },
    {
      name: "extra help positionals remain untouched",
      argv: ["node", "actagent", "backup", "help", "missing", "extra", "--help"],
      expected: ["node", "actagent", "backup", "help", "missing", "extra", "--help"],
    },
    {
      name: "terminator help flag remains untouched",
      argv: ["node", "actagent", "backup", "help", "--", "--help"],
      expected: ["node", "actagent", "backup", "help", "--", "--help"],
    },
  ])("normalizes generated help commands: $name", ({ argv, expected }) => {
    expect(normalizeGeneratedHelpCommandArgv(argv)).toEqual(expected);
  });

  it.each([
    {
      name: "root help target",
      argv: ["node", "actagent", "help", "plugins"],
      expected: ["node", "actagent", "plugins", "--help"],
    },
    {
      name: "root help target with help flag",
      argv: ["node", "actagent", "help", "plugins", "--help"],
      expected: ["node", "actagent", "plugins", "--help"],
    },
    {
      name: "root option before help target",
      argv: ["node", "actagent", "--profile", "work", "help", "memory"],
      expected: ["node", "actagent", "--profile", "work", "memory", "--help"],
    },
    {
      name: "bare root help remains untouched",
      argv: ["node", "actagent", "help"],
      expected: ["node", "actagent", "help"],
    },
    {
      name: "root help self-help remains untouched",
      argv: ["node", "actagent", "help", "--help"],
      expected: ["node", "actagent", "help", "--help"],
    },
    {
      name: "nested root help target",
      argv: ["node", "actagent", "help", "plugins", "list"],
      expected: ["node", "actagent", "plugins", "list", "--help"],
    },
    {
      name: "nested root help target with help flag",
      argv: ["node", "actagent", "help", "plugins", "list", "--help"],
      expected: ["node", "actagent", "plugins", "list", "--help"],
    },
    {
      name: "nested root help target with trailing root option",
      argv: ["node", "actagent", "help", "memory", "status", "--no-color"],
      expected: ["node", "actagent", "--no-color", "memory", "status", "--help"],
    },
  ])("normalizes root help targets: $name", ({ argv, expected }) => {
    expect(normalizeRootHelpTargetArgv(argv)).toEqual(expected);
  });

  it.each([
    {
      name: "root help command",
      argv: ["node", "actagent", "help"],
      expected: true,
    },
    {
      name: "root help command with target",
      argv: ["node", "actagent", "help", "matrix"],
      expected: true,
    },
    {
      name: "nested help command",
      argv: ["node", "actagent", "matrix", "encryption", "help"],
      expected: true,
    },
    {
      name: "known subcommand root help command",
      argv: ["node", "actagent", "config", "help"],
      expected: true,
    },
    {
      name: "known leaf command positional help",
      argv: ["node", "actagent", "docs", "help"],
      expected: false,
    },
    {
      name: "known subcommand leaf positional help",
      argv: ["node", "actagent", "config", "set", "some.path", "help"],
      expected: false,
    },
    {
      name: "unknown plugin command help",
      argv: ["node", "actagent", "external-plugin", "tools", "help"],
      expected: true,
    },
    {
      name: "help flag",
      argv: ["node", "actagent", "matrix", "encryption", "--help"],
      expected: true,
    },
    {
      name: "help as option value",
      argv: ["node", "actagent", "agent", "--message", "help"],
      expected: false,
    },
    {
      name: "help after terminator",
      argv: ["node", "actagent", "nodes", "invoke", "--", "help"],
      expected: false,
    },
    {
      name: "help flag after terminator",
      argv: ["node", "actagent", "nodes", "invoke", "--", "--help"],
      expected: false,
    },
    {
      name: "version flag after terminator",
      argv: ["node", "actagent", "nodes", "invoke", "--", "--version"],
      expected: false,
    },
  ])("detects help/version invocations: $name", ({ argv, expected }) => {
    expect(isHelpOrVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --version",
      argv: ["node", "actagent", "--version"],
      expected: true,
    },
    {
      name: "root -V",
      argv: ["node", "actagent", "-V"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "actagent", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "subcommand version flag",
      argv: ["node", "actagent", "status", "--version"],
      expected: false,
    },
    {
      name: "unknown root flag with version",
      argv: ["node", "actagent", "--unknown", "--version"],
      expected: false,
    },
  ])("detects root-only version invocations: $name", ({ argv, expected }) => {
    expect(isRootVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --help",
      argv: ["node", "actagent", "--help"],
      expected: true,
    },
    {
      name: "root -h",
      argv: ["node", "actagent", "-h"],
      expected: true,
    },
    {
      name: "root --help with profile",
      argv: ["node", "actagent", "--profile", "work", "--help"],
      expected: true,
    },
    {
      name: "subcommand --help",
      argv: ["node", "actagent", "status", "--help"],
      expected: false,
    },
    {
      name: "help before subcommand token",
      argv: ["node", "actagent", "--help", "status"],
      expected: false,
    },
    {
      name: "help after -- terminator",
      argv: ["node", "actagent", "nodes", "invoke", "--", "device.status", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag before help",
      argv: ["node", "actagent", "--unknown", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag after help",
      argv: ["node", "actagent", "--help", "--unknown"],
      expected: false,
    },
  ])("detects root-only help invocations: $name", ({ argv, expected }) => {
    expect(isRootHelpInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "actagent", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "actagent", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "actagent", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it("extracts command path while skipping known root option values", () => {
    expect(
      getCommandPathWithRootOptions(
        [
          "node",
          "actagent",
          "--profile",
          "work",
          "--container",
          "demo",
          "--no-color",
          "config",
          "validate",
        ],
        2,
      ),
    ).toEqual(["config", "validate"]);
  });

  it("extracts routed config get positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "actagent", "config", "get", "--log-level", "debug", "update.channel", "--json"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("extracts routed config unset positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "actagent", "config", "unset", "--profile", "work", "update.channel"],
        {
          commandPath: ["config", "unset"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("returns null when routed command sees unknown options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "actagent", "config", "get", "--mystery", "value", "update.channel"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toBeNull();
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "actagent", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "actagent"],
      expected: null,
    },
    {
      name: "skips known root option values",
      argv: ["node", "actagent", "--log-level", "debug", "status"],
      expected: "status",
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "actagent", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "actagent", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "actagent", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "actagent", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "actagent", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "actagent", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "actagent", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "actagent", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "actagent", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "actagent", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "actagent", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "actagent", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "actagent", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "valid signed decimal positive integer",
      argv: ["node", "actagent", "status", "--timeout", "+5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "actagent", "status", "--timeout", "nope"],
      expected: undefined,
    },
    {
      name: "non-decimal integer",
      argv: ["node", "actagent", "status", "--timeout", "0x10"],
      expected: undefined,
    },
    {
      name: "partial integer",
      argv: ["node", "actagent", "status", "--timeout", "5s"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it.each([
    {
      name: "keeps plain node argv",
      rawArgs: ["node", "actagent", "status"],
      expected: ["node", "actagent", "status"],
    },
    {
      name: "keeps version-suffixed node binary",
      rawArgs: ["node-22", "actagent", "status"],
      expected: ["node-22", "actagent", "status"],
    },
    {
      name: "keeps windows versioned node exe",
      rawArgs: ["node-22.2.0.exe", "actagent", "status"],
      expected: ["node-22.2.0.exe", "actagent", "status"],
    },
    {
      name: "keeps dotted node binary",
      rawArgs: ["node-22.2", "actagent", "status"],
      expected: ["node-22.2", "actagent", "status"],
    },
    {
      name: "keeps dotted node exe",
      rawArgs: ["node-22.2.exe", "actagent", "status"],
      expected: ["node-22.2.exe", "actagent", "status"],
    },
    {
      name: "keeps absolute versioned node path",
      rawArgs: ["/usr/bin/node-22.2.0", "actagent", "status"],
      expected: ["/usr/bin/node-22.2.0", "actagent", "status"],
    },
    {
      name: "keeps node24 shorthand",
      rawArgs: ["node24", "actagent", "status"],
      expected: ["node24", "actagent", "status"],
    },
    {
      name: "keeps absolute node24 shorthand",
      rawArgs: ["/usr/bin/node24", "actagent", "status"],
      expected: ["/usr/bin/node24", "actagent", "status"],
    },
    {
      name: "keeps windows node24 exe",
      rawArgs: ["node24.exe", "actagent", "status"],
      expected: ["node24.exe", "actagent", "status"],
    },
    {
      name: "keeps nodejs binary",
      rawArgs: ["nodejs", "actagent", "status"],
      expected: ["nodejs", "actagent", "status"],
    },
    {
      name: "prefixes fallback when first arg is not a node launcher",
      rawArgs: ["node-dev", "actagent", "status"],
      expected: ["node", "actagent", "node-dev", "actagent", "status"],
    },
    {
      name: "prefixes fallback when raw args start at program name",
      rawArgs: ["actagent", "status"],
      expected: ["node", "actagent", "status"],
    },
    {
      name: "keeps bun execution argv",
      rawArgs: ["bun", "src/entry.ts", "status"],
      expected: ["bun", "src/entry.ts", "status"],
    },
  ] as const)("builds parse argv from raw args: $name", ({ rawArgs, expected }) => {
    const parsed = buildParseArgv({
      programName: "actagent",
      rawArgs: [...rawArgs],
    });
    expect(parsed).toEqual([...expected]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "actagent",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "actagent", "status"]);
  });

  it.each([
    { argv: ["node", "actagent", "status"], expected: true },
    { argv: ["node", "actagent", "health"], expected: false },
    { argv: ["node", "actagent", "sessions"], expected: false },
    { argv: ["node", "actagent", "--profile", "work", "status"], expected: true },
    { argv: ["node", "actagent", "--log-level=debug", "models", "list"], expected: true },
    { argv: ["node", "actagent", "config", "get", "update"], expected: false },
    { argv: ["node", "actagent", "config", "unset", "update"], expected: false },
    { argv: ["node", "actagent", "models", "list"], expected: true },
    { argv: ["node", "actagent", "models", "status"], expected: true },
    { argv: ["node", "actagent", "update", "status", "--json"], expected: false },
    { argv: ["node", "actagent", "agent", "--message", "hi"], expected: true },
    { argv: ["node", "actagent", "agents", "list"], expected: true },
    { argv: ["node", "actagent", "message", "send"], expected: true },
  ] as const)("decides when to migrate state: $argv", ({ argv, expected }) => {
    expect(shouldMigrateState([...argv])).toBe(expected);
  });

  it.each([
    { path: ["status"], expected: true },
    { path: ["update", "status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["agent"], expected: true },
    { path: ["models", "status"], expected: true },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
