// Datenbasis der beiden Modell-Routing-Charts: DeepSWE-Pass@1 gegen Ø-Kosten
// pro Task. `ModelRoutingPareto.vue` zeigt den letzten Stand, `ModelRoutingHistory.vue`
// klickt durch alle acht.
//
// Herkunft der Zahlen
// -------------------
// Board: https://deepswe.datacurve.ai/ (v1.1, Stand 02.09.2026 laut dem
// `generated_at` der Payload). Maßgeblich ist die in die Seite eingebettete
// SSR-Payload — die Datei unter
// /artifacts/v1.1/leaderboard-live.json ist eine veraltete CDN-Kopie. Am
// 01.09.2026 nachgemessen: sie führt sol zu $8,39 (Preis vor dem 21.08.), luna
// zu $3,03 (vor dem 30.07.), gemini-3.6-flash zu $4,42 (vor der Zählfehler-
// Korrektur) und terra zu $4,95 gegen $3,96 in der SSR-Payload. Der Fehler wäre
// in jede Richtung gegangen — also curl auf die Seite und die
// `$R[n]={model:…}`-Objektliterale parsen, nicht die JSON ziehen.
//
// Die CDN-Kopie hat am 04.09.2026 DENSELBEN `generated_at` wie die SSR-Payload
// (2026-09-03T22:24:37.984682) und ist trotzdem bei 8 von 28 Modellen veraltet.
// `generated_at` taugt dort also NICHT als Frische-Signal — wer die Datei zieht,
// bekommt alte Zahlen mit frischem Datumsstempel. Das ist die gefährlichere
// Fassung der Warnung oben: die Datei sieht aktuell aus.
// (Nebenbei bestätigt dieselbe Datei die 0,42-€-Rechnung für glm-5.3-flash
// weiter unten — sie führt dessen Listenpreis statt des Aktionspreises.)
//
// Auswahlregel: je Modell die BESTE gemessene Konfiguration
// ---------------------------------------------------------
// Höchster Pass@1, bei Gleichstand die billigere Stufe. `bestByScore()` weiter
// unten rechnet es aus, `paretoData.test.ts` verriegelt es gegen die Punkte.
//
// Das Board macht es anders: es nimmt die höchste EFFORT-Stufe. Am 03.09.2026
// im Quellcode nachgesehen, `/assets/live-leaderboard-*.js`:
//
//   _t(s) = [...s].sort((a,b) => V(b.reasoning_effort) - V(a.reasoning_effort))[0]
//   V     = {none:0, minimal:1, low:2, medium:3, high:4, xhigh:5, max:6}
//
// also tatsächlich Effort-Rang, nicht Score. Diese Regel war ein Stellvertreter:
// Solange mehr Aufwand mehr Ergebnis hieß, zeigte sie jedes Modell von seiner
// besten Seite — und genau das braucht die Folie, die empfiehlt, den billigsten
// Frontpunkt zu nehmen, der die Aufgabe löst. Der Stellvertreter hält nicht
// mehr. Gegen alle acht abrufbaren Board-Zustände gerechnet, weichen die beiden
// Regeln in vier Fällen ab, und immer zugunsten der billigeren Stufe:
//
//   claude-fable-5    Board max   69,72 % 18,95 €   best xhigh  69,91 % 11,75 €
//   grok-4.6          Board xhigh 66,74 %  4,82 €   best medium 67,48 %  3,02 €
//   gemini-3.7-flash  Board high  65,27 %  1,91 €   best medium 65,49 %  1,77 €
//   gpt-6-astra       Board max   73,23 % 10,84 €   best xhigh  74,12 %  5,71 €
//
// In drei von vier Fällen ist die billigere Stufe auch die bessere. Bei astra
// kostet die höchste das Doppelte für keine einzige zusätzlich gelöste Aufgabe.
//
// Was die Umstellung NICHT ändert: die Front — in keinem der neun Stände und
// unter keinem Anbieter-Preset. Alle vier Punkte rücken nach links, keiner
// erreicht dabei eine Front. Die Front-Tests sind deshalb unverändert geblieben
// und grün; das ist die maschinelle Fassung dieser Aussage.
//
// Datiert ist die Abweichung, sie gilt nicht rückwirkend: fable-5 ab dem
// 14.06., grok-4.6 ab dem 13.08., gemini-3.7-flash ab dem 13.08. Alle Stände
// sind gegen das Archiv unter `data/deepswe/` nachgerechnet, nicht gegen die
// Erinnerung — `boardArchive.test.ts` tut es bei jedem Testlauf erneut.
//
// Wie nötig das ist, zeigt der 13.08.2026: Das Board hatte an dem Tag ZWEI
// Zustände. Der um 03:56 führt gemini-3.7-flash nur auf `high`, der um 16:11
// auch auf `medium` — und der Stand 14.08. dieses Decks gehört zum zweiten.
// Wer den erstbesten Crawl des Tages nimmt, bekommt 1,91 € statt 1,77 € und
// merkt nichts davon.
//
// Und die Default-Ausblendung ist
// dort hartcodiert:
//
//   mt = new Set(["gpt-5-6-terra","gpt-5-4","grok-4-5","kimi-k2-7-code",
//                 "claude-sonnet-4-6","gemini-3-1-pro-preview","muse-spark-1-1"])
//
// Default = alle Modelle mit best >= 5 % außer diesen sieben. Seit
// gpt-6-astra sind das 21 von 28; dieses Chart zeigt 22 (Default + terra).
//
// Die Stände 1 (v1) stammen aus /artifacts/v1/leaderboard-live.json, die Stände
// 3–5 aus der Git-Historie dieses Charts (75a256c, 099c187, 94e26a2).
//
// Umrechnung durchgehend 1 USD = 0,876 € (Stand 21.07.2026), bewusst über alle
// Stände konstant: die Zeitreihe soll Modell- und Preisbewegungen zeigen, nicht
// Wechselkurs-Rauschen.
//
// Preissenkung gpt-5.6-sol vom 21.08.2026 — nachträglich bestätigt
// ---------------------------------------------------------------
// OpenAI senkte Input von $5 auf $4 (−20 %) und Output von $30 auf $20 (−33 %),
// befristet bis mindestens 21.11.2026. Das Board rechnete die Senkung damals
// noch nicht ein, also hier selbst:
//
//   Output-Anteil alt = 60 014 Tok × $30/Mtok = $1,800
//   Input-Anteil alt  = $8,386 − $1,800       = $6,586
//   neu = 6,586 × 0,8 + 1,800 × 20/30         = $6,469  →  5,67 €   (−22,9 %)
//
// Input, Cached-Input und Cache-Writes fallen alle um 20 %, der Long-Context-
// Zuschlag (> 272 k: 2× Input, 1,5× Output) skaliert mit beiden Raten — die
// Zerlegung ist deshalb exakt, ohne den Cache-Mix zu kennen. Gegenprobe: dieselbe
// Rechnung reproduziert für gpt-5.6-terra aus den Listenpreisen $2/$12 einen
// Uncached-Anteil von 7,5 % gegen 7,4 % bei sol. terra selbst wurde am 21.08.
// nicht gesenkt.
// Das Board hat inzwischen selbst nachgezogen und nennt $6,456 → 5,66 €. Die
// Herleitung lag also einen Cent daneben; der Wert unten ist jetzt der des
// Boards.
//
// DeepSeek-Preiserhöhung vom 16.08.2026
// -------------------------------------
// DeepSeek stellte am 16.08. um 16:00 UTC auf Peak/Off-Peak um und hob die
// Listenpreise dabei kräftig an (V4 Pro Output $0,87 → $3,96/Mtok zur Hauptzeit,
// V4 Flash $0,28 → $1,32). Datacurve rechnete am 21.08. nach — im selben
// Changelog-Eintrag wie die Sol-Senkung. Beim Übernehmen der Sol-Zahl ist das
// hier zunächst untergegangen; korrigiert am 01.09.2026:
//
//   deepseek-v4-pro    $0,24 → $1,666   →  0,21 € → 1,46 €   (×6,9)
//   deepseek-v4-flash  $0,10 → $0,464   →  0,09 € → 0,41 €   (×4,6)
//
// Beide fallen damit von der Front. WICHTIG für die Einordnung: das Board rechnet
// mit den Peak-Raten, off-peak ist die Hälfte — V4 Pro läge dann bei 0,73 €, auch
// dann noch von glm-5.3-flash dominiert.
//
// glm-5.3-flash, neu am 26.08.2026
// --------------------------------
// Erscheinungstag und Board-Aufnahme fallen zusammen. 63 % für 0,21 € — Score und
// Preis exakt der Platz, den deepseek-v4-pro fünf Tage vorher geräumt hat.
// Der Board-Preis ist ein Aktionspreis: Listenpreis $0,15/$0,50 pro Mtok, aktuell
// $0,07/$0,25 (Z.ai, 50 % befristet). Läuft die Aktion aus, verdoppelt sich der
// Punkt auf rund 0,42 € — er bliebe auf der Front, aber knapp hinter
// deepseek-v4-flash. Vor dem nächsten Vortrag nachsehen.
//
// Kosten sind `mean_cost_usd`, nicht `median_cost_usd`
// ----------------------------------------------------
// Jeder Punkt hier ist `mean_cost_usd × 0,876`. Das Board führt beide Spalten,
// und sie liegen weit auseinander — wer die falsche greift, bekommt eine Zahl,
// die plausibel aussieht und je nach Modell 10 bis 20 % danebenliegt.
//
// Gemessen am 04.09.2026 an der SSR-Payload:
//
//   gemini-3.8-flash high   mean $2,3623 → 2,07 €      median $2,1099 → 1,85 €
//   claude-opus-5    max    mean $11,838 → 10,37 €     median $10,4282 → 9,14 €
//   kimi-k2.7-code   —      mean $2,8155 → 2,47 €      median $2,1955 → 1,92 €
//
// Die ersten beiden zeigen, welche Spalte das Deck meint: 2,07 € und 10,37 €
// stehen unten so in den Punkten. Der dritte ist der Fall, an dem das schiefging.
//
// Am 04.09.2026 stand kimi-k2.7-code kurzzeitig auf 1,92 € (Commit 7abde48),
// begründet mit sechs Archivständen. Die Archivstände waren echt, die Spalte
// war falsch: 1,92 € ist kimis Median. Der ursprüngliche Wert 2,47 € war
// richtig und steht wieder da. Zwei Nebenbefunde derselben Fehlersuche kippen
// mit — beide waren als Beleg gemeint und trugen keinen:
//
//   * „Effort-Stufe `low`" — kimis Zeile trägt `reasoning_effort:null`. Das ist
//     kein Datenfehler, sondern ein Modell mit genau EINER Konfiguration
//     (`config:"mini_swe_agent_kimi_k2_7_code_default"`). Von 70 Zeilen ist es
//     die einzige ohne Stufe.
//   * „Die CDN-Kopie ist die Fehlerquelle" — sie führt für kimi $2,8155, also
//     denselben Wert wie die SSR-Payload. Für kimi ist sie unauffällig; die
//     Warnung oben gilt weiter für die acht Modelle, bei denen sie es nicht ist.
//
// Und die Gegenprobe von damals — „die übrigen 25 Modelle stimmen auf den Cent"
// — war in Wahrheit das Gegenteil eines Belegs: Die 25 stimmten, WEIL sie aus
// `mean` kommen. Genau das hätte den einen Ausreißer erklären müssen, statt ihn
// zu bestätigen.
//
// Folge für die Historie: kimi-k2.7-code liegt bei 2,47 € in den Ständen 22.07.
// und 25.07. NICHT auf der Front — dort ist muse-spark-1.1 mit 2,07 € billiger.
// Im Stand v1.1 bleibt es der billigste Punkt, nur eben teurer.

export type Ax = "left" | "right" | "center";

/** Herkunft eines Punkts, wenn ihn eine Preisanpassung verschoben hat. */
export interface Origin {
  x: number; // €/Task vorher
  y?: number; // Pass@1 vorher — weglassen heißt „unverändert" (Normalfall)
  eur: string;
  why: string;
  /** Tooltip-Präfix statt „vorher" — für Ringe, die einen künftigen Stand zeigen. */
  pre?: string;
}

export interface Pt {
  x: number; // €/Task
  y: number; // Pass@1 in Prozent, gerundet wie das Board
  label: string;
  eur: string; // deutsches Zahlenformat für Tooltip und Fadenkreuz-Badge
  ci?: number; // halbes 95-%-Konfidenzintervall in Prozentpunkten
  ax: Ax;
  dy: number;
  /** Zusätzlicher Versatz in x. Ab ~24 px Abstand zieht `leader()` eine Linie. */
  dx: number;
  /** Beschriftung erzwingen (true) oder unterdrücken (false); sonst Chart-Default. */
  lbl?: boolean;
  /**
   * Wer die Beschriftung blockiert. Gilt nur zusammen mit `lbl: false`: Sobald
   * der Anbieter-Filter KEINEN dieser Nachbarn mehr zeigt, ist Platz und die
   * Beschriftung kommt zurück. Gemessen, nicht geschätzt — die Alternative wäre
   * eine Schwelle „ab N Punkten unterdrücken", und die trennt nicht: bei 17
   * sichtbaren Punkten kollidieren dieselben Paare wie bei 20, während Cursor
   * mit 15 sauber bleibt. Es hängt an den Nachbarn, nicht an der Anzahl.
   */
  blockers?: readonly string[];
  old?: Origin;
  sub?: number; // €/Task unter dem Wochenkontingent, +50 % (bis 13.09., nur Stand 7)
  sub25?: number; // dasselbe mit den dauerhaften +25 % ab 14.09.
}

export interface Snapshot {
  id: string;
  /** Kurzform für die Timeline-Station. */
  date: string;
  /** Überschrift des Erklärtexts. */
  title: string;
  /** Was sich an dieser Station geändert hat. */
  note: string;
  /** true = aus Changelog und Nachbarständen rekonstruiert, nicht 1:1 belegt. */
  reconstructed?: boolean;
  pts: Pt[];
}

export const fmt = (v: number) => v.toFixed(2).replace(".", ",");

/** Kompakter Konstruktor — `eur` kann so nicht von `x` abweichen. */
function P(
  label: string,
  x: number,
  y: number,
  ax: Ax = "right",
  dy = 4,
  dx = 0,
  extra: {
    ci?: number;
    lbl?: boolean;
    blockers?: readonly string[];
    old?: Omit<Origin, "eur">;
    sub?: number;
    sub25?: number;
  } = {},
): Pt {
  return {
    label,
    x,
    y,
    eur: fmt(x),
    ax,
    dy,
    dx,
    ci: extra.ci,
    lbl: extra.lbl,
    blockers: extra.blockers,
    sub: extra.sub,
    sub25: extra.sub25,
    old: extra.old ? { ...extra.old, eur: fmt(extra.old.x) } : undefined,
  };
}

/** Denselben Messwert mit anderer Beschriftungs-Platzierung — die beiden Charts
 *  haben unterschiedliche Höhen, dieselbe Position passt nicht in beiden. */
const at = (p: Pt, ax: Ax, dy: number, dx = 0, lbl?: boolean): Pt => ({
  ...p,
  ax,
  dy,
  dx,
  lbl,
});

// ---------------------------------------------------------------------------
// Stand 1 — DeepSWE v1, Board-Stand 20.06.2026 (21 Modelle)
// ---------------------------------------------------------------------------
// Andere Methodik als alles Folgende: Verifikation lief im selben Container wie
// der Agent, das Repo enthielt die vollständige Git-Historie. Wer die Lösung
// las statt sie zu erarbeiten, bekam davon beide Achsen geschenkt — Score zu
// hoch und, weil Lesen kaum Tokens kostet, €/Task zu niedrig. Weder Scores noch
// Kosten sind deshalb mit v1.1 vergleichbar.
// Die fünf billigsten Front-Punkte liegen in einem 40-px-Nest an der Achse —
// dort passt keine Beschriftung, die noch eindeutig zuzuordnen wäre. Sie bleiben
// unbeschriftet (Tooltip); die Aussage der Station steckt in den fünf Modellen
// darüber.
const S_V1: Pt[] = [
  P("minimax-m2.7", 0.62, 0, "right", 14, 0, { lbl: false }),
  P("claude-haiku-4.5", 0.73, 0, "right", -8),
  P("gemini-3-flash", 1.34, 5, "right", 14, 0, { lbl: false }),
  P("gemini-3.1-pro", 1.61, 10, "right", -8, 0, { lbl: false }),
  P("mimo-v2.5-pro", 1.74, 19, "right", 14, 0, { lbl: false }),
  P("qwen3.7-max", 1.86, 18, "right", 26),
  P("gpt-5.4-mini", 1.83, 24, "right", -8, 0, { lbl: false }),
  P("kimi-k2.6", 2.77, 24, "right", 4),
  P("glm-5.2", 3.46, 42, "right", 14),
  P("deepseek-v4-pro", 3.7, 8, "right", 4),
  P("qwen3.6-plus", 3.73, 3, "right", -8),
  P("gpt-5.4", 3.83, 56, "right", -8),
  P("claude-opus-4.6", 4.73, 28, "right", -8),
  P("claude-sonnet-4.6", 4.83, 32, "right", 14),
  P("minimax-m3", 4.88, 20, "right", 4),
  P("grok-build-0.1", 5.78, 13, "right", 4),
  P("gpt-5.5", 5.79, 70, "right", -8),
  P("gemini-3.5-flash", 6.5, 28, "right", -8),
  P("glm-5.1", 6.54, 18, "right", 4),
  // Beide Anthropic-Punkte tragen die Pointe der Station, deshalb erzwungen.
  P("claude-opus-4.8", 11.02, 58, "right", 4, 0, { lbl: true }),
  P("claude-opus-4.7", 15.93, 54, "right", 4, 0, { lbl: true }),
];

// ---------------------------------------------------------------------------
// Stand 2 — DeepSWE v1.1, Start am 15.06.2026 (8 Modelle)
// ---------------------------------------------------------------------------
// Modellliste aus dem Datacurve-Changelog, Werte aus dem frühesten belegten
// Chart-Stand (22.07.). Rekonstruiert: die Startwerte selbst sind nicht
// archiviert, die acht Konfigurationen wurden bis dahin aber nicht neu gefahren.
const S_V11: Pt[] = [
  P("kimi-k2.7-code", 2.47, 31, "right", -8),
  P("claude-sonnet-4.6", 4.84, 30, "right", 14),
  P("gpt-5.4", 4.95, 52, "right", -8),
  P("gpt-5.5", 6.33, 67, "right", -8),
  P("gemini-3.5-flash", 6.43, 37, "right", 14),
  P("gemini-3.1-pro", 8.31, 12, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4, 0, { lbl: true }),
  P("claude-fable-5", 11.75, 70, "left", 4),
];

// ---------------------------------------------------------------------------
// Stand 3 — 22.07.2026 (16 Modelle), Git 75a256c
// ---------------------------------------------------------------------------
// Die gpt-5.6-Familie (10.07.), kimi-k3 (18.07.), grok-4.5 (16.07.) und
// muse-spark-1.1 (14.07.) sind dazugekommen.
const S_0722: Pt[] = [
  P("muse-spark-1.1", 2.07, 53, "right", -6),
  P("grok-4.5", 2.12, 54, "right", -18),
  P("kimi-k2.7-code", 2.47, 31, "right", -10),
  P("gpt-5.6-luna", 2.65, 67, "left", -8),
  P("glm-5.2", 3.43, 44, "right", 4),
  P("kimi-k3", 4.08, 69, "right", 12),
  P("gpt-5.6-terra", 4.33, 70, "center", -11),
  P("claude-sonnet-4.6", 4.84, 30, "right", 12),
  P("gpt-5.4", 4.95, 52, "right", -8),
  P("gpt-5.5", 6.33, 67, "right", 4),
  P("gemini-3.5-flash", 6.43, 37, "right", 4),
  P("gpt-5.6-sol", 7.35, 73, "right", 4),
  P("gemini-3.1-pro", 8.31, 12, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 11.75, 70, "left", 4),
  P("claude-sonnet-5", 23.13, 54, "left", 4),
];

// ---------------------------------------------------------------------------
// Stand 4 — 25.07.2026 (18 Modelle), Git 099c187
// ---------------------------------------------------------------------------
// Claude Opus 5 (25.07.) und Gemini 3.6 Flash (22.07.) neu.
const S_0725: Pt[] = [
  P("muse-spark-1.1", 2.07, 53, "right", -6),
  P("grok-4.5", 2.12, 54, "right", -18),
  P("kimi-k2.7-code", 2.47, 31, "right", -10),
  P("gpt-5.6-luna", 2.65, 67, "left", -8),
  P("gemini-3.6-flash", 3.09, 49, "left", 16),
  P("glm-5.2", 3.43, 44, "right", 4),
  P("kimi-k3", 4.08, 69, "right", 12),
  P("gpt-5.6-terra", 4.33, 70, "center", -11),
  P("claude-sonnet-4.6", 4.84, 30, "right", 12),
  P("gpt-5.4", 4.95, 52, "right", -8),
  P("gpt-5.5", 6.33, 67, "right", 4),
  P("gemini-3.5-flash", 6.43, 37, "right", 4),
  P("gpt-5.6-sol", 7.35, 73, "right", -8),
  P("gemini-3.1-pro", 8.31, 12, "right", 4),
  P("claude-opus-5", 10.37, 74, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 11.75, 70, "left", 4),
  P("claude-sonnet-5", 23.13, 54, "left", 4),
];

// ---------------------------------------------------------------------------
// Stand 5 — 30.07.2026 (18 Modelle), Git 94e26a2
// ---------------------------------------------------------------------------
// Kein neues Modell, nur Preise: OpenAI senkt luna um 80 % und terra um 20 %.
// Beide wandern waagerecht nach links und verdrängen dabei muse-spark-1.1,
// grok-4.5 und kimi-k3 von der Front.
const S_0730: Pt[] = [
  P("gpt-5.6-luna", 0.53, 67, "right", 16, 0, {
    old: { x: 2.65, why: "OpenAI-Preissenkung 30.07.: −80 %" },
  }),
  P("muse-spark-1.1", 2.07, 53, "right", 8),
  P("grok-4.5", 2.12, 54, "right", -6),
  P("kimi-k2.7-code", 2.47, 31, "right", -10),
  P("gemini-3.6-flash", 3.09, 49, "left", 16),
  P("glm-5.2", 3.43, 44, "right", 4),
  P("gpt-5.6-terra", 3.47, 70, "right", -14, 0, {
    old: { x: 4.33, why: "OpenAI-Preissenkung 30.07.: −20 %" },
  }),
  // Der prominenteste der drei verdrängten Punkte — die Station erzählt genau das.
  P("kimi-k3", 4.08, 69, "right", 14, 0, { lbl: true }),
  P("claude-sonnet-4.6", 4.84, 30, "right", 12),
  P("gpt-5.4", 4.95, 52, "right", -8),
  P("gpt-5.5", 6.33, 67, "right", 4),
  P("gemini-3.5-flash", 6.43, 37, "right", 4),
  P("gpt-5.6-sol", 7.35, 73, "right", -8),
  P("gemini-3.1-pro", 8.31, 12, "right", 4),
  P("claude-opus-5", 10.37, 74, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 11.75, 70, "left", 4),
  P("claude-sonnet-5", 23.13, 54, "left", 4),
];

// ---------------------------------------------------------------------------
// Stand 6 — 14.08.2026 (24 Modelle)
// ---------------------------------------------------------------------------
// Zwei Wochen Neuzugänge (qwen3.8-max 04.08., deepseek-v4-flash 06.08.,
// muse-spark-1.2 07.08., deepseek-v4-pro + grok-4.6 12.08., gemini-3.7-flash
// 13.08.) plus zwei Abrechnungskorrekturen am 13./14.08.: LiteLLM hatte
// Gemini-Tokens doppelt gezählt, DeepSeek V4 Pro war doppelt rabattiert
// abgerechnet. Die drei Gemini-Modelle wurden dabei neu gefahren, ihre Scores
// verschieben sich deshalb um bis zu zwei Punkte mit.
// Rekonstruiert: identisch zum heutigen Board, aber ohne glm-5.3 und mit sol
// zum alten Preis.
const S_0814: Pt[] = [
  // Der Punkt bei 9 Cent liegt so dicht an der Achse, dass jede Beschriftung in
  // einen Nachbarmarker läuft — der Erklärtext nennt beide DeepSeek-Preise,
  // hier reicht der Tooltip.
  P("deepseek-v4-flash", 0.09, 53, "right", 24, 0, { lbl: false }),
  P("deepseek-v4-pro", 0.21, 63, "right", 14),
  P("gpt-5.6-luna", 0.53, 67, "right", -8),
  P("gemini-3.1-pro", 1.88, 12, "right", 14, 0, {
    old: { x: 8.3, why: "Token-Zählfehler korrigiert, Re-Run 13.08." },
  }),
  P("gemini-3.7-flash", 1.77, 65, "right", 14),
  P("gemini-3.6-flash", 1.94, 47, "right", 6, 60, {
    old: { x: 3.09, y: 49, why: "Token-Zählfehler korrigiert, Re-Run 13.08." },
  }),
  P("muse-spark-1.1", 2.07, 53, "right", -8),
  P("grok-4.5", 2.12, 54, "right", -20),
  P("kimi-k2.7-code", 2.47, 31, "right", -10),
  P("gemini-3.5-flash", 3.02, 36, "right", 32, 0, {
    old: { x: 6.43, y: 37, why: "Token-Zählfehler korrigiert, Re-Run 13.08." },
  }),
  P("muse-spark-1.2", 3.24, 55, "right", 14),
  P("qwen3.8-max", 3.27, 57, "right", -6),
  P("glm-5.2", 3.43, 44, "right", 4),
  P("gpt-5.6-terra", 3.47, 70, "left", -16, -20),
  P("kimi-k3", 4.08, 69, "right", 16),
  P("grok-4.6", 3.02, 67, "right", -8),
  P("claude-sonnet-4.6", 4.84, 30, "right", 12),
  P("gpt-5.4", 4.95, 52, "right", -8),
  P("gpt-5.5", 6.33, 67, "right", 12),
  P("gpt-5.6-sol", 7.35, 73, "right", -10, 10),
  P("claude-opus-5", 10.37, 74, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 11.75, 70, "left", 4),
  P("claude-sonnet-5", 23.13, 54, "left", 4),
];

// ---------------------------------------------------------------------------
// Stand 7 — 26.08.2026 (Board-Default + gpt-5.6-terra, 20 Modelle)
// ---------------------------------------------------------------------------
// Board-Stand 26.08. Das Board blendet per Default sieben von 26 Modellen aus;
// gpt-5.6-terra ist hier wieder eingeblendet, weil es bestellbar ist und auf der
// Front liegt. Die übrigen sechs (grok-4.5, muse-spark-1.1, gpt-5.4, kimi-k2.7-code,
// claude-sonnet-4.6, gemini-3.1-pro) bleiben nur auf der Historien-Folie
// stehen — dort geht es um Bewegung, hier um den aktuellen Stand.
//
// Zwei Bewegungen gegenüber dem 14.08., beide vom Board übernommen: die beiden
// DeepSeek-Punkte sind durch die Preiserhöhung vom 16.08. nach rechts gewandert
// und von der Front gefallen, glm-5.3-flash ist am 26.08. neu dazugekommen —
// auf 0,21 € und 63 %, also Pixel für Pixel dem Platz, den deepseek-v4-pro
// geräumt hat. Bewusst OHNE `old`-Geisterringe: der Ring von deepseek-v4-pro
// läge exakt unter dem neuen glm-5.3-flash-Marker, und der Pfeil sähe dann so
// aus, als sei glm-5.3-flash teurer geworden. Die Wanderung steht im Stationstext
// und im ⓘ-Dialog, nicht im Chart.
//
// `sub`/`sub25` = Kosten unter dem Claude-Code-Wochenkontingent. Modell:
// Abo-Preis fix, Wochenlimit bindend ⇒ €/Task ∝ 1/Kontingent. Basis = 100 %.
// Bis 13.09.2026 läuft die +50-%-Aktion (`sub`, ×2/3), ab 14.09. ersetzt
// Anthropic sie durch dauerhafte +25 % (`sub25`, ×0,8). Kein API-Preis, deshalb
// per Toggle abschaltbar.
// Sieben Modelle drängen sich zwischen 1,9 € und 4,9 € — terra und glm-5.3
// liegen 3 Cent und einen Punkt auseinander, auf dem Canvas rund ein Pixel.
// Deren Beschriftungen sitzen deshalb versetzt und bekommen eine Führungslinie
// (`leader()` ab ~24 px Versatz), sonst wäre nicht zu erkennen, welches Label zu
// welchem Marker gehört. Dasselbe gilt jetzt am billigen Ende: glm-5.3-flash,
// deepseek-v4-flash und luna liegen innerhalb von 12 px nebeneinander.
const S_0826: Pt[] = [
  P("glm-5.3-flash", 0.21, 63, "right", 14, 0, { ci: 4.4 }),
  // Beide DeepSeek-Punkte bleiben unbeschriftet — wie schon der 9-Cent-Punkt in
  // Stand 6. Sie sind nach der Preiserhöhung zwischen glm-5.3-flash, luna und
  // das 3-€-Gedränge gerutscht; jede Platzierung ihrer 15 bzw. 17 Zeichen läuft
  // dort in einen Nachbarmarker oder ein Nachbarlabel. Sie sind dominiert, die
  // Wanderung steht im Folientext, und der Tooltip nennt sie weiterhin.
  P("deepseek-v4-flash", 0.41, 53, "right", 8, 0, {
    ci: 3.6,
    lbl: false,
    blockers: ["muse-spark-1.2"],
  }),
  P("gpt-5.6-luna", 0.53, 67, "right", -8, 0, { ci: 4.0 }),
  P("deepseek-v4-pro", 1.46, 63, "right", 14, 0, {
    ci: 6.3,
    lbl: false,
    blockers: ["glm-5.3-flash", "qwen3.8-max"],
  }),
  P("gemini-3.7-flash", 1.77, 65, "right", 8, 0, { ci: 1.8 }),
  P("gemini-3.6-flash", 1.94, 47, "right", 0, 0, { ci: 3.7 }),
  P("gemini-3.5-flash", 3.02, 36, "right", 12, 0, { ci: 4.0 }),
  P("muse-spark-1.2", 3.24, 55, "right", 14, 0, { ci: 2.1 }),
  P("qwen3.8-max", 3.27, 57, "right", -6, 0, { ci: 2.7 }),
  P("glm-5.2", 3.43, 44, "right", 12, 0, { ci: 1.7 }),
  P("gpt-5.6-terra", 3.47, 70, "right", -14, 120, { ci: 2.6 }),
  P("glm-5.3", 3.5, 69, "right", 46, 34, { ci: 3.0 }),
  P("kimi-k3", 4.08, 69, "right", -14, -4, { ci: 4.5 }),
  // Zwischen Sol-Marker (oben), qwen3.8-max-Label (links) und gpt-5.5-Marker
  // (rechts) bleibt keine freie Zeile — das Label geht mit Führungslinie in die
  // leere Fläche rechts unterhalb.
  P("grok-4.6", 3.02, 67, "right", 32, 34, { ci: 2.2 }),
  P("gpt-5.6-sol", 5.66, 73, "right", -14, 20, {
    ci: 2.8,
    old: { x: 7.35, why: "OpenAI-Preissenkung 21.08.: −20 % / −33 %" },
  }),
  P("gpt-5.5", 6.33, 67, "right", 14, 0, { ci: 6.5 }),
  // dy so gewählt, dass das Label auch mit eingeschaltetem Abo-Overlay (Punkt
  // wandert auf 6,91 €, Geisterring auf 8,30 €) nicht in den Sol-Geisterring
  // läuft.
  // dx bleibt 0, obwohl das Label seit gpt-6-astra (10,84 €/73 %) optisch eher
  // unter dessen Marker sitzt als unter dem eigenen: `dx: -45` zentriert es
  // zwar richtig, schiebt es mit eingeschaltetem Overlay aber auf den
  // gpt-5.5-Marker — gemessen, nicht vermutet. Die Zuordnung übernimmt
  // stattdessen die Führungslinie von astra, das weit nach oben rechts
  // ausweicht.
  P("claude-opus-5", 10.37, 74, "right", 20, 0, {
    ci: 3.9,
    sub: 6.91,
    sub25: 8.3,
  }),
  P("claude-opus-4.8", 11.58, 59, "right", 4, 0, {
    ci: 1.8,
    sub: 7.72,
    sub25: 9.26,
  }),
  P("claude-fable-5", 11.75, 70, "left", 4, 0, {
    ci: 4.0,
    sub: 7.83,
    sub25: 9.4,
  }),
  P("claude-sonnet-5", 23.13, 54, "left", 4, 0, {
    ci: 4.2,
    sub: 15.42,
    sub25: 18.5,
  }),
];

// Stand 7 der Historie: dieselben Messwerte, plus die sechs vom Board
// ausgeblendeten Modelle — auf der Historien-Folie soll kein einmal gemessenes
// Modell verschwinden, sonst liest sich die Ausblendung wie ein Rückzug.
// Die Platzierungen sind eigene: das Historien-Chart ist flacher, und es
// beschriftet nur Front, Wanderung und ausdrücklich markierte Punkte.
const HIST_PLACE: Record<string, [Ax, number, number?, boolean?]> = {
  "glm-5.3-flash": ["right", 14],
  "deepseek-v4-flash": ["right", 24, 0, false], // siehe Kommentar bei Stand 6
  "deepseek-v4-pro": ["right", 14, 0, false],
  "gpt-5.6-luna": ["right", -8],
  "gpt-5.6-terra": ["left", -16, -20],
  "glm-5.3": ["right", 22, 30, true],
  "gpt-5.6-sol": ["right", -10, 10],
  "claude-opus-5": ["right", 4],
};

const S_0826_HIST: Pt[] = [
  ...S_0826,
  P("gemini-3.1-pro", 1.88, 12, "right", 4),
  P("muse-spark-1.1", 2.07, 53, "right", -8),
  P("grok-4.5", 2.12, 54, "right", -20),
  P("kimi-k2.7-code", 2.47, 31, "right", -10),
  P("claude-sonnet-4.6", 4.84, 30, "right", 12),
  P("gpt-5.4", 4.95, 52, "right", -8),
]
  .map((p) => {
    const pl = HIST_PLACE[p.label];
    return pl ? at(p, pl[0], pl[1], pl[2] ?? 0, pl[3]) : p;
  })
  .sort((a, b) => a.x - b.x);

// ---------------------------------------------------------------------------
// Stand 8 — 02.09.2026 (Board-Default + gpt-5.6-terra, 21 Modelle)
// ---------------------------------------------------------------------------
// Eine einzige Zeile hat sich im Board geändert: Changelog „Sep 1, 2026 — Added
// Gemini 3.8 Flash results." Das Artefakt trägt `generated_at`
// 2026-09-02T15:18:19Z — deshalb sah die Messung vom 01.09. es noch nicht. Alle
// 26 bisherigen Modelle sind auf den Cent unverändert; Stand 8 wird deshalb aus
// Stand 7 abgeleitet statt abgeschrieben. Was gleich bleibt, kann so nicht
// versehentlich abweichen.
//
// Der Neuzugang ist der höchste Punkt des ganzen Boards — roh, nicht nur
// gerundet (73,83 % gegen 73,65 % bei Opus 5) — und hat mit ±1,4 den engsten
// Fehlerbalken im Feld. Für 2,07 € statt 10,37 €. Damit fallen terra, sol und
// Opus 5 von der Front; übrig bleiben drei Punkte statt fünf. Opus 5 fällt auch
// mit eingeschaltetem Kontingent-Overlay (6,91 € bzw. 8,30 € bei gleichem
// Score) — der Toggle rechnet die Front mit.
//
// WICHTIG für die Einordnung: Nach dem eigenen Kriterium („weniger als 5 Punkte
// Abstand = gleichauf") sind gemini-3.8-flash, Opus 5 und sol auf dem Score
// gleichauf. Der Unterschied ist der Preis, nicht die Qualität.
//
// Geisterring statt Sol-Pfeil
// ---------------------------
// Der Board-Preis ist ein Einführungspreis: Google nimmt bis 31.12.2026
// $0,75/$3,75/$0,075 pro Mtok (Input/Output/Cache) und ab 01.01.2027 exakt das
// Doppelte. Alle drei Raten verdoppeln sich, also verdoppelt sich der Punkt:
// 2,3623 × 2 × 0,876 = 4,14 €. Gegenprobe, dass das Board wirklich auf den
// Aktionsraten rechnet:
//
//   0,278 M Input (unc.) × $0,75  = $0,209
//  21,456 M Cache        × $0,075 = $1,609
//   0,143 M Output       × $3,75  = $0,537
//                          Summe  = $2,355   gegen $2,362 gemeldet
//
// Zum Listenpreis bliebe der Punkt auf der Front — dann hinter terra, das
// zurückkäme. Deshalb der Ring: er zeigt, dass der Befund die Verdopplung
// überlebt.
//
// Sol verliert hier sein `old`. Die Senkung vom 21.08. ist die Pointe von
// Stand 7 und steht dort weiter; auf der aktuellen Folie lägen beide Pfeile auf
// derselben Höhe (py(74) = 29,7 gegen py(73) = 32,9, also 3 px auseinander) und
// zeigten beide nach links — zwei gestrichelte Waagerechte, die wie eine
// aussehen. So bedeutet der eine verbliebene Ring eindeutig einen KÜNFTIGEN
// Stand, nicht eine vergangene Wanderung.
const withoutSolGhost = (p: Pt): Pt =>
  p.label === "gpt-5.6-sol" ? { ...p, old: undefined } : p;

const S_0902: Pt[] = [
  ...S_0826.map(withoutSolGhost),
  P("gemini-3.8-flash", 2.07, 74, "right", -10, 0, {
    ci: 1.4,
    old: {
      x: 4.14,
      pre: "ab 01.01.",
      why: "Einführungspreis endet am 31.12.2026 — Listenpreis ist das Doppelte",
    },
  }),
].sort((a, b) => a.x - b.x);

// Historien-Variante: eigene Platzierung (flacheres Chart) und OHNE den
// Zukunfts-Ring. Die Historie zeigt, was war — ein Ring, der auf 2027 zeigt,
// läse sich dort als vergangene Wanderung. Gleiche Entscheidung wie bei
// glm-5.3-flash in Stand 7.
const S_0902_HIST: Pt[] = [
  ...S_0826_HIST.map(withoutSolGhost),
  P("gemini-3.8-flash", 2.07, 74, "right", 14, 0, { ci: 1.4 }),
].sort((a, b) => a.x - b.x);

// ---------------------------------------------------------------------------
// Stand 9 — 03.09.2026 (Board-Default + gpt-5.6-terra, 22 Modelle)
// ---------------------------------------------------------------------------
// Board-Payload `generated_at` 2026-09-03T22:24:37.984682. Der Stand ist gegen
// den archivierten Board-Zustand vom 02.09. (Stand 8, `generated_at`
// 2026-09-02T15:18:19Z) gediffed, nicht abgeschrieben. Ergebnis des Diffs:
//
//   nur heute:     gpt-6-astra, fünf Effort-Zeilen
//   verschwunden:  —
//   geändert:      —
//
// Kein Score, kein Preis, keine Zeile sonst. Deshalb ist Stand 9 wieder aus
// Stand 8 abgeleitet: was gleich bleibt, kann so nicht versehentlich abweichen.
//
// DIE FRONT BLEIBT: glm-5.3-flash, luna, gemini-3.8-flash. Der Neuzugang ist
// dominiert — und das ist die Pointe der Station, nicht ihr Nebensatz.
//
// gpt-6-astra: der teuerste Punkt der Folie, und trotzdem dominiert
// -----------------------------------------------------------------
// Dieses Chart zeigt je Modell die BESTE gemessene Konfiguration (siehe Kopf
// dieser Datei), das Board die höchste Effort-Stufe. Bei astra fallen die
// beiden zum ersten Mal weit auseinander:
//
//   low     67,04 %  303/452  ±1,30   1,92 €
//   medium  72,79 %  329/452  ±2,59   3,84 €
//   high    73,23 %  331/452  ±3,42   5,01 €
//   xhigh   74,12 %  335/452  ±2,87   5,71 €   ← hier geplottet, bester Score
//   max     73,23 %  331/452  ±0,83  10,84 €   ← das Board zeigt DIESE Zeile
//
// `xhigh` ist besser UND billiger als `max`, und `high` löst dieselben 331
// Aufgaben wie `max` für die Hälfte. Die höchste Stufe ist hier also die
// schlechteste Wahl in beiden Achsen — genau der Fall, an dem die alte Regel
// zerbrochen ist.
//
// Und die Pointe der Station: Auch mit seiner besten Konfiguration erreicht
// astra die Front NICHT. 74,12 % ist der höchste Rohwert des ganzen Boards,
// aber gemini-3.8-flash steht bei 73,83 % — auf ganze Prozent gerundet, wie
// dieses Chart es tut, sind das beide 74 %, und gemini kostet 2,07 € statt
// 5,71 €. Die 0,29 Punkte Unterschied liegen tief in den Konfidenzintervallen
// (±2,87 gegen ±1,42). Wer der Empfehlung dieser Folie folgt — den billigsten
// Frontpunkt nehmen, der die Aufgabe löst —, landet nicht bei astra.
//
// Preisvorbehalt: astra ist das EINZIGE Modell des Boards mit einem
// `cost_basis`-Feld, und dort steht „Expected launch pricing at all context
// lengths: $12/M uncached input, $15/M cache writes, $1.20/M cache reads,
// $50/M output, $2/M compute units." Das sind angekündigte, nicht abgerechnete
// Preise — die Position „compute units" gibt es bei keinem anderen Modell.
// Deshalb KEIN Geisterring: ein Ring behauptet einen zweiten, bekannten Preis.
// Hier ist der eine bekannte Preis selbst vorläufig, und das gehört in den
// Text, nicht in die Geometrie.
//
// Platzierung: astra (5,71 €/74 %) liegt fast auf gpt-5.6-sol (5,66 €/73 %) —
// 2 px daneben und 3 px darüber, die Marker überlappen. Dieselbe Lage wie bei
// gpt-5.6-terra/glm-5.3 (3,47 € und 3,50 €), und dieselbe Lösung: Das Label
// weicht in die leere Fläche über 74 % aus, `leader()` zieht ab ~24 px die
// Linie dahin. Nach jeder Änderung hier: pareto-label-qa.ts.
const S_0903: Pt[] = [
  ...S_0902,
  P("gpt-6-astra", 5.71, 74, "center", 0, -16, { ci: 0.83 }),
].sort((a, b) => a.x - b.x);

// `lbl: true` wie bei kimi-k3 in Stand 5: Das Historien-Chart beschriftet sonst
// nur Front und Wanderung, und astra ist beides nicht — es ist dominiert und
// bewegt sich nicht. Genau das IST aber die Aussage der Station, und ohne
// Beschriftung sieht niemand, welcher der 28 Punkte der Neuzugang ist.
const S_0903_HIST: Pt[] = [
  ...S_0902_HIST,
  P("gpt-6-astra", 5.71, 74, "center", 0, -14, { ci: 0.83, lbl: true }),
].sort((a, b) => a.x - b.x);

export const SNAPSHOTS: Snapshot[] = [
  {
    id: "v1",
    date: "v1 · Juni",
    title: "Erste Runde",
    note: "gpt-5.5 führt mit 70 %, alles andere bleibt unter 60 %. Anthropics bestes Modell kommt auf 58 % für 11 €. Opus 4.7 holte rund 18 % seiner Treffer per `git log --all`: Im Task-Container des Benchmarks lag die Musterlösung — abgeschrieben statt gelöst. Score zu hoch, Tokens und damit gemessene Kosten zu niedrig.",
    pts: S_V1,
  },
  {
    id: "v11",
    date: "15.06.",
    title: "v1.1: strengere Verifikation",
    note: "Die Verifikation zieht aus dem Task-Container aus, das Repo kommt nur noch als Shallow Clone ohne die Lösungs-Commits. Acht Modelle, dieselben 113 Tasks, an der Spitze dieselbe Reihenfolge.",
    reconstructed: true,
    pts: S_V11,
  },
  {
    id: "0722",
    date: "22.07.",
    title: "Die gpt-5.6-Familie kommt",
    note: "luna, terra und sol besetzen die Front zwischen 2,65 € und 7,35 €. Dazu kimi-k3, grok-4.5 und muse-spark-1.1. Anthropic ist auf der Front nicht vertreten.",
    pts: S_0722,
  },
  {
    id: "0725",
    date: "25.07.",
    title: "Opus 5 steigt ein",
    note: "74 % für 10,37 € — erstmals liegt ein Claude-Modell auf der Front. Der Vorsprung auf sol beträgt einen Punkt bei ±3 bis ±4 Punkten Konfidenzintervall.",
    pts: S_0725,
  },
  {
    id: "0730",
    date: "30.07.",
    title: "Preise, keine Releases",
    note: "OpenAI senkt luna um 80 % und terra um 20 %. Beide wandern waagerecht nach links und verdrängen muse-spark-1.1, grok-4.5 und kimi-k3 von der Front — ohne dass sich ein einziger Score geändert hat.",
    pts: S_0730,
  },
  {
    id: "0814",
    date: "14.08.",
    title: "Sechs Neuzugänge, zwei Korrekturen",
    note: "In zwei Wochen kommen sechs Modelle dazu, darunter zwei von DeepSeek für 9 und 21 Cent — die Front bekommt ein billiges Ende. Parallel korrigiert Datacurve zwei Abrechnungsfehler im DeepSWE-Benchmark: Gemini-Tokens doppelt gezählt, DeepSeek V4 Pro doppelt rabattiert. Die drei Gemini-Punkte wandern dadurch nach links, ohne die Front zu berühren — geändert hatte sich nicht das Modell, sondern die Rechnung des Benchmarks.",
    reconstructed: true,
    pts: S_0814,
  },
  {
    id: "0826",
    date: "26.08.",
    title: "Der billige Boden wechselt den Besitzer",
    note: "Am billigen Ende passieren zwei Dinge, die einander fast aufheben. DeepSeek stellt am 16.08. auf Peak/Off-Peak um und hebt die Preise an; das Board rechnet am 21.08. nach, und beide DeepSeek-Punkte wandern von 9 und 21 Cent auf 41 Cent und 1,46 € — von der Front gefallen, ohne dass sich ein Score geändert hätte. Fünf Tage später kommt glm-5.3-flash und landet auf 63 % für 21 Cent: exakt der Platz, den deepseek-v4-pro geräumt hat. Dazu wird sol um 23 % billiger und rückt von Opus 5 weg — für dessen einen Punkt Vorsprung zahlst Du jetzt rund 80 % Aufpreis statt rund 40 %. Fünf Punkte auf der Front, von 21 Cent bis 10,37 €.",
    pts: S_0826_HIST,
  },
  {
    id: "0902",
    date: "02.09.",
    title: "Die halbe Front verschwindet",
    note: "Ein einziger Neuzugang räumt drei der fünf Frontpunkte ab. gemini-3.8-flash kommt am 01.09. auf 74 % für 2,07 € — derselbe Score wie Opus 5 zu einem Fünftel des Preises, und mit ±1,4 der engste Fehlerbalken im Feld. terra, sol und Opus 5 sind damit dominiert; übrig bleiben glm-5.3-flash, luna und der Neuzugang. Gleichauf heißt dabei wirklich gleichauf: Nach dem eigenen 5-Punkte-Kriterium liegen gemini-3.8-flash, Opus 5 und sol auf einem Niveau — was sich geändert hat, ist der Preis, nicht die Qualität. Kein anderes Modell hat sich bewegt, kein Preis wurde korrigiert.",
    pts: S_0902_HIST,
  },
  {
    id: "0903",
    date: "03.09.",
    title: "Die Front hält",
    note: "Ein Neuzugang, und diesmal passiert nichts. gpt-6-astra kommt auf 73 % für 10,84 € und ist damit gleich doppelt dominiert: von gemini-3.8-flash (74 % für 2,07 €) und von Opus 5, das bei gleichem Score 47 Cent WENIGER kostet. Die Front bleibt Zeichen für Zeichen dieselbe — glm-5.3-flash, luna, gemini-3.8-flash. Interessant ist, warum der Punkt so weit rechts liegt: Das Board zeigt je Modell die höchste Effort-Stufe, und astras höchste ist seine schlechteste. Auf `high` löst es dieselben 331 von 452 Aufgaben für 5,01 € statt 10,84 €, auf `xhigh` sogar 335 — der höchste Rohwert des ganzen Boards — für 5,71 €. Nach dieser Regel läge astra auf der Front. Die Front hängt hier also an einer Auswahlregel, nicht an den Modellen. Und der Preis ist ohnehin vorläufig: astra ist der einzige Eintrag, den das Board mit „expected launch pricing“ ausweist.",
    pts: S_0903_HIST,
  },
];

/** Der Stand, den die Hauptfolie zeigt. */
export const CURRENT: Pt[] = S_0903;

// ---------------------------------------------------------------------------
// Effort-Stufen — die Auswahlregel nachrechenbar machen
// ---------------------------------------------------------------------------
// Bis Stand 8 stand die Board-Regel („höchste Effort-Stufe je Modell") nur als
// Satz im Kopf dieser Datei. Mit gpt-6-astra reicht das nicht mehr: Dort ist die
// gezeigte Stufe von einer eigenen, billigeren geschlagen, und die Front sähe
// unter einer anderen Regel anders aus. Eine Behauptung dieser Größe gehört
// gerechnet, nicht geschrieben.
//
// Deshalb hier ALLE 63 Konfigurationen der 22 gezeigten Modelle, so wie die
// SSR-Payload sie am 03.09.2026 führt. Vollständig und nicht nur die vier
// auffälligen: Nur so lässt sich `bestByEffort()` gegen `CURRENT` verriegeln —
// der Test, der beweist, dass diese Tabelle dieselbe Quelle meint wie die
// Punkte oben.
//
// `y` ist hier der ROHwert, nicht auf ganze Prozent gerundet wie in `Pt`. Die
// interessanten Abstände liegen unter einem Prozentpunkt: astra trennt `xhigh`
// von `max` um 0,89 Punkte, und gerundet wären beide 73 %.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface Cfg {
  /** Modellname wie im Chart. */
  label: string;
  effort: Effort;
  /** Pass@1 in Prozent, ungerundet. */
  y: number;
  /** halbes 95-%-Konfidenzintervall in Prozentpunkten. */
  ci: number;
  /** €/Task, mit demselben Kurs wie alle Punkte oben. */
  x: number;
}

const C = (
  label: string,
  effort: Effort,
  y: number,
  ci: number,
  x: number,
): Cfg => ({
  label,
  effort,
  y,
  ci,
  x,
});

export const EFFORTS: readonly Cfg[] = [
  C("claude-fable-5", "low", 59.58, 2.79, 3.29),
  C("claude-fable-5", "medium", 65.37, 4.42, 5.33),
  C("claude-fable-5", "high", 68.6, 1.12, 8.04),
  C("claude-fable-5", "xhigh", 69.91, 3.24, 11.75),
  C("claude-fable-5", "max", 69.72, 4.03, 18.95),
  C("claude-opus-4.8", "low", 40.8, 1.46, 2.01),
  C("claude-opus-4.8", "medium", 48.67, 2.24, 3.02),
  C("claude-opus-4.8", "high", 51.77, 4.56, 3.75),
  C("claude-opus-4.8", "xhigh", 54.36, 3.71, 7.01),
  C("claude-opus-4.8", "max", 58.97, 1.76, 11.58),
  C("claude-opus-5", "low", 58.13, 2.33, 1.46),
  C("claude-opus-5", "medium", 68.9, 1.17, 2.88),
  C("claude-opus-5", "high", 72.83, 1.95, 5.32),
  C("claude-opus-5", "xhigh", 73.15, 3.06, 7.95),
  C("claude-opus-5", "max", 73.65, 3.87, 10.37),
  C("claude-sonnet-5", "medium", 39.78, 3.13, 3.57),
  C("claude-sonnet-5", "high", 48.23, 4.51, 6.5),
  C("claude-sonnet-5", "xhigh", 49.67, 3.45, 10.42),
  C("claude-sonnet-5", "max", 53.85, 4.24, 23.13),
  C("deepseek-v4-flash", "max", 53.32, 3.57, 0.41),
  C("deepseek-v4-pro", "max", 62.83, 6.33, 1.46),
  C("gemini-3.5-flash", "high", 36.06, 3.97, 3.02),
  C("gemini-3.6-flash", "high", 46.68, 3.7, 1.94),
  C("gemini-3.7-flash", "low", 53.76, 2.59, 1.61),
  C("gemini-3.7-flash", "medium", 65.49, 3.09, 1.77),
  C("gemini-3.7-flash", "high", 65.27, 1.79, 1.91),
  C("gemini-3.8-flash", "medium", 71.02, 2.28, 1.72),
  C("gemini-3.8-flash", "high", 73.83, 1.42, 2.07),
  C("glm-5.2", "high", 36.28, 4.75, 2.48),
  C("glm-5.2", "max", 43.78, 1.73, 3.43),
  C("glm-5.3", "max", 68.96, 3.02, 3.5),
  C("glm-5.3-flash", "max", 63.39, 4.38, 0.21),
  C("gpt-5.5", "low", 26.99, 2.29, 1.05),
  C("gpt-5.5", "medium", 53.98, 2.55, 2.41),
  C("gpt-5.5", "high", 64.38, 3.12, 4.47),
  C("gpt-5.5", "xhigh", 67.04, 6.47, 6.33),
  C("gpt-5.6-luna", "low", 1.55, 0.83, 0.01),
  C("gpt-5.6-luna", "medium", 11.28, 0.83, 0.04),
  C("gpt-5.6-luna", "high", 44.25, 2.92, 0.14),
  C("gpt-5.6-luna", "xhigh", 56.86, 2.17, 0.27),
  C("gpt-5.6-luna", "max", 67.19, 3.99, 0.53),
  C("gpt-5.6-sol", "low", 45.35, 2.39, 0.72),
  C("gpt-5.6-sol", "medium", 61.06, 1.58, 1.24),
  C("gpt-5.6-sol", "high", 69.4, 1.43, 2.33),
  C("gpt-5.6-sol", "xhigh", 70.73, 0.82, 3.15),
  C("gpt-5.6-sol", "max", 72.67, 2.83, 5.66),
  C("gpt-5.6-terra", "low", 24.05, 0.78, 0.3),
  C("gpt-5.6-terra", "medium", 35.11, 3.38, 0.41),
  C("gpt-5.6-terra", "high", 53.76, 4.33, 0.79),
  C("gpt-5.6-terra", "xhigh", 60.18, 2.12, 1.49),
  C("gpt-5.6-terra", "max", 69.62, 2.56, 3.47),
  C("gpt-6-astra", "low", 67.04, 1.3, 1.92),
  C("gpt-6-astra", "medium", 72.79, 2.59, 3.84),
  C("gpt-6-astra", "high", 73.23, 3.42, 5.01),
  C("gpt-6-astra", "xhigh", 74.12, 2.87, 5.71),
  C("gpt-6-astra", "max", 73.23, 0.83, 10.84),
  C("grok-4.6", "low", 41.65, 2.32, 0.91),
  C("grok-4.6", "medium", 67.48, 2.28, 3.02),
  C("grok-4.6", "high", 65.19, 1.53, 3.84),
  C("grok-4.6", "xhigh", 66.74, 2.18, 4.82),
  C("kimi-k3", "max", 68.51, 4.54, 4.08),
  C("muse-spark-1.2", "xhigh", 54.87, 2.12, 3.24),
  C("qwen3.8-max", "xhigh", 57.46, 2.66, 3.27),
];

/** Effort-Rang wie im Board-Bundle (`/assets/live-leaderboard-*.js`). */
const RANG: Record<Effort, number> = {
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
};

/**
 * Die Board-Regel: je Modell die höchste Effort-Stufe. Steht hier als Beleg,
 * nicht als Auswahl — dieses Chart benutzt `bestByScore()`.
 */
export function bestByEffort(cfgs: readonly Cfg[] = EFFORTS): Cfg[] {
  const best = new Map<string, Cfg>();
  for (const c of cfgs) {
    const da = best.get(c.label);
    if (!da || RANG[c.effort] > RANG[da.effort]) best.set(c.label, c);
  }
  return [...best.values()].sort((a, b) => a.x - b.x);
}

/**
 * Die Regel dieses Charts: je Modell die BESTE gemessene Konfiguration —
 * höchster Pass@1, bei Gleichstand die billigere. Reproduziert `CURRENT` bis
 * auf die Rundung; `paretoData.test.ts` prüft genau das.
 *
 * Sie ist per Konstruktion nie selbst-dominiert: nichts desselben Modells hat
 * einen höheren Score, und bei gleichem Score ist nichts billiger. Genau das
 * macht sie zur richtigen Grundlage für die Empfehlung auf der Folie — wer die
 * Front hochsteigt, soll auf jeder Sprosse das Beste bekommen, was das Modell
 * hergibt, und nicht die teuerste Einstellung.
 */
export function bestByScore(cfgs: readonly Cfg[] = EFFORTS): Cfg[] {
  const best = new Map<string, Cfg>();
  for (const c of cfgs) {
    const da = best.get(c.label);
    if (!da || c.y > da.y || (c.y === da.y && c.x < da.x)) best.set(c.label, c);
  }
  return [...best.values()].sort((a, b) => a.x - b.x);
}

/** Konfigurationen eines Modells, die keine andere desselben Modells schlägt. */
export function ownFront(label: string, cfgs: readonly Cfg[] = EFFORTS): Cfg[] {
  const meins = cfgs.filter((c) => c.label === label).sort((a, b) => a.x - b.x);
  const out: Cfg[] = [];
  let bestY = -Infinity;
  for (const c of meins)
    if (c.y > bestY) {
      out.push(c);
      bestY = c.y;
    }
  return out;
}

export interface SelfDom {
  label: string;
  /** Was das Board zeigt. */
  gezeigt: Cfg;
  /** Die billigste eigene Stufe, die mindestens so gut ist. */
  besser: Cfg;
  /** €/Task, die die Board-Regel liegen lässt. */
  spart: number;
  /** dasselbe in Prozent des gezeigten Preises. */
  prozent: number;
}

/**
 * Modelle, deren GEZEIGTE Stufe von einer eigenen, billigeren geschlagen wird —
 * gleicher oder höherer Score für weniger Geld. Das ist der Kern des
 * Effort-Overlays: nicht „billiger ist schlechter", sondern „die Regel greift
 * bei diesen Modellen daneben".
 */
export function selfDominated(cfgs: readonly Cfg[] = EFFORTS): SelfDom[] {
  return bestByEffort(cfgs)
    .flatMap((gezeigt) => {
      const besser = cfgs
        .filter(
          (c) =>
            c.label === gezeigt.label && c.y >= gezeigt.y && c.x < gezeigt.x,
        )
        .sort((a, b) => a.x - b.x)[0];
      if (!besser) return [];
      const spart = gezeigt.x - besser.x;
      return [
        {
          label: gezeigt.label,
          gezeigt,
          besser,
          spart,
          prozent: (100 * spart) / gezeigt.x,
        },
      ];
    })
    .sort((a, b) => b.spart - a.spart);
}

/**
 * Front über ALLE Konfigurationen statt über eine je Modell — die Antwort auf
 * „was, wenn man die beste statt der höchsten Stufe nimmt".
 *
 * `boden` ist redaktionell und nötig: Ohne ihn besteht das billige Ende aus
 * entarteten Punkten, die zwar pareto-optimal, als Empfehlung aber unsinnig
 * sind — gpt-5.6-luna auf `low` erreicht 1,55 % für einen Cent. 60 % ist die
 * Höhe, ab der das Hauptchart überhaupt Frontpunkte hat (glm-5.3-flash, 63 %).
 */
export function configFront(boden = 60, cfgs: readonly Cfg[] = EFFORTS): Cfg[] {
  const out: Cfg[] = [];
  let bestY = -Infinity;
  for (const c of [...cfgs]
    .filter((c) => c.y >= boden)
    .sort((a, b) => a.x - b.x))
    if (c.y > bestY) {
      out.push(c);
      bestY = c.y;
    }
  return out;
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------
// Welches Labor hinter einem Modellnamen steckt. Die Präfixregeln sind 1:1 die
// des Boards (`/assets/stats-*.js`, Funktion `B()`) — bewusst abgeschrieben und
// nicht selbst erfunden, damit die Zuordnung dieselbe ist wie dort. Vier Fälle
// errät man sonst falsch: `muse-` ist Meta, `glm-` ist Zhipu, `mimo-` ist
// Xiaomi, `composer-` ist Cursor.
//
// Die Reihenfolge ist Teil der Regel: das Board prüft `gpt-` zuerst. Für die
// heutigen Namen ist das folgenlos, aber ein künftiges „gpt-oss-qwen" landete so
// bei OpenAI und nicht bei Alibaba — genau wie dort.

export type Lab =
  | "OpenAI"
  | "Anthropic"
  | "Google"
  | "xAI"
  | "Meta"
  | "Zhipu"
  | "Moonshot"
  | "DeepSeek"
  | "Mistral"
  | "Alibaba"
  | "Xiaomi"
  | "MiniMax"
  | "Cursor"
  | "Andere";

const LAB_PREFIXES: ReadonlyArray<readonly [string, Lab]> = [
  ["gpt-", "OpenAI"],
  ["o1-", "OpenAI"],
  ["o3-", "OpenAI"],
  ["o4-", "OpenAI"],
  ["claude-", "Anthropic"],
  ["gemini-", "Google"],
  ["grok-", "xAI"],
  ["muse-", "Meta"],
  ["glm-", "Zhipu"],
  ["kimi-", "Moonshot"],
  ["deepseek-", "DeepSeek"],
  ["mistral-", "Mistral"],
  ["mimo-", "Xiaomi"],
  ["minimax", "MiniMax"],
  ["qwen", "Alibaba"],
  ["composer-", "Cursor"],
];

export function labOf(label: string): Lab {
  const l = label.toLowerCase();
  for (const [prefix, lab] of LAB_PREFIXES) if (l.includes(prefix)) return lab;
  return "Andere";
}

// ---------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------

export interface ScaleOpts {
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  B: number;
  xMax: number;
  yMax: number;
}

export interface Scale extends ScaleOpts {
  px: (v: number) => number;
  py: (v: number) => number;
}

export function makeScale(o: ScaleOpts): Scale {
  return {
    ...o,
    px: (v) => o.L + (v / o.xMax) * (o.W - o.L - o.R),
    py: (v) => o.H - o.B - (v / o.yMax) * (o.H - o.T - o.B),
  };
}

/**
 * Teilt die Punkte in Pareto-Front und dominierte auf. Die Front ist nach x
 * aufsteigend sortiert, damit die Polyline sie ohne Zickzack verbindet.
 */
export function paretoFront(pts: Pt[]): { front: Pt[]; dom: Pt[] } {
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const front: Pt[] = [];
  const dom: Pt[] = [];
  let bestY = -Infinity;
  for (const p of sorted) {
    if (p.y > bestY) {
      front.push(p);
      bestY = p.y;
    } else {
      dom.push(p);
    }
  }
  return { front, dom };
}

export const anchor = (p: Pt) =>
  p.ax === "center" ? "middle" : p.ax === "left" ? "end" : "start";

export const ldx = (p: Pt) =>
  p.ax === "center" ? 0 : p.ax === "left" ? -9 : 9;

/** Ankerpunkt der Beschriftung in Chart-Koordinaten. */
export const lx = (p: Pt, s: Scale) => s.px(p.x) + ldx(p) + p.dx;
export const ly = (p: Pt, s: Scale) => s.py(p.y) + p.dy;

/**
 * Führungslinie Marker → Beschriftung, sobald das Label so weit abgesetzt ist,
 * dass die Zuordnung sonst raten wäre. Nötig im Gedränge zwischen 2 € und 5 €,
 * wo Marker teils einen Pixel auseinanderliegen. Die Linie setzt 7 px hinter dem
 * Marker an und endet 3 px vor dem Text.
 */
export function leader(p: Pt, s: Scale) {
  return leaderLine(s.px(p.x), s.py(p.y), lx(p, s), ly(p, s));
}

/**
 * Dieselbe Linie für frei berechnete Label-Positionen (Detailmodus der
 * Historien-Folie, der die Beschriftungen selbst platziert).
 */
export function leaderLine(ox: number, oy: number, tx: number, ly_: number) {
  const ty = ly_ - 3; // grob auf die Mittelhöhe der Zeile
  const len = Math.hypot(tx - ox, ty - oy);
  if (len < 24) return null;
  const ux = (tx - ox) / len;
  const uy = (ty - oy) / len;
  return {
    x1: ox + ux * 7,
    y1: oy + uy * 7,
    x2: tx - ux * 3,
    y2: ty - uy * 3,
  };
}

export const tip = (p: Pt) =>
  `${p.label}: ${p.y} %${p.ci ? ` ± ${fmt(p.ci).replace(",00", "")}` : ""} · ${p.eur} €/Task` +
  (p.old ? ` (${p.old.pre ?? "vorher"} ${p.old.eur} €)` : "");

export interface MovedSeg {
  label: string;
  eur: string;
  /** Tooltip-Präfix, siehe `Origin.pre` — „vorher“, wenn nichts gesetzt ist. */
  pre: string;
  why: string;
  gx: number;
  gy: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  head: string;
}

/**
 * Wanderung durch eine Preisanpassung: Geisterring an der alten Position,
 * gestrichelte Linie zur neuen, Pfeilspitze am Ziel. Die Strecke setzt 6 px
 * hinter dem Geisterring an und endet 9 px vor dem Marker, damit weder Ring
 * noch Punkt überzeichnet werden.
 *
 * `to` erlaubt eine abweichende Zielposition (Abo-Overlay: der Punkt wandert,
 * der Geisterring bleibt am API-Preis stehen).
 */
export function movedSegments(
  pts: Pt[],
  s: Scale,
  pick: (p: Pt) => Origin | undefined = (p) => p.old,
  to: (p: Pt) => { x: number; y: number } = (p) => ({ x: p.x, y: p.y }),
): MovedSeg[] {
  return pts.flatMap((p) => {
    const o = pick(p);
    if (!o) return [];
    const t = to(p);
    const gx = s.px(o.x);
    const gy = s.py(o.y ?? p.y);
    const tx = s.px(t.x);
    const ty = s.py(t.y);
    const len = Math.hypot(tx - gx, ty - gy) || 1;
    const ux = (tx - gx) / len;
    const uy = (ty - gy) / len;
    const x2 = tx - ux * 9;
    const y2 = ty - uy * 9;
    const bx = x2 - ux * 8;
    const by = y2 - uy * 8;
    return [
      {
        label: p.label,
        eur: o.eur,
        pre: o.pre ?? "vorher",
        why: o.why,
        gx,
        gy,
        x1: gx + ux * 6,
        y1: gy + uy * 6,
        x2,
        y2,
        head: `${x2},${y2} ${bx - uy * 4},${by + ux * 4} ${bx + uy * 4},${by - ux * 4}`,
      },
    ];
  });
}
