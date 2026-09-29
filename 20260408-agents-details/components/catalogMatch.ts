// Abgleich zwischen Namen aus drei verschiedenen Welten:
//
//   Katalog   „GPT-5.6 Luna High Thinking“, „Claude 4.5 Opus“, „Kimi K3 Max“
//   AA        „Claude Opus 4.5 (Reasoning)“, „GPT-5.4 (xhigh)“, „Qwen3.8 Max (0902)“
//   Chart     `gpt-5.6-luna`, `claude-opus-4.5`, `qwen3.8-max`
//
// `familyKey()` bringt alle drei auf denselben Schlüssel. Er entsteht aus dem
// NAMEN, nie aus dem Slug: `claude-35-sonnet` heißt 3.5, `claude-21` heißt 2.1.
//
// Was verschmolzen wird — Konfigurationen desselben Modells, zwischen denen der
// Nutzer im Produkt wählt: Effort-Stufen, Reasoning/Thinking, Fast, Kontext-
// varianten (1M, 500k), Preview und Datumsangaben. Was nie verschmolzen wird —
// verschiedene Modelle mit ähnlichem Namen: Flash gegen Flash-Lite, mini, nano,
// Pro, Codex, „Codex Max“, „Qwen3.8 Max“. Deshalb kein generisches Abschneiden
// hinten, sondern eine Liste von Wörtern und zwei ausdrückliche Ausnahmen.

import { CATALOGS, type CatalogId } from "./toolCatalogs";

/** Wörter, die nur eine Konfiguration desselben Modells benennen. */
const CONFIG_WORDS = new Set([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "minimal",
  "none",
  "adaptive",
  "thinking",
  "reasoning",
  "non",
  "no",
  "fast",
  "preview",
  "hybrid",
  "default",
  "fallback",
  "effort",
  "mode",
]);

const CLAUDE_FAMILIES = new Set(["opus", "sonnet", "haiku", "fable"]);
const isVersion = (t: string) => /^\d+(\.\d+)?$/.test(t);
/** Kontextvarianten: `1m`, `500k`, `200k`. */
const isContext = (t: string) => /^\d+[km]$/.test(t);

/**
 * `max` ist bei manchen Modellen der Name, nicht die Stufe: „GPT-5.1 Codex Max“
 * und „Qwen3.8 Max“. Steht `max` hinter `codex` oder hinter einem `qwen…`-Wort,
 * bleibt es.
 */
const keepsMax = (before: string | undefined) =>
  before === "codex" || (before !== undefined && /^qwen[\d.]*$/.test(before));

/**
 * `fast` ist bei den meisten Produkten ein Modus („Claude Opus 5.5 High Fast“,
 * „Grok 4.7 (Fast)“), bei xAIs älteren Modellen aber der Name: „Grok 4 Fast“ und
 * „Grok 4.1 Fast“ sind eigene, billigere Modelle.
 */
const keepsFast = (t: string[]) =>
  t[0] === "grok" && (t[1] === "4" || t[1] === "4.1");

export function familyKey(name: string): string {
  let s = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // Klammern: Stufe, Datum, „(Fast)“, „(Reasoning)“
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/x-high/g, "xhigh")
    .replace(/\+/g, " plus ") // „Command A+“ ist nicht „Command A“
    .replace(/[_/]/g, " ");
  // Punkt zwischen Ziffern bleibt, jedes andere Zeichen trennt: `gpt-5.6-luna`,
  // `GPT 5.6 Luna` und `GPT-5.6 Luna` werden dieselbe Wortfolge.
  let t = s
    .split(/[^a-z0-9.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    // Ein vierstelliges Wort allein ist ein Datum (`0813`, `0731`).
    .filter((w) => !/^\d{4}$/.test(w));

  // `claude 4.5 opus` → `claude opus 4.5`
  if (
    t[0] === "claude" &&
    t[1] !== undefined &&
    isVersion(t[1]) &&
    t[2] !== undefined &&
    CLAUDE_FAMILIES.has(t[2])
  )
    t = ["claude", t[2], t[1], ...t.slice(3)];

  // Konfigurationswörter und Kontextvarianten am Ende abtragen.
  while (t.length > 1) {
    const last = t[t.length - 1]!;
    if (isContext(last)) t.pop();
    else if (
      CONFIG_WORDS.has(last) &&
      !(last === "max" && keepsMax(t[t.length - 2])) &&
      !(last === "fast" && keepsFast(t))
    )
      t.pop();
    else break;
  }
  return t.join("-");
}

/** Schlüsselmenge je Produktkatalog. */
const KEYS: Partial<Record<CatalogId, ReadonlySet<string>>> = {};
export function catalogKeys(id: CatalogId): ReadonlySet<string> {
  return (KEYS[id] ??= new Set(
    CATALOGS[id].models.map((m) => familyKey(m.name)),
  ));
}

/** Bietet das Produkt das Modell an, das dieses Chart-Label meint? */
export const catalogHas = (id: CatalogId, label: string): boolean =>
  catalogKeys(id).has(familyKey(label));
