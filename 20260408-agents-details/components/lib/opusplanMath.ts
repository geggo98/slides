/**
 * opusplanMath.ts — Kostenmodell für die opusplan-Break-even-Folie.
 *
 * Datenherkunft der Konstanten: eigene Claude-Code-Historie (42.802 Requests,
 * 48 Plan-Sessions, Juni–August 2026). BREAK_SHARE aus n=625 beobachteten
 * Cache-Bruch-Events (Median cache_creation/Kontext = 0,93). Preise sind
 * API-Listenpreise wie auf der KV-Cache-Folie: Read 0,1× Input, Write 1,25×
 * (5-min-TTL) bzw. 2× (1-h-TTL, Max-Abo).
 *
 * Bewusste Vereinfachungen (siehe Presenter-Notes der Folie):
 * - input_tokens (~90/Request) ignoriert,
 * - laufende Exec-Cache-Writes weggelassen (fallen in allen Szenarien ähnlich
 *   an; Sonnet-Writes sind billiger → Auslassung ist konservativ pro opusplan),
 * - Re-Plan-Cache-Reads nicht separat bepreist,
 * - Kontext C beim Wiedereintritt als konstant angenommen (Median dort 174k
 *   ≈ Median beim Erst-Wechsel 177k).
 *
 * Alle Token-Größen in MTok, alle Kosten in USD; Umrechnung erst am Ende.
 */

export interface Modell {
  /** Input-Listenpreis USD/MTok — Basis für Read (0,1×) und Write (TTL-Faktor) */
  input: number;
  /** Output-Listenpreis USD/MTok */
  output: number;
}

export const SONNET: Modell = { input: 3, output: 15 };
export const OPUS: Modell = { input: 5, output: 25 };

export const READ_FAKTOR = 0.1;
export const TTL_WRITE = { "5min": 1.25, "1h": 2.0 } as const;
export type Ttl = keyof typeof TTL_WRITE;

/** Anteil des Kontexts, der beim Cache-Bruch als Write neu anfällt (n=625) */
export const BREAK_SHARE = 0.93;
/** Wie paretoData.ts: 1 USD = 0,876 € (Stand 21.07.2026) */
export const USD_EUR = 0.876;

/** Mediane der ersten Plan-Phase pro Session (n=48), in MTok */
export const PLAN = { out: 0.1, read: 7.0, write: 0.36 } as const;
/** Median-Output einer erneuten Plan-Phase (Wiedereintritt), in MTok */
export const REPLAN_OUT = 0.045;

export interface Eingaben {
  /** Kontextgröße beim Modellwechsel, MTok (Median 0,177) */
  ctx: number;
  /** Cache-Read-Volumen der Umsetzungs-Phase, MTok */
  execRead: number;
  /** Output der Umsetzungs-Phase, MTok */
  execOut: number;
  /** Rückkehren in den Plan-Modus ohne vorheriges /compact */
  replans: number;
  ttl: Ttl;
}

export interface Ergebnis {
  /** Szenario-Gesamtkosten in USD */
  nurSonnet: number;
  nurOpus: number;
  opusplan: number;
  antiPattern: number;
  /** Ersparnis opusplan vs. Nur Opus (kann bei kleinem Exec-Volumen negativ sein) */
  ersparnis: number;
  /** Ersparnis relativ zu Nur Opus, in Prozent */
  ersparnisProzent: number;
  /** Der eine Bruch beim Plan→Exec-Wechsel (Kontext als Sonnet-Write) */
  bruchEinmal: number;
  /** Ersparnis pro MTok Exec-Cache-Read (inkl. anteiligem Output) */
  proMtokErsparnis: number;
  /** Break-even: Exec-Cache-Read in MTok, ab dem opusplan billiger ist als Nur Opus */
  breakEvenRead: number;
  /** Nur die zwei Cache-Brüche einer Rückkehr (fairer Maßstab: Re-Plan-Arbeit fiele auch bei Nur Opus an) */
  rueckkehrBrueche: number;
  /** Volle Zusatzkosten einer Rückkehr (Brüche + Re-Plan-Output zu Opus-Preisen) */
  rueckkehrGesamt: number;
  /** Ab so vielen Rückkehren fressen allein die Brüche die Ersparnis auf (0 = keine Ersparnis vorhanden) */
  ersparnisWegAb: number;
}

export const readPreis = (m: Modell): number => m.input * READ_FAKTOR;
export const writePreis = (m: Modell, ttl: Ttl): number =>
  m.input * TTL_WRITE[ttl];

/** Kosten einer Phase: Output + Cache-Read + Cache-Write zum jeweiligen Preis */
export function phasenKosten(
  m: Modell,
  ttl: Ttl,
  out: number,
  read: number,
  write: number,
): number {
  return out * m.output + read * readPreis(m) + write * writePreis(m, ttl);
}

export const planKosten = (m: Modell, ttl: Ttl): number =>
  phasenKosten(m, ttl, PLAN.out, PLAN.read, PLAN.write);

export const execKosten = (m: Modell, read: number, out: number): number =>
  out * m.output + read * readPreis(m);

/** Cache-Bruch: BREAK_SHARE des Kontexts wird auf dem neuen Modell als Write neu berechnet */
export const bruchKosten = (m: Modell, ctx: number, ttl: Ttl): number =>
  BREAK_SHARE * ctx * writePreis(m, ttl);

/** Kostengerade fürs Break-even-Chart: Gesamtkosten bei x MTok Exec-Cache-Read.
 *  Plan- und Exec-Modell getrennt (opusplan plant mit Opus, führt mit Sonnet aus);
 *  Output skaliert mit ratio = execOut/execRead; extra = z. B. der Cache-Bruch. */
export function kostenGerade(
  planModell: Modell,
  execModell: Modell,
  ttl: Ttl,
  ratio: number,
  extra: number,
  x: number,
): number {
  return (
    planKosten(planModell, ttl) +
    extra +
    x * (readPreis(execModell) + ratio * execModell.output)
  );
}

export const toEur = (usd: number): number => usd * USD_EUR;

export function szenarien(e: Eingaben): Ergebnis {
  const bruchSonnet = bruchKosten(SONNET, e.ctx, e.ttl);
  const bruchOpus = bruchKosten(OPUS, e.ctx, e.ttl);

  const nurSonnet =
    planKosten(SONNET, e.ttl) + execKosten(SONNET, e.execRead, e.execOut);
  const nurOpus =
    planKosten(OPUS, e.ttl) + execKosten(OPUS, e.execRead, e.execOut);
  const opusplan =
    planKosten(OPUS, e.ttl) +
    bruchSonnet +
    execKosten(SONNET, e.execRead, e.execOut);

  const rueckkehrBrueche = bruchOpus + bruchSonnet;
  const rueckkehrGesamt = rueckkehrBrueche + REPLAN_OUT * OPUS.output;
  const antiPattern = opusplan + e.replans * rueckkehrGesamt;

  const ersparnis = nurOpus - opusplan;
  // Ersparnis pro MTok Exec-Read: Read-Delta + anteiliges Output-Delta
  const ratio = e.execOut / e.execRead;
  const proMtokErsparnis =
    readPreis(OPUS) - readPreis(SONNET) + ratio * (OPUS.output - SONNET.output);
  const breakEvenRead = bruchSonnet / proMtokErsparnis;

  return {
    nurSonnet,
    nurOpus,
    opusplan,
    antiPattern,
    ersparnis,
    ersparnisProzent: (ersparnis / nurOpus) * 100,
    bruchEinmal: bruchSonnet,
    proMtokErsparnis,
    breakEvenRead,
    rueckkehrBrueche,
    rueckkehrGesamt,
    ersparnisWegAb: ersparnis > 0 ? Math.ceil(ersparnis / rueckkehrBrueche) : 0,
  };
}
