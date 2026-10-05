/**
 * codexEffortMath.ts — Kostenmodell für die Codex-Effort-Wechsel-Folie,
 * Pendant zu ./opusplanMath.ts.
 *
 * ⚠ VORLÄUFIG (Stand 05.10.2026). Es gibt noch keine eigene Codex-Messung:
 * `plan_mode_reasoning_effort = "xhigh"` läuft lokal erst seit dem 15.09.2026.
 * Bis echte Sessions vorliegen, rechnet die Folie mit den Volumina der
 * opusplan-Folie (Mediane aus 57 echten Claude-Code-Sessions mit Modellwechsel,
 * 30.08.–29.09.2026, siehe ./opusplanMath.ts), damit beide Rechnungen vergleichbar bleiben, und
 * skaliert sie je Modell mit zwei Faktoren aus dem Artificial-Analysis-
 * Snapshot der Pareto-Folie (../aaData.ts, `CONFIGS`, Stand `AA_STAND`):
 *
 * - capFaktor: bester Intelligence Index von Opus 5.5 ÷ bester Index des
 *   Modells — ein schwächeres Modell braucht mehr Anläufe und damit mehr
 *   Tokens für dieselbe Aufgabe. Referenz ist Opus 5.5, weil opusplan seit
 *   30.09. damit rechnet. Liegt zwischen 1,09 (Astra) und 1,51 (Luna); ein
 *   Index-Verhältnis ist KEIN Tokenverhältnis, der Faktor ist also eine
 *   Setzung und bei Luna die grobste. Vorher stand hier das DeepSWE-pass@1
 *   (0,99–1,10): dort liegen die Modelle dichter beieinander, weil das Board
 *   eine Aufgabe misst, der Index einen Mix aus Wissen, Logik und Agenten.
 * - effortFaktor: USD/Task auf xhigh ÷ USD/Task auf medium desselben Modells
 *   (`intelligenceIndexCostPerTask`) — die Skalierung des Efforts. Er gilt für
 *   die GANZE Phase (Reads, Writes, Output), nicht nur für den Output. Ein
 *   AA-Task ist ein Eval-Task des Index-Mixes, kein SWE-Task; die Faktoren
 *   fallen etwas niedriger aus als bei DeepSWE (Astra 1,50 gegen 1,49, Sol
 *   5.6 2,35 gegen 2,54, Luna 5.6 5,47 gegen 6,75). Auch das Obergrenze-
 *   Argument bleibt: medium löst weniger Aufgaben und gibt früher auf.
 *   Deshalb ist der Faktor ein Regler, kein Fixwert; `effortFaktorRegler()`
 *   liefert die Vorgabe auf eine Nachkommastelle gerundet, damit Folie und
 *   Test dieselbe Zahl zeigen.
 * - Die geliehenen Volumina gelten als medium-Volumina, auch die der
 *   Plan-Phase (der xhigh-Plan liest also f × 4,1 MTok). Liest
 *   man die Plan-Mediane stattdessen als xhigh-Plan, bleibt die Ersparnis in
 *   € gleich, der Prozentwert würde größer. Kontext beim
 *   Wechsel und Exec-Output kommen als Eingaben aus dem geteilten Szenario
 *   (./scenarioState.ts, Defaults 180k / 80k je 21 MTok); der 180k-Default
 *   liegt unter der 272k-Schwelle (2× Input).
 *
 * Mechanik gegenüber opusplan:
 * - opusplan wechselt das MODELL: anderer Preis pro Token, und der Cache
 *   bricht, weil das Modell Teil des Prefix ist.
 * - Codex wechselt nur den EFFORT desselben Modells: gleicher Preis pro
 *   Token, teurer ist nur, dass xhigh mehr Reasoning und Output erzeugt und
 *   länger läuft. Der Cache bricht trotzdem: OpenAI führt `reasoning.effort`
 *   als prefix-relevante Einstellung („can rewrite instructions in the hidden
 *   system instructions“, developers.openai.com/api/docs/guides/prompt-caching,
 *   geprüft 16.09.2026). In openai/codex#35416 fällt der Cache-Anteil bei
 *   jedem Wechsel auf eine noch nicht benutzte Stufe auf den statischen
 *   Prefix zurück (9 984 von ~15 k Tokens) — für den Sitzungsanteil ein
 *   voller Bruch, daher dasselbe BREAK_SHARE wie bei opusplan. Eine Rückkehr
 *   auf eine schon benutzte Stufe innerhalb der TTL bricht dort NICHT; das
 *   modelliert diese Datei bewusst nicht (konservativ gegen den Wechsel).
 * - Cache-Write kostet bei GPT-5.6+ 1,25× Input, Cache-Read 0,1×, einzige
 *   TTL 30 min (`prompt_cache_options.ttl` kennt nur "30m"); Codex fordert
 *   nichts anderes an. Kein TTL-Regler nötig.
 * - Experimentell: `[features] reasoning_effort_override = true` hängt
 *   `configuration_update`-Items an die History, statt den Prefix zu ändern.
 *   API-seitig gilt das für die GPT-6-Familie (reasoning.md: „supported by
 *   the GPT-6 model family in standard, single-agent mode“). Codex sendet es
 *   aber nur für Modelle, deren Katalogeintrag `supports_reasoning_effort_
 *   updates` auf true setzt (`CONFIG_UPDATE_SLUGS`). Bei allen anderen
 *   ignoriert Codex den Schalter still und bricht den Cache wie gehabt;
 *   `cacheBleibt()` bildet das ab. Der Schalter `cacheErhalten` setzt den
 *   Bruch also nur für Allow-List-Modelle auf 0 — und auch dort nur, wenn
 *   man das Feature selbst einschaltet (Stage UnderDevelopment, default aus).
 *
 * Alle Token-Größen in MTok, alle Kosten in USD; Umrechnung erst am Ende.
 */

import { CONFIGS } from "../aaData";
import {
  BREAK_SHARE,
  DEFAULT_TTL,
  PLAN,
  REPLAN_OUT,
  readPreis,
  szenarien as opusplanSzenarien,
  toEur,
  type Ergebnis as OpusplanErgebnis,
  type Modell,
} from "./opusplanMath";
import { SZENARIO_DEFAULTS, type Szenario } from "./scenarioState";

export { toEur };
export type { Modell };

/** Cache-Write für GPT-5.6 und neuer: 1,25× Input, unabhängig von der TTL. */
export const WRITE_FAKTOR = 1.25;
/** Kontext beim Moduswechsel, MTok — Regler-Default (opusplan-Median 179k). */
export const DEFAULT_CTX = SZENARIO_DEFAULTS.ctxK / 1000;
/**
 * Exec-Output je MTok Exec-Cache-Read bei den Regler-Defaults — 80k Out auf
 * 21 MTok Read. Kein Modellparameter mehr, nur noch die Vorgabe für Tests und
 * für `execOutAusRatio()`, falls jemand ohne eigenen Output-Regler rechnet.
 */
export const EXEC_OUT_RATIO =
  SZENARIO_DEFAULTS.outK / 1000 / SZENARIO_DEFAULTS.readM;
/** Exec-Output (MTok) im Default-Verhältnis zum Exec-Cache-Read. */
export const execOutAusRatio = (execRead: number): number =>
  execRead * EXEC_OUT_RATIO;

export type ModellKey = "astra" | "sol61" | "sol" | "luna";

export interface CodexModell extends Modell {
  key: ModellKey;
  label: string;
  /** Slug des Modells — bei Codex, OpenAI und AA derselbe (`gpt-6.1-sol`). */
  slug: string;
  /** USD/Task xhigh ÷ USD/Task medium, aus dem AA-Snapshot. */
  effortFaktor: number;
  /** bester Index Opus 5.5 ÷ bester Index des Modells, aus dem AA-Snapshot. */
  capFaktor: number;
  /** Codex sendet `configuration_update` für dieses Modell (Allow-List). */
  cacheUpdate: boolean;
}

/**
 * Die Allow-List: Modelle, für die Codex `configuration_update` sendet —
 * `supports_reasoning_effort_updates: true` im gebündelten Katalog
 * (openai/codex, `codex-rs/models-manager/models.json`, rust-v0.160.0 vom
 * 01.10.2026, gleich main). Das Gate sitzt in `core/src/client.rs`,
 * `reasoning_effort_override_enabled()`: Feature an, Provider OpenAI UND
 * dieses Flag. Fehlt das Flag im Eintrag (gpt-6-sol, gpt-6-luna), gilt der
 * Default false (`models-manager/src/model_info.rs`); gpt-5.6-*, gpt-5.5 und
 * codex-auto-review tragen es ausdrücklich als false. Astra seit 0.157.0
 * (PR #47397), 6.1 Sol seit 0.159.1 (PR #49318, dort auch Default-Modell).
 * Der Live-Katalog des Backends kann den gebündelten Wert überschreiben —
 * ohne Login nicht geprüft.
 */
export const CONFIG_UPDATE_SLUGS: readonly string[] = [
  "gpt-6-astra",
  "gpt-6.1-sol",
];

const OPUS_SLUG = "claude-opus-5.5";

function aaKostenProTask(slug: string, effort: "medium" | "xhigh"): number {
  const cfg = CONFIGS.find((c) => c.label === slug && c.effort === effort);
  if (!cfg) throw new Error(`AA: keine Sprosse ${slug}/${effort}`);
  return cfg.usd;
}

function aaBestIndex(slug: string): number {
  const xs = CONFIGS.filter((c) => c.label === slug).map((c) => c.index);
  if (xs.length === 0) throw new Error(`AA: kein Modell ${slug}`);
  return Math.max(...xs);
}

const OPUS_BEST = aaBestIndex(OPUS_SLUG);

function modell(
  key: ModellKey,
  label: string,
  slug: string,
  input: number,
  output: number,
  read?: number,
): CodexModell {
  return {
    key,
    label,
    slug,
    input,
    output,
    ...(read === undefined ? {} : { read }),
    effortFaktor:
      aaKostenProTask(slug, "xhigh") / aaKostenProTask(slug, "medium"),
    capFaktor: OPUS_BEST / aaBestIndex(slug),
    cacheUpdate: CONFIG_UPDATE_SLUGS.includes(slug),
  };
}

/**
 * Listenpreise USD/MTok Input/Output (Standard, kurzer Kontext),
 * developers.openai.com/api/docs/pricing, geprüft 05.10.2026. Die Sol-Aktion
 * („through November 21, 2026“) gilt nur für gpt-5.6-sol, das hier nicht mehr
 * steht. gpt-6.1-sol liest mit 0,05× (cached $0,10 auf $2), die anderen mit
 * 0,1×; Write überall 1,25×. Reihenfolge = Reihenfolge der Pillen auf der
 * Folie, teuer nach billig. GPT-6 Terra gibt es nicht.
 */
export const MODELLE: readonly CodexModell[] = [
  modell("astra", "Astra", "gpt-6-astra", 10, 50),
  modell("sol61", "Sol 6.1", "gpt-6.1-sol", 2, 10, 0.05),
  modell("sol", "Sol 6", "gpt-6-sol", 2, 10),
  modell("luna", "Luna", "gpt-6-luna", 0.1, 0.5),
];

/**
 * Vorgabe der Folie: Sol 6.1 ist seit 0.159.1 Codex' Default-Modell
 * (PR #49318) und trägt das `configuration_update`-Flag.
 */
export const DEFAULT_MODELL: ModellKey = "sol61";

/**
 * Platzhalter für die Umrechnung Claude → Codex: heute die Identität, weil
 * die Codex-Rechnung die Claude-Volumina unverändert leiht (Kopfkommentar).
 * Sobald eigene Codex-Messungen vorliegen, landet hier die reine Funktion,
 * die aus dem geteilten Szenario (Claude-Tokenizer, Claude-Schrittzahl) die
 * Codex-Volumina macht — die Folien-Regler und die opusplan-Folie bleiben
 * davon unberührt.
 */
export function toCodexSzenario(s: Szenario): Szenario {
  return { ...s };
}

/**
 * opusplan über einem beliebigen Stand des geteilten Szenarios (1-h-TTL, der
 * opusplan-Default — dessen TTL-Schalter ist folienlokal und hier unbekannt).
 * Die Folien-Notiz vergleicht damit live statt gegen `OPUSPLAN_REF`: seit die
 * Regler geteilt sind, zeigt die opusplan-Folie für dasselbe Szenario sonst
 * −45 %, während die Codex-Notiz noch „−37 %“ behauptet. Bewusst das rohe
 * Szenario, nicht `toCodexSzenario()`: verglichen wird, was opusplan mit
 * denselben Claude-Volumina schafft.
 */
export function opusplanVergleich(s: Szenario): OpusplanErgebnis {
  return opusplanSzenarien({
    ctx: s.ctxK / 1000,
    execRead: s.readM,
    execOut: s.outK / 1000,
    replans: s.n,
    ttl: DEFAULT_TTL,
  });
}

/**
 * Vergleichsmaßstab der Folie: opusplan bei den Regler-Defaults des
 * geteilten Szenarios (Kontext 180k, Exec 30 MTok / 150k Out, 3 Re-Plans,
 * 1-h-TTL) — 9,27 €, −37 %. Aus opusplanMath und SZENARIO_DEFAULTS
 * abgeleitet statt abgetippt, damit der Wert nicht von der opusplan-Folie
 * wegdriften kann. Nur der Prozentwert ist preisneutral vergleichbar: die
 * Codex-Basis „Nur xhigh“ ist eine teurere Session als „Nur Opus“, weil Sol
 * über Sonnet 5 liegt und f die ganze Session multipliziert.
 */
export const OPUSPLAN_REF = opusplanVergleich(SZENARIO_DEFAULTS);

export function modellByKey(key: ModellKey): CodexModell {
  const m = MODELLE.find((x) => x.key === key);
  if (!m) throw new Error(`unbekanntes Modell ${key}`);
  return m;
}

/** Regler-Vorgabe: effortFaktor auf eine Nachkommastelle, wie der Regler ihn zeigt. */
export const effortFaktorRegler = (key: ModellKey): number =>
  Math.round(modellByKey(key).effortFaktor * 10) / 10;

/**
 * Bleibt der Cache beim Effort-Wechsel erhalten? Nur wenn der Schalter an ist
 * UND das Modell auf der Allow-List steht — sonst ignoriert Codex ihn still.
 */
export const cacheBleibt = (
  e: Pick<Eingaben, "modell" | "cacheErhalten">,
): boolean => e.cacheErhalten && modellByKey(e.modell).cacheUpdate;

export const writePreis = (m: Modell): number => m.input * WRITE_FAKTOR;

/** Kosten einer Phase: Output + Cache-Read + Cache-Write zum jeweiligen Preis. */
export const phasenKosten = (
  m: Modell,
  out: number,
  read: number,
  write: number,
): number => out * m.output + read * readPreis(m) + write * writePreis(m);

/** Cache-Bruch: BREAK_SHARE des Kontexts wird nach dem Effort-Wechsel als Write neu berechnet. */
export const bruchKosten = (m: Modell, ctx: number): number =>
  BREAK_SHARE * ctx * writePreis(m);

export interface Eingaben {
  modell: ModellKey;
  /** Wie viel teurer dieselbe Aufgabe auf xhigh ist als auf medium (Regler). */
  faktor: number;
  /** Kontextgröße beim Effort-Wechsel, MTok (Regler, Default 0,18). */
  ctx: number;
  /** Cache-Read-Volumen der Umsetzungs-Phase auf medium, MTok. */
  execRead: number;
  /** Output der Umsetzungs-Phase auf medium, MTok (Regler, Default 0,15). */
  execOut: number;
  /** Rückkehren in den Plan-Modus ohne vorheriges /compact. */
  replans: number;
  /** Experimenteller Schalter: `configuration_update` statt Prefix-Änderung, Bruch = 0 — nur für Modelle der Allow-List, sonst ohne Wirkung. */
  cacheErhalten: boolean;
}

export interface Ergebnis {
  /** Szenario-Gesamtkosten in USD. */
  nurMedium: number;
  nurXhigh: number;
  effortWechsel: number;
  antiPattern: number;
  /** Ersparnis Effort-Wechsel vs. Nur xhigh (negativ, wenn der Faktor unter dem Break-even liegt). */
  ersparnis: number;
  ersparnisProzent: number;
  /** Der eine Bruch beim Plan→Exec-Wechsel (0 bei `cacheBleibt`). */
  bruchEinmal: number;
  /** Ersparnis pro MTok Exec-Cache-Read inkl. anteiligem Output. */
  proMtokErsparnis: number;
  /** Exec-Cache-Read in MTok, ab dem der Wechsel billiger ist als Nur xhigh (Infinity bei faktor ≤ 1). */
  breakEvenRead: number;
  /** Faktor xhigh/medium, ab dem der Wechsel billiger ist als Nur xhigh (1 bei `cacheBleibt`). */
  breakEvenFaktor: number;
  /** Nur die zwei Cache-Brüche einer Rückkehr. */
  rueckkehrBrueche: number;
  /** Volle Zusatzkosten einer Rückkehr: Brüche + neuer Plan auf xhigh. */
  rueckkehrGesamt: number;
  /**
   * Ab so vielen Rückkehren fressen allein die Brüche die Ersparnis auf.
   * 0 = keine Ersparnis vorhanden; Infinity = ohne Brüche (`cacheBleibt`) nie.
   */
  ersparnisWegAb: number;
  /** Ab so vielen Rückkehren liegt der Anti-Pattern-Balken strikt über „Nur xhigh“ (0 = keine Ersparnis). */
  balkenUeberAb: number;
}

/** Exec-Output je MTok Exec-Cache-Read der Eingaben (das Verhältnis der Regler). */
const outRatio = (e: Eingaben): number => e.execOut / e.execRead;

/**
 * Kostengeraden fürs Break-even-Chart: Gesamtkosten (USD) bei x MTok
 * Exec-Cache-Read, Output skaliert mit dem Regler-Verhältnis execOut/execRead
 * (Gegenstück zu `kostenGerade` in ./opusplanMath.ts). Beide Geraden tragen
 * denselben xhigh-Plan; „Nur xhigh“ steigt f-mal so steil, der Effort-Wechsel
 * startet um den Bruch höher. Schnittpunkt = `breakEvenRead`.
 */
export function kostenGeraden(e: Eingaben): {
  nurXhigh: (x: number) => number;
  effortWechsel: (x: number) => number;
} {
  const m = modellByKey(e.modell);
  const c = m.capFaktor;
  const f = e.faktor;
  const planXhigh = f * c * phasenKosten(m, PLAN.out, PLAN.read, PLAN.write);
  const bruch = cacheBleibt(e) ? 0 : c * bruchKosten(m, e.ctx);
  const proMtokMedium = c * (readPreis(m) + outRatio(e) * m.output);
  return {
    nurXhigh: (x) => planXhigh + f * x * proMtokMedium,
    effortWechsel: (x) => planXhigh + bruch + x * proMtokMedium,
  };
}

export function szenarien(e: Eingaben): Ergebnis {
  const m = modellByKey(e.modell);
  const c = m.capFaktor;
  const f = e.faktor;

  const planMedium = c * phasenKosten(m, PLAN.out, PLAN.read, PLAN.write);
  const execMedium = c * (e.execOut * m.output + e.execRead * readPreis(m));
  const planXhigh = f * planMedium;
  const execXhigh = f * execMedium;
  const bruch = cacheBleibt(e) ? 0 : c * bruchKosten(m, e.ctx);

  const nurMedium = planMedium + execMedium;
  const nurXhigh = planXhigh + execXhigh;
  const effortWechsel = planXhigh + bruch + execMedium;

  const rueckkehrBrueche = 2 * bruch;
  const rueckkehrGesamt = rueckkehrBrueche + f * c * REPLAN_OUT * m.output;
  const antiPattern = effortWechsel + e.replans * rueckkehrGesamt;

  const ersparnis = nurXhigh - effortWechsel;
  const proMtokErsparnis =
    (f - 1) * c * (readPreis(m) + outRatio(e) * m.output);
  const breakEvenRead = f > 1 ? bruch / proMtokErsparnis : Infinity;
  const breakEvenFaktor = 1 + bruch / execMedium;

  let ersparnisWegAb = 0;
  if (ersparnis > 0) {
    ersparnisWegAb =
      rueckkehrBrueche > 0 ? Math.ceil(ersparnis / rueckkehrBrueche) : Infinity;
  }

  return {
    nurMedium,
    nurXhigh,
    effortWechsel,
    antiPattern,
    ersparnis,
    ersparnisProzent: (ersparnis / nurXhigh) * 100,
    bruchEinmal: bruch,
    proMtokErsparnis,
    breakEvenRead,
    breakEvenFaktor,
    rueckkehrBrueche,
    rueckkehrGesamt,
    ersparnisWegAb,
    // floor+1 wie in opusplanMath: erstes n, bei dem der Balken STRIKT darüber liegt.
    balkenUeberAb:
      ersparnis > 0 ? Math.floor(ersparnis / rueckkehrGesamt) + 1 : 0,
  };
}
