import { describe, expect, it } from "vitest";
import { deltaWording, tierFor } from "../scoring";

describe("tierFor — boundaries", () => {
  it("Anfang below 25", () => {
    expect(tierFor(0)).toBe("Anfang");
    expect(tierFor(24.99)).toBe("Anfang");
  });
  it("Lücken from 25", () => {
    expect(tierFor(25)).toBe("Lücken");
    expect(tierFor(49.99)).toBe("Lücken");
  });
  it("Mitte from 50", () => {
    expect(tierFor(50)).toBe("Mitte");
    expect(tierFor(74.99)).toBe("Mitte");
  });
  it("Solide from 75", () => {
    expect(tierFor(75)).toBe("Solide");
    expect(tierFor(89.99)).toBe("Solide");
  });
  it("Stark from 90", () => {
    expect(tierFor(90)).toBe("Stark");
    expect(tierFor(99.99)).toBe("Stark");
  });
  it("Top at 100", () => {
    expect(tierFor(100)).toBe("Top");
  });
});

describe("deltaWording — bands", () => {
  it("strong-up at +20 and beyond", () => {
    expect(deltaWording(20).tone).toBe("strong-up");
    expect(deltaWording(40).tone).toBe("strong-up");
  });
  it("up between +5 and +19", () => {
    expect(deltaWording(5).tone).toBe("up");
    expect(deltaWording(19).tone).toBe("up");
  });
  it("flat between -4 and +4", () => {
    expect(deltaWording(0).tone).toBe("flat");
    expect(deltaWording(4).tone).toBe("flat");
    expect(deltaWording(-4).tone).toBe("flat");
  });
  it("down between -19 and -5", () => {
    expect(deltaWording(-5).tone).toBe("down");
    expect(deltaWording(-19).tone).toBe("down");
  });
  it("strong-down at -20 and below", () => {
    expect(deltaWording(-20).tone).toBe("strong-down");
    expect(deltaWording(-40).tone).toBe("strong-down");
  });
  it("includes the PP value with a sign", () => {
    expect(deltaWording(12).text).toContain("+12 PP");
    expect(deltaWording(-12).text).toContain("-12 PP");
    expect(deltaWording(0).text).toContain("0 PP");
  });
});
