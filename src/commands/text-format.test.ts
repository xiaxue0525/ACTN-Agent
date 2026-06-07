// Text format tests cover command-facing shortening helpers.
import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("actagent", 16)).toBe("actagent");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("actagent-status-output", 10)).toBe("actagent-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
