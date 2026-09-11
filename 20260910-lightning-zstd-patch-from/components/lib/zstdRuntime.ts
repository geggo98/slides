/**
 * zstd im Browser, so wie die Demo es braucht: ein Delta gegen eine Basis,
 * das die gewöhnliche zstd-Kommandozeile lesen kann.
 *
 * Das Paket `@bokuweb/zstd-wasm` bindet libzstd 1.5.6 als WebAssembly ein und
 * exportiert `ZSTD_compress_usingDict` und `ZSTD_decompress_usingDict`. Ein
 * Wörterbuch ohne Wörterbuch-Kennung ist ein Präfix, und genau das macht
 * `zstd --patch-from`. Beides wurde am 10.09.2026 gegen die CLI 1.5.7 geprüft,
 * in beide Richtungen: die CLI liest das Delta aus dem Browser, und der Browser
 * liest das Delta der CLI. Das Ergebnis war jedes Mal byteidentisch zum Ziel.
 *
 * ZWEI REGELN, beide gemessen, beide nicht offensichtlich.
 *
 * 1. GENAU EIN KONTEXT, WIEDERVERWENDET.
 *    `createCCtx()` je Aufruf und ohne `freeCCtx()` kostet rund 10 MiB pro
 *    Aufruf, die nie zurückkommen: gemessen 121 MiB nach dem Start, 1159 MiB
 *    nach hundert Aufrufen. Ein Schieberegler löst hunderte Aufrufe aus. Ein
 *    einziger wiederverwendeter Kontext bleibt flach und ist zusätzlich
 *    schneller (16,8 ms statt 20,7 ms je Aufruf).
 *
 * 2. DIE KOMPRESSIONSSTUFE BESTIMMT, OB DIE BASIS ERREICHBAR BLEIBT.
 *    Die Stufe legt die Fenstergröße fest. Reicht das Fenster nicht über
 *    die Basis, findet der Komprimierer sie nicht mehr, und das Delta fällt
 *    auf die Größe einer gewöhnlichen Kompression zurück — ohne Fehler,
 *    ohne Warnung. Gemessen an 2,5 MiB Basis, 12 geänderten Seiten:
 *
 *      Stufe  3 -> 517,1 KiB      Stufe  9 ->  22,5 KiB
 *      Stufe  6 -> 150,9 KiB      Stufe 12 ->  22,2 KiB
 *
 *    Die Kommandozeile hat das Problem nicht: `--patch-from` setzt das Fenster
 *    selbst auf die Dateigröße. Dieselbe Aufgabe kostet sie auf jeder Stufe
 *    zwischen 21 und 27 KiB. `--long` ändert daran nichts — geprüft, die
 *    Werte mit und ohne sind identisch.
 *
 *    Deshalb SAFE_LEVEL. Wer die Stufe senkt, sieht die Falle live; das ist
 *    auf der Demo-Folie Absicht und nicht etwa ein Fehler.
 */
import {
  init,
  compress,
  createCCtx,
  freeCCtx,
  compressUsingDict,
  createDCtx,
  freeDCtx,
  decompressUsingDict,
} from "@bokuweb/zstd-wasm";

/** Kleinste Stufe, die bei einer Basis von 2,5 MiB noch ein kleines Delta liefert. */
export const SAFE_LEVEL = 9;

/** Die Stufe, auf der die Falle zuschlägt — für die Vorführung. */
export const TRAP_LEVEL = 3;

/** Basisgröße der Demo. Bei 2,5 MiB liegt ein Delta in 13 ms vor. */
export const DEMO_BASE_BYTES = 2.5 * 1024 * 1024;

let ready: Promise<void> | null = null;
let cctx = 0;
let dctx = 0;

/**
 * Lädt das Modul genau einmal und legt die beiden Kontexte an.
 * `wasmUrl` muss über `import.meta.env.BASE_URL` gebildet werden, sonst
 * bricht der Pfad unter dem Basispfad der veröffentlichten Seite.
 */
export function initZstd(wasmUrl: string): Promise<void> {
  if (!ready) {
    ready = init(wasmUrl).then(() => {
      cctx = createCCtx();
      dctx = createDCtx();
    });
  }
  return ready;
}

/** Gibt die Kontexte frei. Nur für Tests und beim Abbau der Komponente. */
export function disposeZstd(): void {
  if (cctx) freeCCtx(cctx);
  if (dctx) freeDCtx(dctx);
  cctx = 0;
  dctx = 0;
  ready = null;
}

function requireReady(): void {
  if (!cctx || !dctx) throw new Error("initZstd() wurde nicht abgewartet");
}

export interface DeltaResult {
  bytes: Uint8Array;
  milliseconds: number;
}

/** Das Delta, das `base` in `target` überführt — ein gewöhnlicher zstd-Frame. */
export function buildDelta(
  base: Uint8Array,
  target: Uint8Array,
  level = SAFE_LEVEL,
): DeltaResult {
  requireReady();
  const started = performance.now();
  const bytes = compressUsingDict(cctx, target, base, level);
  return { bytes, milliseconds: performance.now() - started };
}

/** Das Ziel aus Basis und Delta zurückrechnen. */
export function applyDelta(
  base: Uint8Array,
  delta: Uint8Array,
  heapBytes = 64 * 1024 * 1024,
): DeltaResult {
  requireReady();
  const started = performance.now();
  const bytes = decompressUsingDict(dctx, delta, base, {
    defaultHeapSize: heapBytes,
  });
  return { bytes, milliseconds: performance.now() - started };
}

/** Zum Vergleich: das ganze Ziel komprimiert, ohne jede Basis. */
export function compressWhole(
  target: Uint8Array,
  level = SAFE_LEVEL,
): DeltaResult {
  const started = performance.now();
  const bytes = compress(target, level);
  return { bytes, milliseconds: performance.now() - started };
}

/**
 * SHA-256 als Hex. Braucht einen sicheren Kontext; localhost und die
 * veröffentlichte Seite sind einer, `file://` nicht.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    view.buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Die Kommandozeile, die dasselbe Delta anwendet — der Notweg auf der Folie. */
export function cliApplyCommand(windowLog: number): string {
  return `zstd -d --long=${windowLog} --patch-from=basis.duckdb delta.zst -o ziel.duckdb`;
}

/** Das kleinste Fenster, das eine Datei dieser Größe abdeckt, wie die CLI es wählt. */
export function windowLogFor(bytes: number): number {
  return Math.max(10, bytes.toString(2).length);
}
