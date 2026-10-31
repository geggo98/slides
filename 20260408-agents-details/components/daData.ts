// Datenbasis der Varianten `da-cost` und `da-speed` des Modell-Routing-Charts:
// DesignArena-Elo (Board „Overall Agentic“) gegen Listenpreis bzw. gegen die
// Ø Generierungszeit. `paretoVariants.ts` stellt sie neben die AA-Ansichten,
// `ModelRoutingPareto.vue` schaltet zwischen ihnen um.
//
// Herkunft
// --------
// https://www.designarena.ai/leaderboard?section=overall&board=overall-agentic,
// Stand `DA_STAND`. Die Rohdaten liegen als Archiv unter `data/designarena/`
// (`fetch.ts` erklärt, wie sie aus der Seite kommen). Hier steht nur, was
// daraus wird.
//
// Snapshot wechseln: Import, `DA_BOARD` und `DA_STAND` direkt darunter — nur
// dort, wie bei AA. Der Ablauf steht in `data/artificialanalysis/UPDATE.md`;
// ein Test (`daData.test.ts`) schlägt fehl, solange die drei nicht zum
// neuesten Eintrag in `data/designarena/index.ndjson` passen.
//
// Was die Achsen hier heißen
// --------------------------
// - y = Elo aus Blind-Duellen: Menschen wählen das Ergebnis, das ihnen besser
//   gefällt (Websites, Apps, Spiele, als Agent gebaut). Das misst Geschmack und
//   Gesamteindruck, nicht Korrektheit — und ist eine zweite, von AA
//   unabhängige Qualitätsachse.
// - Kosten = Listenpreis je 1M Token, 3 Teile Input zu 1 Teil Output gemischt,
//   wie DesignArena selbst rechnet. In USD und NICHT in €: das ist kein
//   Verbrauch pro Aufgabe wie bei AA, sondern ein Preisschild. Ein Modell, das
//   doppelt so viele Token braucht, steht hier trotzdem gleich teuer.
// - Tempo = Ø Zeit einer Generierung in Sekunden. DesignArena führt sie nur für
//   einen Teil der Modelle, und gerade die neuesten fehlen (`DA_NO_TIME`).
//
// Auswahlregel
// ------------
// Wie bei AA ein Punkt je Modell: DesignArena führt Effort-Stufen teils einzeln
// („GPT-6 Astra (max)“ und „(xhigh)“, „Muse Spark 1.3 Max“ und „Muse Spark 1.3
// (xhigh)“). Was ein Modell ist, entscheidet `familyKey()` (`catalogMatch.ts`),
// dieselbe Regel wie für die Produktkataloge — so zählt ein Preset jedes Modell
// genau einmal. Je Modell gilt die Stufe mit dem höchsten Elo, bei Gleichstand
// die billigere; ihr Name wird das Label.
//
// Das Label kommt aus dem Anzeigenamen, nicht aus der `modelId`: die ist teils
// ein Codename (`hampshire` = MiMo-V2.6-Pro, `yoda` = Grok 4.5). Aus „Claude
// Opus 5.5“ wird `claude-opus-5.5` — dieselbe Schreibweise wie bei AA, damit
// Labs, Produkt-Presets und Kataloge ohne Sonderweg greifen.

import raw from "../data/designarena/board-20261031-46d7c541.json";
import { familyKey } from "./catalogMatch";
import { P, type Pt } from "./paretoData";

/** Dateiname des Snapshots oben im Import; der Test hält beide gleich. */
export const DA_BOARD = "board-20261031-46d7c541.json";
/** Abrufdatum dieses Snapshots (`fetched_at` in `index.ndjson`), TT.MM.JJJJ. */
export const DA_STAND = "31.10.2026";
export const DA_URL =
  "https://www.designarena.ai/leaderboard?section=overall&board=overall-agentic";
/**
 * Elo-Böden je Ansicht. Die Kostenansicht hat Preise für alle Modelle; ab 1200
 * stehen dort am 31.10.2026 24 Modelle, etwa so viele wie bei AA (26) — mit
 * 1100 wären es 46 und die Labels unlesbar. Die Tempoansicht hat Zeiten nur
 * für ältere Modelle; mit 1200 blieben zwei Punkte, mit 1000 sind es 28.
 */
export const DA_FLOOR = { cost: 1200, speed: 1000 } as const;
/** Gewichte des Mischpreises, wie auf der Seite: 3 Teile Input, 1 Teil Output. */
export const MIX = { input: 3, output: 1 } as const;

export interface DaRow {
  modelId: string;
  displayName: string | null;
  provider: string | null;
  elo: number;
  battles: number | null;
  avgGenerationTimeMs: number | null;
  priceInput: number | null;
  priceOutput: number | null;
}

/** Ein Modell des Charts: die beste Stufe seiner Familie. */
export interface DaModel {
  label: string;
  /** Anzeigename der gewählten Stufe, wie die Seite ihn führt. */
  name: string;
  elo: number;
  /** USD je 1M Token, 3:1 gemischt; null ohne Preis. */
  usd: number | null;
  /** Sekunden je Generierung; null ohne Messwert. */
  sec: number | null;
  battles: number | null;
}

export const DA_ROWS: readonly DaRow[] = (raw as { models: DaRow[] }).models;

/** „GPT-6 Astra (max)“ → `gpt-6-astra`, „GLM 5.2“ → `glm-5.2`. */
export function daLabel(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/** Mischpreis in USD je 1M Token, oder null, wenn ein Teil fehlt. */
export function mixPrice(input: number | null, output: number | null) {
  if (input === null || output === null) return null;
  return (MIX.input * input + MIX.output * output) / (MIX.input + MIX.output);
}

/**
 * Je Modell (`familyKey`) die Stufe mit dem höchsten Elo, bei Gleichstand die
 * billigere — unter den Stufen, die `hat` erfüllen. Je Ansicht getrennt, wie
 * `aaExtras.ts` bei AA: Hat die stärkste Stufe keine Zeitangabe, eine
 * schwächere aber schon, steht das Modell in der Tempoansicht mit der
 * schwächeren, statt ganz zu fehlen.
 */
export function bestPerModel(
  rows: readonly DaRow[] = DA_ROWS,
  hat: (m: DaModel) => boolean = () => true,
): DaModel[] {
  const best = new Map<string, DaModel>();
  for (const r of rows) {
    const name = r.displayName ?? r.modelId;
    const m: DaModel = {
      label: daLabel(name),
      name,
      elo: r.elo,
      usd: mixPrice(r.priceInput, r.priceOutput),
      sec: r.avgGenerationTimeMs === null ? null : r.avgGenerationTimeMs / 1000,
      battles: r.battles,
    };
    if (!hat(m)) continue;
    const key = familyKey(name);
    const b = best.get(key);
    if (
      !b ||
      m.elo > b.elo ||
      (m.elo === b.elo && (m.usd ?? Infinity) < (b.usd ?? Infinity))
    )
      best.set(key, m);
  }
  return [...best.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Alle Modelle, je eins; die Ansichten legen ihren Boden darüber. */
export const DA_MODELS: readonly DaModel[] = bestPerModel();

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Preise unter 0,10 $ mit zwei geltenden Ziffern, sonst zwei Nachkommastellen. */
const preis = (v: number) => (v >= 0.095 ? r2(v) : Number(v.toPrecision(2)));

const costPt = (m: DaModel) => P(m.label, preis(m.usd!), m.elo);
const speedPt = (m: DaModel) => P(m.label, Math.round(m.sec!), m.elo);
const byX = (a: Pt, b: Pt) => a.x - b.x;
const mitPreis = bestPerModel(DA_ROWS, (m) => m.usd !== null);
const mitZeit = bestPerModel(DA_ROWS, (m) => m.sec !== null);

/** Variante `da-cost`: x = USD je 1M Token (3:1 gemischt), y = Elo. */
export const DA_COST: Pt[] = mitPreis
  .filter((m) => m.elo >= DA_FLOOR.cost)
  .map(costPt)
  .sort(byX);

/**
 * Variante `da-speed`: x = Sekunden je Generierung, y = Elo. Kleiner ist
 * schneller, die Achse ist also wie bei den Kosten orientiert, und `paretoFront`
 * braucht keinen Richtungsparameter. Modelle ohne Zeitangabe fehlen
 * (`DA_NO_TIME`).
 */
export const DA_SPEED: Pt[] = mitZeit
  .filter((m) => m.elo >= DA_FLOOR.speed)
  .map(speedPt)
  .sort(byX);

/**
 * Was unter dem Boden liegt, blendet nur ein Produkt-Preset ein — wie
 * `aaExtras.ts` bei AA: ein Preset soll zeigen, welche Modelle DES PRODUKTS
 * sich lohnen, auch die älteren.
 */
export const DA_EXTRAS_COST: Pt[] = mitPreis
  .filter((m) => m.elo < DA_FLOOR.cost)
  .map(costPt)
  .sort(byX);
export const DA_EXTRAS_SPEED: Pt[] = mitZeit
  .filter((m) => m.elo < DA_FLOOR.speed)
  .map(speedPt)
  .sort(byX);

const getaktet = new Set(mitZeit.map((m) => familyKey(m.label)));
/** Modelle der Preisansicht, für die DesignArena keine Generierungszeit führt. */
export const DA_NO_TIME: string[] = DA_COST.filter(
  (p) => !getaktet.has(familyKey(p.label)),
)
  .map((p) => p.label)
  .sort();
