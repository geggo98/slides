/**
 * opusplanMath.ts — Kostenmodell für die opusplan-Break-even-Folie.
 *
 * Datenherkunft der Konstanten: echte Opus→Sonnet-Sessions der eigenen
 * Claude-Code-Historie, 30.08.–29.09.2026 — 57 Sessions, 137 Wechsel
 * Opus→Sonnet, 81 zurück. Extraktion und Rohdaten: data/opusplan-sessions/
 * (extract.py, phases.tsv, switches.tsv, summary.json; die Zahlen unten
 * stehen dort und werden in opusplanMath.test.ts dagegen gehalten). Vorher
 * kam die Exec-Seite aus einem Messfenster über den Wechsel hinweg, weil es zu
 * wenig echte Wechsel gab; jetzt ist sie gemessen.
 * Multiplikatoren: Write 1,25× (5-min-TTL) bzw. 2× (1-h-TTL), Read 0,1× Input
 * (Opus 5.5: 0,05×) — geprüft am 30.09.2026 gegen
 * platform.claude.com/docs/en/about-claude/pricing. In den Daten sind 100 %
 * der Cache-Writes 1-h-Writes, die Default-TTL unten stimmt also.
 * Gerechnet wird per Default mit der 1-h-TTL, siehe DEFAULT_TTL.
 *
 * Bewusste Vereinfachungen (siehe Presenter-Notes der Folie):
 * - input_tokens (~90/Request) ignoriert,
 * - laufende Exec-Cache-Writes pauschal als EXEC_WRITE_PRO_READ je MTok Read
 *   (gepoolt über alle Exec-Phasen), nicht je Phase gemessen — mit Opus 5.5
 *   (Write $8 gegen $4) tragen sie einen großen Teil der Ersparnis,
 * - Re-Plan-Cache-Reads nicht separat bepreist,
 * - Kontext C beim Wiedereintritt als konstant angenommen (Median dort 209k,
 *   beim Erst-Wechsel 179k),
 * - Sonnet braucht für dieselbe Aufgabe womöglich mehr oder weniger Tokens als
 *   Opus — die Sessions enthalten nur die Sonnet-Seite, „Nur Opus“ ist
 *   kontrafaktisch mit denselben Tokens gerechnet.
 *
 * Das Anti-Pattern (Rückkehr in den Plan-Modus) ist hier ein WORST CASE:
 * beide Caches abgelaufen, also zwei volle Brüche. Gemessen ist das die
 * Ausnahme — beide Modelle halten ihren Cache 1 h warm, eine Rückkehr schreibt
 * im Median nur das Delta (5k Tokens, n=81; nur 12 von 81 Rückkehren schreiben
 * mehr als die Hälfte des Kontexts neu). Siehe Notes der Folie.
 *
 * Alle Token-Größen in MTok, alle Kosten in USD; Umrechnung erst am Ende.
 */

export interface Modell {
  /** Input-Listenpreis USD/MTok — Basis für Read und Write (TTL-Faktor) */
  input: number;
  /** Output-Listenpreis USD/MTok */
  output: number;
  /** Read-Faktor auf `input`; ohne Angabe READ_FAKTOR (0,1×) */
  read?: number;
}

/**
 * Die Modelle, auf die `opusplan` in der TUI tatsächlich auflöst: `opus` →
 * Opus 5.5, `sonnet` → Sonnet 5.5 (code.claude.com/docs/en/model-config,
 * Anthropic-API-Zeile, geprüft 30.09.2026; Opus 5.5 verlangt Claude Code
 * v2.1.280). Vorher, bis Anfang September, war es Opus 5 / Sonnet 5 — die
 * Sessions im Archiv enthalten beide Stände (Opus-Phasen: 92 × Opus 5,
 * 45 × Opus 5.5).
 *
 * Opus 5.5: $4 / $20, Cache-Read 0,05× — Fußnote 2 der Preisseite: „Cache hits
 * and refreshes on Claude Opus 5.5 are priced at 0.05x the base input price."
 * Opus 5 kostet $5 / $25 bei 0,1×. Sonnet 5.5 und Sonnet 5 sind preisgleich
 * ($2 / $10): die $2/$10 waren als Einführungspreis bis 31.08.2026
 * angekündigt, die Erhöhung auf $3/$15 wurde gestrichen.
 * Die KV-Cache-Folie in Kapitel 6 rechnet weiter mit Sonnet 4.6 ($3/$15) — dort
 * geht es um die Multiplikatoren, nicht um opusplan.
 *
 * Zum Tokenizer: Opus 4.7+ und Sonnet 5 teilen sich denselben neuen Tokenizer,
 * Sonnet 4.6 nicht (~30 % weniger Tokens für denselben Text). `ctx` ist der
 * Kontext, den die Opus-Seite übergibt, und Sonnet zählt ihn genauso — der
 * Cache-Bruch ist tokenizer-neutral.
 */
export const SONNET: Modell = { input: 2, output: 10 };
export const OPUS: Modell = { input: 4, output: 20, read: 0.05 };

export const READ_FAKTOR = 0.1;
export const TTL_WRITE = { "5min": 1.25, "1h": 2.0 } as const;
export type Ttl = keyof typeof TTL_WRITE;

/**
 * Womit die Folie rechnet, wenn niemand am Schalter dreht.
 *
 * 1 h, nicht 5 min. Claude Code teilt seine Requests in zwei Töpfe, und die
 * TTL hängt am Topf, NICHT an der Interaktivität:
 *
 *   Hauptkonversation  — Deine Turns, `-p`-Läufe und Agent-SDK-Turns
 *                        → 1 h im Claude-Abo im Kontingent, sonst 5 min
 *   alles Übrige       — Subagents, Workflows, Forks, Compaction
 *                        → 5 min, auch im Abo
 *
 * Die opusplan-Rechnung ist eine Hauptkonversation, also 1 h. Wörtlich:
 * „Unless you choose a TTL yourself, Claude Code requests the one-hour TTL
 * only on a Claude subscription within your plan's included usage."
 * (code.claude.com/docs/en/prompt-caching, „Which TTL each request gets",
 * geprüft 01.09.2026.)
 *
 * Zwei Dinge, die man hier leicht falsch begründet:
 * - Der API-Default bleibt 5 min. Die Stunde ist nichts, was die API von sich
 *   aus gibt, sondern was Claude Code anfordert. Die €-Beträge der Folie sind
 *   API-Äquivalente, deshalb steht der 5-min-Schalter weiter daneben.
 * - Der Plan-Modus ist nicht interaktiv-only: `--permission-mode plan` gilt
 *   laut CLI-Referenz auch für `-p`, und das Agent SDK, Subagent-Frontmatter
 *   und Cloud-Sessions kennen ihn ebenfalls. Nur bekommen Subagents dann die
 *   5-min-TTL, weil sie im anderen Topf liegen.
 *
 * Auf 5 min fällt außerdem, wer per API-Key, Usage-Credits oder Cloud-Provider
 * arbeitet, wessen Kontingent erschöpft ist (Claude Code schaltet dann selbst
 * um) oder wessen Admin `promptCacheTtl` org-weit gesetzt hat.
 */
export const DEFAULT_TTL: Ttl = "1h";

/**
 * Anteil des Kontexts, der beim ERSTEN Wechsel Plan → Exec als Write neu
 * anfällt: Median 0,85 über 57 Sessions (Quartile 0,79 / 1,00, jede Session
 * über 0,5) — summary.json, `sitzungen.erster_wechsel_break_share`. Später
 * liegt der Wert bei 0,02 (n=80), weil der Cache des Zielmodells noch warm ist.
 */
export const BREAK_SHARE = 0.85;
/** Wie paretoData.ts: 1 USD = 0,876 € (Stand 21.07.2026) */
export const USD_EUR = 0.876;

/**
 * Laufende Cache-Writes der Exec-Phase je MTok Exec-Cache-Read: 0,0147 —
 * Σ Write / Σ Read über alle Exec-Sessions, summary.json
 * `kontrollrechnung_usd.exec_write_pro_read`. Der Write-Preis des Modells
 * macht den Unterschied: Opus 5.5 $8, Sonnet $4 (1 h).
 */
export const EXEC_WRITE_PRO_READ = 0.0147;

/** Mediane der Plan-Phase pro Session (n=56), in MTok — summary.json `plan_*` */
export const PLAN = { out: 0.03, read: 4.1, write: 0.16 } as const;
/** Median-Output einer erneuten Plan-Phase (Wiedereintritt, n=81), in MTok */
export const REPLAN_OUT = 0.001;

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
  /**
   * Ab so vielen Rückkehren fressen allein die Brüche die Ersparnis auf
   * (0 = keine Ersparnis vorhanden). Strengerer Maßstab als `balkenUeberAb`:
   * der Re-Plan-Output bleibt hier draußen, weil er auch bei „Nur Opus“
   * anfiele — nur die Brüche sind der Preis des Modellwechsels.
   */
  ersparnisWegAb: number;
  /**
   * Ab so vielen Rückkehren liegt der Anti-Pattern-BALKEN über „Nur Opus“.
   * Kleiner als `ersparnisWegAb`, weil der Balken zusätzlich den Re-Plan-Output
   * zu Opus-Preisen trägt, während der „Nur Opus“-Balken gar keine Rückkehren
   * kennt. Beide Zahlen stehen nebeneinander auf der Folie, darum benannt.
   */
  balkenUeberAb: number;
}

export const readPreis = (m: Modell): number =>
  m.input * (m.read ?? READ_FAKTOR);
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

export const execKosten = (
  m: Modell,
  read: number,
  out: number,
  ttl: Ttl = DEFAULT_TTL,
): number =>
  out * m.output +
  read * readPreis(m) +
  read * EXEC_WRITE_PRO_READ * writePreis(m, ttl);

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
    x *
      (readPreis(execModell) +
        ratio * execModell.output +
        EXEC_WRITE_PRO_READ * writePreis(execModell, ttl))
  );
}

export const toEur = (usd: number): number => usd * USD_EUR;

export function szenarien(e: Eingaben): Ergebnis {
  const bruchSonnet = bruchKosten(SONNET, e.ctx, e.ttl);
  const bruchOpus = bruchKosten(OPUS, e.ctx, e.ttl);

  const nurSonnet =
    planKosten(SONNET, e.ttl) +
    execKosten(SONNET, e.execRead, e.execOut, e.ttl);
  const nurOpus =
    planKosten(OPUS, e.ttl) + execKosten(OPUS, e.execRead, e.execOut, e.ttl);
  const opusplan =
    planKosten(OPUS, e.ttl) +
    bruchSonnet +
    execKosten(SONNET, e.execRead, e.execOut, e.ttl);

  const rueckkehrBrueche = bruchOpus + bruchSonnet;
  const rueckkehrGesamt = rueckkehrBrueche + REPLAN_OUT * OPUS.output;
  const antiPattern = opusplan + e.replans * rueckkehrGesamt;

  const ersparnis = nurOpus - opusplan;
  // Ersparnis pro MTok Exec-Read: Read-Delta + anteiliges Output-Delta
  const ratio = e.execOut / e.execRead;
  const proMtokErsparnis =
    readPreis(OPUS) -
    readPreis(SONNET) +
    ratio * (OPUS.output - SONNET.output) +
    EXEC_WRITE_PRO_READ * (writePreis(OPUS, e.ttl) - writePreis(SONNET, e.ttl));
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
    // floor+1 statt ceil: gefragt ist das erste n, bei dem der Balken STRIKT
    // über „Nur Opus“ liegt. ersparnisWegAb fragt „ist die Ersparnis auf?“ (≥)
    // und rundet deshalb auf.
    balkenUeberAb:
      ersparnis > 0 ? Math.floor(ersparnis / rueckkehrGesamt) + 1 : 0,
  };
}
