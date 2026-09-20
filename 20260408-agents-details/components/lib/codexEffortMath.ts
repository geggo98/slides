/**
 * codexEffortMath.ts — Kostenmodell für die Codex-Effort-Wechsel-Folie,
 * Pendant zu ./opusplanMath.ts.
 *
 * ⚠ VORLÄUFIG (Stand 16.09.2026). Es gibt noch keine eigene Codex-Messung:
 * `plan_mode_reasoning_effort = "xhigh"` läuft lokal erst seit dem 15.09.2026.
 * Bis echte Sessions vorliegen, rechnet die Folie mit den Volumina der
 * opusplan-Folie (Mediane aus 42.802 Claude-Code-Requests, Juni–August 2026,
 * siehe ./opusplanMath.ts), damit beide Rechnungen vergleichbar bleiben, und
 * skaliert sie je Modell mit zwei Faktoren aus der DeepSWE-v1.1-Leiter
 * (../paretoData.ts, `EFFORTS`, Stand 03.09.2026):
 *
 * - capFaktor: bestes pass@1 von Opus 5 ÷ bestes pass@1 des Modells — ein
 *   schwächeres Modell braucht mehr Anläufe und damit mehr Tokens für
 *   dieselbe Aufgabe. Liegt zwischen 0,99 (Astra) und 1,10 (Luna), also
 *   unter den Fehlerbalken der Scores; auf Wunsch trotzdem im Modell.
 * - effortFaktor: €/Task auf xhigh ÷ €/Task auf medium desselben Modells —
 *   die „SWE-bench-analoge“ Skalierung des Efforts. Er gilt für die GANZE
 *   Phase (Reads, Writes, Output), nicht nur für den Output: im Board-Stand
 *   c55e58f2 (03.09., data/deepswe/) wachsen bei Sol von medium auf xhigh
 *   die Cache-Reads 2,87×, der Output 2,21×, die Kosten 2,54× (Terra
 *   4,68/3,37/3,65, Luna 14,2/5,5/7,1, Opus 5 3,19/2,48/2,76, Astra
 *   1,45/1,45/1,49) — xhigh macht mehr Schritte und trägt je Schritt mehr
 *   Kontext (Sol 45k → 90k Cache je Schritt). f auf die Reads ist also eher
 *   konservativ; nur auf den Output angewandt gäbe es f_eq ≈ 1,3 und 3,25 €
 *   Ersparnis bei Sol, was dem 2,54× widerspräche, aus dem f stammt.
 *   Eine Obergrenze bleibt er trotzdem: medium löst weniger Aufgaben und
 *   gibt früher auf, bei Terra (35 % pass@1 auf medium) und Luna (11 %)
 *   dominiert das. Deshalb ist der Faktor ein Regler, kein Fixwert;
 *   `effortFaktorRegler()` liefert die Vorgabe auf eine Nachkommastelle
 *   gerundet, damit Folie und Test dieselbe Zahl zeigen.
 * - Die geliehenen Volumina gelten als medium-Volumina, auch die der
 *   Plan-Phase (der xhigh-Plan liest also 2,5 × 7 = 17,5 MTok bei Sol). Liest
 *   man die Plan-Mediane stattdessen als xhigh-Plan, bleibt die Ersparnis in
 *   € gleich, der Prozentwert würde −49 % statt −40 %. Kontext beim
 *   Wechsel und Exec-Output kommen als Eingaben aus dem geteilten Szenario
 *   (./scenarioState.ts, Defaults 180k / 150k je 30 MTok); der 180k-Default
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
 *   In Codex 0.154.0 nur halb verdrahtet (der Request-Effort wechselt
 *   weiter), das Pinning kommt mit 0.155 (PR openai/codex#43795); laut
 *   API-Doku nur für GPT-6 Astra. Der Schalter `cacheErhalten` setzt den
 *   Bruch auf 0 — das ist der Zielzustand, nicht der heutige.
 *
 * Alle Token-Größen in MTok, alle Kosten in USD; Umrechnung erst am Ende.
 */

import { EFFORTS, type Effort } from "../paretoData";
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
/** Kontext beim Moduswechsel, MTok — Regler-Default (opusplan-Median 177k). */
export const DEFAULT_CTX = SZENARIO_DEFAULTS.ctxK / 1000;
/**
 * Exec-Output je MTok Exec-Cache-Read bei den Regler-Defaults — 150k Out auf
 * 30 MTok Read. Kein Modellparameter mehr, nur noch die Vorgabe für Tests und
 * für `execOutAusRatio()`, falls jemand ohne eigenen Output-Regler rechnet.
 */
export const EXEC_OUT_RATIO =
  SZENARIO_DEFAULTS.outK / 1000 / SZENARIO_DEFAULTS.readM;
/** Exec-Output (MTok) im Default-Verhältnis zum Exec-Cache-Read. */
export const execOutAusRatio = (execRead: number): number =>
  execRead * EXEC_OUT_RATIO;

export type ModellKey = "astra" | "sol" | "terra" | "luna";

export interface CodexModell extends Modell {
  key: ModellKey;
  label: string;
  /** Name des Modells in `EFFORTS`. */
  ladder: string;
  /** €/Task xhigh ÷ €/Task medium, aus `EFFORTS`. */
  effortFaktor: number;
  /** bestes pass@1 Opus 5 ÷ bestes pass@1 des Modells, aus `EFFORTS`. */
  capFaktor: number;
}

const OPUS_LADDER = "claude-opus-5";

function kostenProTask(ladder: string, effort: Effort): number {
  const cfg = EFFORTS.find((c) => c.label === ladder && c.effort === effort);
  if (!cfg) throw new Error(`EFFORTS: keine Sprosse ${ladder}/${effort}`);
  return cfg.x;
}

function bestesPassAt1(ladder: string): number {
  const ys = EFFORTS.filter((c) => c.label === ladder).map((c) => c.y);
  if (ys.length === 0) throw new Error(`EFFORTS: kein Modell ${ladder}`);
  return Math.max(...ys);
}

const OPUS_BEST = bestesPassAt1(OPUS_LADDER);

function modell(
  key: ModellKey,
  label: string,
  ladder: string,
  input: number,
  output: number,
): CodexModell {
  return {
    key,
    label,
    ladder,
    input,
    output,
    effortFaktor:
      kostenProTask(ladder, "xhigh") / kostenProTask(ladder, "medium"),
    capFaktor: OPUS_BEST / bestesPassAt1(ladder),
  };
}

/**
 * Listenpreise USD/MTok Input/Output, developers.openai.com/api/docs/pricing,
 * geprüft 16.09.2026. Sol ist eine befristete Aktion („promotional pricing is
 * available at least through November 21, 2026“), regulär $5/$30. Reihenfolge
 * = Reihenfolge der Pillen auf der Folie, teuer nach billig.
 */
export const MODELLE: readonly CodexModell[] = [
  modell("astra", "Astra", "gpt-6-astra", 10, 50),
  modell("sol", "Sol", "gpt-5.6-sol", 4, 20),
  modell("terra", "Terra", "gpt-5.6-terra", 2, 12),
  modell("luna", "Luna", "gpt-5.6-luna", 0.2, 1.2),
];

/**
 * Vorgabe der Folie (Wunsch des Vortragenden): mittlerer Preis, belastbare
 * Leiter (61 % pass@1 schon auf medium). Codex' eigener Picker-Default ist
 * das Modell mit der höchsten Priorität im Katalog (0.154: gpt-6-astra).
 */
export const DEFAULT_MODELL: ModellKey = "sol";

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
  /** Experimenteller Schalter: `configuration_update` statt Prefix-Änderung, Bruch = 0. */
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
  /** Der eine Bruch beim Plan→Exec-Wechsel (0 bei cacheErhalten). */
  bruchEinmal: number;
  /** Ersparnis pro MTok Exec-Cache-Read inkl. anteiligem Output. */
  proMtokErsparnis: number;
  /** Exec-Cache-Read in MTok, ab dem der Wechsel billiger ist als Nur xhigh (Infinity bei faktor ≤ 1). */
  breakEvenRead: number;
  /** Faktor xhigh/medium, ab dem der Wechsel billiger ist als Nur xhigh (1 bei cacheErhalten). */
  breakEvenFaktor: number;
  /** Nur die zwei Cache-Brüche einer Rückkehr. */
  rueckkehrBrueche: number;
  /** Volle Zusatzkosten einer Rückkehr: Brüche + neuer Plan auf xhigh. */
  rueckkehrGesamt: number;
  /**
   * Ab so vielen Rückkehren fressen allein die Brüche die Ersparnis auf.
   * 0 = keine Ersparnis vorhanden; Infinity = ohne Brüche (cacheErhalten) nie.
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
  const bruch = e.cacheErhalten ? 0 : c * bruchKosten(m, e.ctx);
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
  const bruch = e.cacheErhalten ? 0 : c * bruchKosten(m, e.ctx);

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
