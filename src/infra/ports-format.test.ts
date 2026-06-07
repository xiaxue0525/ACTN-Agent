// Covers gateway port listener classification and diagnostics text.
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "../cli/command-format.js";
import {
  buildPortHints,
  classifyPortListener,
  formatPortDiagnostics,
  formatPortListener,
  isDualStackLoopbackGatewayListeners,
  isExpectedGatewayListeners,
  isSingleExpectedGatewayListener,
} from "./ports-format.js";

const gatewayAlreadyRunningHint = `Gateway already running locally. Stop it (${formatCliCommand("actagent gateway stop")}) or use a different port.`;
const multipleListenersHint =
  "Multiple listeners detected; ensure only one gateway/tunnel per port unless intentionally running isolated profiles.";

describe("ports-format", () => {
  it.each([
    [{ commandLine: "ssh -N -L 19199:127.0.0.1:19199 user@host" }, "ssh"],
    [{ command: "ssh" }, "ssh"],
    [{ commandLine: "node /Users/me/Projects/actagent/dist/entry.js gateway" }, "gateway"],
    [{ commandLine: "python -m http.server 19199" }, "unknown"],
  ] as const)("classifies port listener %j", (listener, expected) => {
    expect(classifyPortListener(listener, 19199)).toBe(expected);
  });

  it("builds ordered hints for mixed listener kinds and multiplicity", () => {
    expect(
      buildPortHints(
        [
          { commandLine: "node dist/index.js actagent gateway" },
          { commandLine: "ssh -N -L 19199:127.0.0.1:19199" },
          { commandLine: "python -m http.server 19199" },
        ],
        19199,
      ),
    ).toEqual([
      gatewayAlreadyRunningHint,
      "SSH tunnel already bound to this port. Close the tunnel or use a different local port in -L.",
      "Another process is listening on this port.",
      multipleListenersHint,
    ]);
    expect(buildPortHints([], 19199)).toStrictEqual([]);
  });

  it("treats single-process loopback dual-stack gateway listeners as benign", () => {
    const listeners = [
      { pid: 4242, commandLine: "actagent-gateway", address: "127.0.0.1:19199" },
      { pid: 4242, commandLine: "actagent-gateway", address: "[::1]:19199" },
    ];
    expect(isDualStackLoopbackGatewayListeners(listeners, 19199)).toBe(true);
    expect(isExpectedGatewayListeners(listeners, 19199)).toBe(true);
    expect(buildPortHints(listeners, 19199)).toEqual([]);
  });

  it.each([
    "127.0.0.1:19199",
    "[::1]:19199",
    "localhost:19199",
    "0.0.0.0:19199",
    "[::]:19199",
    "*:19199",
  ])("treats a single expected Gateway listener on %s as benign", (address) => {
    const listeners = [{ pid: 4242, commandLine: "actagent-gateway", address }];

    expect(isSingleExpectedGatewayListener(listeners, 19199)).toBe(true);
    expect(isExpectedGatewayListeners(listeners, 19199)).toBe(true);
    expect(buildPortHints(listeners, 19199)).toEqual([]);
  });

  it("keeps Gateway conflict hints for ambiguous Gateway listeners", () => {
    expect(
      buildPortHints(
        [
          { pid: 4242, commandLine: "actagent-gateway", address: "0.0.0.0:19199" },
          { pid: 4243, commandLine: "actagent-gateway", address: "127.0.0.1:19199" },
        ],
        19199,
      ),
    ).toEqual([gatewayAlreadyRunningHint, multipleListenersHint]);
  });

  it.each([
    [
      { pid: 123, user: "alice", commandLine: "ssh -N", address: "::1" },
      "pid 123 alice: ssh -N (::1)",
    ],
    [{ command: "ssh", address: "127.0.0.1:19199" }, "pid ?: ssh (127.0.0.1:19199)"],
    [{}, "pid ?: unknown"],
  ] as const)("formats port listener %j", (listener, expected) => {
    expect(formatPortListener(listener)).toBe(expected);
  });

  it("formats free and busy port diagnostics", () => {
    expect(
      formatPortDiagnostics({
        port: 19199,
        status: "free",
        listeners: [],
        hints: [],
      }),
    ).toEqual(["Port 19199 is free."]);

    const lines = formatPortDiagnostics({
      port: 19199,
      status: "busy",
      listeners: [{ pid: 123, user: "alice", commandLine: "ssh -N -L 19199:127.0.0.1:19199" }],
      hints: buildPortHints([{ pid: 123, commandLine: "ssh -N -L 19199:127.0.0.1:19199" }], 19199),
    });
    expect(lines[0]).toContain("Port 19199 is already in use");
    expect(lines).toContain("- pid 123 alice: ssh -N -L 19199:127.0.0.1:19199");
    const sshTunnelHints = lines.filter((line) => line.includes("SSH tunnel"));
    expect(sshTunnelHints.length).toBeGreaterThan(0);
  });
});
