/**
 * Synthetische Datenbankdatei für die Live-Demo auf der Notweg-Folie.
 *
 * Warum synthetisch: Eine echte Datenbankdatei wäre ein Megabyte Binärdaten
 * im Repository, und sie trägt fremde Daten. Der Generator hier erzeugt
 * stattdessen aus einem Startwert eine Datei, die sich für zstd wie eine
 * Datenbank verhält — Seiten fester Größe mit Kopf, aufsteigenden
 * Schlüsseln und wiederkehrenden Textmustern.
 *
 * Warum deterministisch: Der Vortrag zeigt Zahlen. Sie müssen bei jeder
 * Probe und im Vortrag dieselben sein, sonst stimmt die Folie daneben nicht.
 * Deshalb ein eigener PRNG statt Math.random.
 *
 * Gemessen am 10.09.2026 mit zstd 1.5.7 (CLI) und @bokuweb/zstd-wasm 0.0.27
 * an einer Basis von 2,5 MiB, 12 geänderten Seiten und 48 KiB Anhang:
 *
 *   ganzes Ziel komprimiert   620,4 KiB
 *   naives Seiten-Diff         96,1 KiB
 *   Delta gegen die Basis       22,5 KiB   (Stufe 9, 13 ms)
 *
 * Dieselbe Aufgabe auf Stufe 3 ergibt 517,1 KiB — siehe zstdRuntime.ts,
 * dort steht, warum.
 */

/** Seitengröße in Bytes. DuckDB schreibt in Blöcken; 4 KiB ist die
 *  kleinste Einheit, in der sich eine Datei sinnvoll vergleichen lässt. */
export const PAGE_BYTES = 4096;

/** Aufschlag je Seite, den ein naives Seiten-Diff für die Seitennummer zahlt. */
export const PAGE_HEADER_BYTES = 4;

const MAGIC = 0x44554342; // "DUCB" — nur ein Erkennungszeichen, kein echtes Format
const TAGS = ["berlin", "hamburg", "muenchen", "koeln", "leipzig"] as const;
const TAG_BYTES = 12;
const ROW_BYTES = 24;
const PAGE_PREFIX_BYTES = 16;

/**
 * mulberry32: 32-Bit-PRNG, vier Zeilen, gleichmäßig genug für Testdaten.
 * Er ersetzt Math.random, weil der Vortrag reproduzierbare Zahlen braucht.
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillPage(view: Uint8Array, pageNo: number, rnd: () => number): void {
  const dv = new DataView(view.buffer, view.byteOffset, view.byteLength);
  dv.setUint32(0, MAGIC, false);
  dv.setUint32(4, pageNo, false);
  dv.setUint32(8, Math.floor(rnd() * 1e9), false);
  let offset = PAGE_PREFIX_BYTES;
  let key = pageNo * 1000;
  while (offset + ROW_BYTES <= PAGE_BYTES) {
    key += 1 + Math.floor(rnd() * 3);
    dv.setUint32(offset, key, false);
    dv.setFloat64(offset + 4, Math.floor(rnd() * 10000) / 100, false);
    const tag = TAGS[Math.floor(rnd() * TAGS.length)];
    for (let i = 0; i < TAG_BYTES; i++) {
      view[offset + 12 + i] = i < tag.length ? tag.charCodeAt(i) : 0x20;
    }
    offset += ROW_BYTES;
  }
}

/** Eine Basisdatei von rund `bytes` Bytes, auf ganze Seiten abgerundet. */
export function makeBase(bytes: number, seed = 42): Uint8Array {
  const pages = Math.max(1, Math.floor(bytes / PAGE_BYTES));
  const buffer = new Uint8Array(pages * PAGE_BYTES);
  const rnd = mulberry32(seed);
  for (let page = 0; page < pages; page++) {
    fillPage(
      buffer.subarray(page * PAGE_BYTES, (page + 1) * PAGE_BYTES),
      page,
      rnd,
    );
  }
  return buffer;
}

export interface MutateOptions {
  /** Wie viele bestehende Seiten neu geschrieben werden (in place). */
  changedPages: number;
  /** Wie viel hinten dazukommt, in KiB. Wird auf ganze Seiten aufgerundet. */
  appendKib: number;
  seed?: number;
}

export interface MutateResult {
  target: Uint8Array;
  /** Tatsächlich geänderte Seiten — nie mehr, als die Basis hat. */
  changedPages: number;
  appendedBytes: number;
}

/**
 * Ein Zyklus an der Datei: ein paar Seiten werden mittendrin neu geschrieben,
 * hinten wächst die Datei. Genau diese Mischung macht das Delta klein und
 * ein logisches Zeilen-Diff schwierig.
 */
export function mutate(base: Uint8Array, options: MutateOptions): MutateResult {
  const { changedPages, appendKib, seed = 1337 } = options;
  const appendedBytes = Math.ceil((appendKib * 1024) / PAGE_BYTES) * PAGE_BYTES;
  const target = new Uint8Array(base.length + appendedBytes);
  target.set(base);

  const rnd = mulberry32(seed);
  const basePages = base.length / PAGE_BYTES;
  const touched = new Set<number>();
  const wanted = Math.min(Math.max(0, Math.floor(changedPages)), basePages);
  while (touched.size < wanted) touched.add(Math.floor(rnd() * basePages));
  for (const page of touched) {
    fillPage(
      target.subarray(page * PAGE_BYTES, (page + 1) * PAGE_BYTES),
      page,
      rnd,
    );
  }
  for (
    let page = basePages;
    page < basePages + appendedBytes / PAGE_BYTES;
    page++
  ) {
    fillPage(
      target.subarray(page * PAGE_BYTES, (page + 1) * PAGE_BYTES),
      page,
      rnd,
    );
  }
  return { target, changedPages: touched.size, appendedBytes };
}

/**
 * Größe eines naiven Seiten-Diffs: jede geänderte oder neue Seite wandert
 * vollständig hinein, dazu ihre Nummer. Das ist der Vergleichswert auf der
 * Folie — der erste Entwurf im echten Projekt sah genau so aus.
 */
export function naivePageDiffBytes(
  base: Uint8Array,
  target: Uint8Array,
): number {
  const pages = Math.floor(target.length / PAGE_BYTES);
  let changed = 0;
  for (let page = 0; page < pages; page++) {
    const start = page * PAGE_BYTES;
    if (start + PAGE_BYTES > base.length) {
      changed++;
      continue;
    }
    let identical = true;
    for (let i = 0; i < PAGE_BYTES; i++) {
      if (base[start + i] !== target[start + i]) {
        identical = false;
        break;
      }
    }
    if (!identical) changed++;
  }
  return changed * (PAGE_BYTES + PAGE_HEADER_BYTES);
}
