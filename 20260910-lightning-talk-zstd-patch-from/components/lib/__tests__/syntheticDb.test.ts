import { describe, expect, it } from "vitest";
import {
  PAGE_BYTES,
  PAGE_HEADER_BYTES,
  makeBase,
  mulberry32,
  mutate,
  naivePageDiffBytes,
} from "../syntheticDb";

const KIB = 1024;

describe("mulberry32", () => {
  it("liefert zum selben Startwert dieselbe Folge", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const first = [a(), a(), a()];
    const second = [b(), b(), b()];
    expect(first).toEqual(second);
  });

  it("liefert zu verschiedenen Startwerten verschiedene Folgen", () => {
    expect(mulberry32(7)()).not.toEqual(mulberry32(8)());
  });

  it("bleibt zwischen null und eins", () => {
    const rnd = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const value = rnd();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("makeBase", () => {
  it("erzeugt eine ganze Zahl von Seiten", () => {
    const base = makeBase(100 * KIB);
    expect(base.length % PAGE_BYTES).toBe(0);
    expect(base.length).toBe(25 * PAGE_BYTES);
  });

  it("ist bei gleichem Startwert byteidentisch", () => {
    expect(makeBase(64 * KIB, 5)).toEqual(makeBase(64 * KIB, 5));
  });

  it("unterscheidet sich bei anderem Startwert", () => {
    expect(makeBase(64 * KIB, 5)).not.toEqual(makeBase(64 * KIB, 6));
  });

  it("fuellt jede Seite - keine Seite bleibt leer", () => {
    const base = makeBase(64 * KIB);
    for (let page = 0; page < base.length / PAGE_BYTES; page++) {
      const slice = base.subarray(page * PAGE_BYTES, (page + 1) * PAGE_BYTES);
      expect(slice.some((byte) => byte !== 0)).toBe(true);
    }
  });
});

describe("mutate", () => {
  const base = makeBase(256 * KIB);

  it("haengt auf ganze Seiten aufgerundet an", () => {
    const { target, appendedBytes } = mutate(base, {
      changedPages: 0,
      appendKib: 5,
    });
    expect(appendedBytes).toBe(2 * PAGE_BYTES);
    expect(target.length).toBe(base.length + 2 * PAGE_BYTES);
  });

  it("aendert genau so viele Seiten wie verlangt", () => {
    const { target, changedPages } = mutate(base, {
      changedPages: 7,
      appendKib: 0,
    });
    expect(changedPages).toBe(7);
    expect(naivePageDiffBytes(base, target)).toBe(
      7 * (PAGE_BYTES + PAGE_HEADER_BYTES),
    );
  });

  it("laesst die uebrigen Seiten unangetastet", () => {
    const { target } = mutate(base, { changedPages: 3, appendKib: 0 });
    let identicalPages = 0;
    for (let page = 0; page < base.length / PAGE_BYTES; page++) {
      const a = base.subarray(page * PAGE_BYTES, (page + 1) * PAGE_BYTES);
      const b = target.subarray(page * PAGE_BYTES, (page + 1) * PAGE_BYTES);
      if (a.every((byte, i) => byte === b[i])) identicalPages++;
    }
    expect(identicalPages).toBe(base.length / PAGE_BYTES - 3);
  });

  it("verlangt nie mehr Seiten, als die Basis hat", () => {
    const { changedPages } = mutate(base, {
      changedPages: 10_000,
      appendKib: 0,
    });
    expect(changedPages).toBe(base.length / PAGE_BYTES);
  });

  it("ist bei gleichem Startwert wiederholbar", () => {
    const first = mutate(base, { changedPages: 4, appendKib: 8, seed: 99 });
    const second = mutate(base, { changedPages: 4, appendKib: 8, seed: 99 });
    expect(first.target).toEqual(second.target);
  });

  it("ohne Aenderung und ohne Anhang bleibt das Ziel die Basis", () => {
    const { target } = mutate(base, { changedPages: 0, appendKib: 0 });
    expect(target).toEqual(base);
  });
});

describe("naivePageDiffBytes", () => {
  it("zaehlt angehaengte Seiten mit", () => {
    const base = makeBase(64 * KIB);
    const { target } = mutate(base, { changedPages: 0, appendKib: 16 });
    expect(naivePageDiffBytes(base, target)).toBe(
      4 * (PAGE_BYTES + PAGE_HEADER_BYTES),
    );
  });

  it("ist null, wenn nichts passiert ist", () => {
    const base = makeBase(64 * KIB);
    expect(naivePageDiffBytes(base, base)).toBe(0);
  });

  it("waechst linear mit den geaenderten Seiten - die Aussage der Demo-Folie", () => {
    const base = makeBase(512 * KIB);
    const sizes = [1, 2, 4, 8].map((pages) =>
      naivePageDiffBytes(
        base,
        mutate(base, { changedPages: pages, appendKib: 0 }).target,
      ),
    );
    expect(sizes).toEqual(
      [1, 2, 4, 8].map((pages) => pages * (PAGE_BYTES + PAGE_HEADER_BYTES)),
    );
  });
});
