/**
 * Bewacht die beiden Zusagen, auf denen die Live-Demo steht.
 *
 * 1. Die wasm-Datei im Deck ist dieselbe wie die der Abhaengigkeit. Sie liegt
 *    als Kopie unter public/, weil node_modules nicht im Repository ist und
 *    der Ladepfad ueber den Basispfad der Seite laufen muss. Eine Kopie driftet
 *    still ab, sobald jemand das Paket aktualisiert — dieser Test merkt es.
 *
 * 2. Ein Delta gegen die Basis bleibt klein, und die Stufe entscheidet darueber.
 *    Sollte eine neue zstd-Version das Verhalten aendern, faellt der Test auf
 *    und die Zahlen auf der Folie werden nachgemessen, statt still falsch zu
 *    werden.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  compress,
  compressUsingDict,
  createCCtx,
  createDCtx,
  decompressUsingDict,
  init,
} from "@bokuweb/zstd-wasm";
import {
  DEMO_BASE_BYTES,
  SAFE_LEVEL,
  TRAP_LEVEL,
  windowLogFor,
} from "../zstdRuntime";
import { makeBase, mutate, naivePageDiffBytes } from "../syntheticDb";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

describe("wasm-Datei im Deck", () => {
  it("ist byteidentisch mit der aus node_modules", () => {
    const shipped = readFileSync(resolve(here, "../../../public/zstd.wasm"));
    const installed = readFileSync(
      resolve(repoRoot, "node_modules/@bokuweb/zstd-wasm/dist/web/zstd.wasm"),
    );
    expect(sha256(shipped)).toBe(sha256(installed));
  });
});

describe("Praefix-Delta", () => {
  let base: Uint8Array;
  let target: Uint8Array;
  let cctx = 0;

  beforeAll(async () => {
    await init();
    cctx = createCCtx();
    base = makeBase(DEMO_BASE_BYTES);
    target = mutate(base, { changedPages: 12, appendKib: 48 }).target;
  }, 60_000);

  it("ist deutlich kleiner als das ganze komprimierte Ziel", () => {
    const delta = compressUsingDict(cctx, target, base, SAFE_LEVEL);
    const whole = compress(target, SAFE_LEVEL);
    expect(delta.length * 10).toBeLessThan(whole.length);
  });

  it("ist kleiner als ein naives Seiten-Diff", () => {
    const delta = compressUsingDict(cctx, target, base, SAFE_LEVEL);
    expect(delta.length).toBeLessThan(naivePageDiffBytes(base, target));
  });

  it("waechst mit den geaenderten Seiten", () => {
    const sizes = [4, 32, 160].map((pages) => {
      const mutated = mutate(base, {
        changedPages: pages,
        appendKib: 48,
      }).target;
      return compressUsingDict(cctx, mutated, base, SAFE_LEVEL).length;
    });
    expect(sizes[0]).toBeLessThan(sizes[1]);
    expect(sizes[1]).toBeLessThan(sizes[2]);
  });

  it("laesst sich byteidentisch zurueckrechnen", () => {
    const delta = compressUsingDict(cctx, target, base, SAFE_LEVEL);
    const restored = decompressUsingDict(createDCtx(), delta, base, {
      defaultHeapSize: 64 * 1024 * 1024,
    });
    expect(sha256(restored)).toBe(sha256(target));
  });

  it("faellt auf einer zu niedrigen Stufe in sich zusammen - die Pointe der Folie", () => {
    const gut = compressUsingDict(cctx, target, base, SAFE_LEVEL).length;
    const falle = compressUsingDict(cctx, target, base, TRAP_LEVEL).length;
    expect(falle).toBeGreaterThan(gut * 5);
  });
});

describe("windowLogFor", () => {
  it("deckt die Datei ab, wie die Kommandozeile es waehlt", () => {
    expect(windowLogFor(1_000_000)).toBe(20);
    expect(2 ** windowLogFor(1_000_000)).toBeGreaterThan(1_000_000);
    expect(2 ** windowLogFor(DEMO_BASE_BYTES)).toBeGreaterThan(DEMO_BASE_BYTES);
  });

  it("faellt nie unter das kleinste zstd-Fenster", () => {
    expect(windowLogFor(1)).toBe(10);
  });
});
