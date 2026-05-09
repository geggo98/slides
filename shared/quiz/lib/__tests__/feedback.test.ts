import { describe, expect, it } from "vitest";
import { PILL_WORDING, classify } from "../feedback";

describe("classify", () => {
  it("hits when verdict=true and checked", () => {
    expect(classify("true", true)).toBe("hit");
  });
  it("misses when verdict=true and not checked", () => {
    expect(classify("true", false)).toBe("missed");
  });
  it("wrongPick when verdict=false and checked", () => {
    expect(classify("false", true)).toBe("wrongPick");
  });
  it("correctOmit when verdict=false and not checked", () => {
    expect(classify("false", false)).toBe("correctOmit");
  });
  it("depends regardless of pick", () => {
    expect(classify("depends", true)).toBe("depends");
    expect(classify("depends", false)).toBe("depends");
  });
});

describe("PILL_WORDING", () => {
  it("covers all 5 states with two-part wording + icon", () => {
    for (const state of [
      "hit",
      "correctOmit",
      "wrongPick",
      "missed",
      "depends",
    ] as const) {
      const p = PILL_WORDING[state];
      expect(p.result).toBeTruthy();
      expect(p.truth).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.cssClass).toMatch(/^fb-/);
    }
  });

  it("uses ⚖ for depends and ✗ for wrongPick", () => {
    expect(PILL_WORDING.depends.icon).toBe("⚖");
    expect(PILL_WORDING.wrongPick.icon).toBe("✗");
  });
});
