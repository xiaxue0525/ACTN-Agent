// Hosted plugin surface URL tests document forwarded-host/proto precedence for
// URLs exposed to plugin-hosted UI surfaces.
import { describe, expect, it } from "vitest";
import { resolveHostedPluginSurfaceUrl } from "./hosted-plugin-surface-url.js";

describe("resolveHostedPluginSurfaceUrl", () => {
  it("prefers forwarded host over request host", () => {
    expect(
      resolveHostedPluginSurfaceUrl({
        port: 19199,
        requestHost: "10.0.0.2:19199",
        forwardedHost: "gateway.example.com",
        forwardedProto: "https",
      }),
    ).toBe("https://gateway.example.com:443");
  });

  it("keeps forwarded host ports when present", () => {
    expect(
      resolveHostedPluginSurfaceUrl({
        port: 19199,
        requestHost: "10.0.0.2:19199",
        forwardedHost: "gateway.example.com:9443",
        forwardedProto: "https",
      }),
    ).toBe("https://gateway.example.com:9443");
  });
});
