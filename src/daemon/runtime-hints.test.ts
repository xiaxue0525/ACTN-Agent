// Daemon runtime hint tests cover platform-specific daemon guidance.
import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          HOME: "/Users/test",
          ACTAGENT_STATE_DIR: "/tmp/actagent-state",
          ACTAGENT_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "actagent-gateway",
        windowsTaskName: "ACTAgent Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /Users/test/Library/Logs/actagent/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/actagent-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          ACTAGENT_STATE_DIR: "/tmp/actagent-state",
        },
        systemdServiceName: "actagent-gateway",
        windowsTaskName: "ACTAgent Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u actagent-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/actagent-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          ACTAGENT_STATE_DIR: "/tmp/actagent-state",
        },
        systemdServiceName: "actagent-gateway",
        windowsTaskName: "ACTAgent Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "ACTAgent Gateway" /V /FO LIST',
      "Restart attempts: /tmp/actagent-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "actagent gateway install",
        startCommand: "actagent gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.actagent.gateway.plist",
        systemdServiceName: "actagent-gateway",
        windowsTaskName: "ACTAgent Gateway",
      }),
    ).toEqual([
      "actagent gateway install",
      "actagent gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.actagent.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "actagent gateway install",
        startCommand: "actagent gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.actagent.gateway.plist",
        systemdServiceName: "actagent-gateway",
        windowsTaskName: "ACTAgent Gateway",
      }),
    ).toEqual([
      "actagent gateway install",
      "actagent gateway",
      "systemctl --user start actagent-gateway.service",
    ]);
  });
});
