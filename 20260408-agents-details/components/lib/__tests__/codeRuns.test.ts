import { describe, expect, it } from "vitest";
import { sliceRuns, toRuns } from "../codeRuns";

const code = "int a;\nreturn a;";
const lines = [
  [
    { content: "int", offset: 0, htmlStyle: { "--shiki-light": "#111" } },
    { content: " a;", offset: 3 },
  ],
  [
    {
      content: "return",
      offset: 7,
      htmlStyle: "--shiki-light:#222;--shiki-dark:#eee",
    },
    { content: " a;", offset: 13 },
  ],
];

describe("toRuns", () => {
  it("covers the whole text, filling the newline gap", () => {
    const runs = toRuns(code, lines);
    expect(runs.map((r) => r.text).join("")).toBe(code);
    expect(runs[2]).toEqual({ text: "\n" });
  });
  it("parses string styles", () => {
    expect(toRuns(code, lines)[3]!.style).toEqual({
      "--shiki-light": "#222",
      "--shiki-dark": "#eee",
    });
  });
  it("falls back to plain text for mismatching tokens", () => {
    const runs = toRuns("ab", [[{ content: "zzzzz", offset: 0 }]]);
    expect(runs).toEqual([{ text: "ab" }]);
  });
});

describe("sliceRuns", () => {
  const runs = toRuns(code, lines);
  it("cuts inside a token and keeps its style", () => {
    const s = sliceRuns(runs, 1, 5);
    expect(s.map((r) => r.text).join("")).toBe("nt a");
    expect(s[0]!.style).toEqual({ "--shiki-light": "#111" });
  });
  it("concatenated slices at any cut points rebuild the text", () => {
    const cuts = [0, 4, 7, 9, code.length];
    const joined = cuts
      .slice(1)
      .flatMap((c, i) => sliceRuns(runs, cuts[i]!, c))
      .map((r) => r.text)
      .join("");
    expect(joined).toBe(code);
  });
  it("returns nothing for an empty range", () => {
    expect(sliceRuns(runs, 3, 3)).toEqual([]);
  });
});
