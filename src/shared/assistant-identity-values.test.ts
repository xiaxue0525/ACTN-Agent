// Assistant identity tests cover normalized assistant names and metadata values.
import { describe, expect, it } from "vitest";
import { coerceIdentityValue } from "./assistant-identity-values.js";

describe("shared/assistant-identity-values", () => {
  it("returns undefined for missing or blank values", () => {
    expect(coerceIdentityValue(undefined, 10)).toBeUndefined();
    expect(coerceIdentityValue("   ", 10)).toBeUndefined();
    expect(coerceIdentityValue(42 as unknown as string, 10)).toBeUndefined();
  });

  it("trims values and preserves strings within the limit", () => {
    expect(coerceIdentityValue("  ACTAgent  ", 20)).toBe("ACTAgent");
    expect(coerceIdentityValue("  ACTAgent  ", 8)).toBe("ACTAgent");
  });

  it("truncates overlong trimmed values at the exact limit", () => {
    expect(coerceIdentityValue("  ACTAgent Assistant  ", 8)).toBe("ACTAgent");
  });

  it("returns an empty string when truncating to a zero-length limit", () => {
    expect(coerceIdentityValue("  ACTAgent  ", 0)).toBe("");
    expect(coerceIdentityValue("  ACTAgent  ", -1)).toBe("OpenCla");
  });
});
