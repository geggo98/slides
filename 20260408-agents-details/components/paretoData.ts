// Datenbasis der beiden Modell-Routing-Charts: DeepSWE-Pass@1 gegen Ø-Kosten
// pro Task. `ModelRoutingPareto.vue` zeigt den letzten Stand, `ModelRoutingHistory.vue`
// klickt durch alle sieben.
//
// Herkunft der Zahlen
// -------------------
// Board: https://deepswe.datacurve.ai/ (v1.1, Stand 20.08.2026). Maßgeblich ist
// die in die Seite eingebettete SSR-Payload — die Datei unter
// /artifacts/v1.1/leaderboard-live.json ist eine veraltete CDN-Kopie, deren
// mean_cost_usd die Preiskorrekturen vom 30.07. und 14.08. NICHT enthält.
// Auswahlregel „Best" wie auf dem Board: höchste verfügbare Effort-Stufe je
// Modell (nicht der höchste Score — grok-4.6 liegt auf medium höher als auf
// xhigh). Mit dieser Regel reproduziert die Extraktion die Board-Tabelle exakt.
//
// Die Stände 1 (v1) stammen aus /artifacts/v1/leaderboard-live.json, die Stände
// 3–5 aus der Git-Historie dieses Charts (75a256c, 099c187, 94e26a2).
//
// Umrechnung durchgehend 1 USD = 0,876 € (Stand 21.07.2026), bewusst über alle
// Stände konstant: die Zeitreihe soll Modell- und Preisbewegungen zeigen, nicht
// Wechselkurs-Rauschen.
//
// Preissenkung gpt-5.6-sol vom 21.08.2026
// ---------------------------------------
// OpenAI senkte Input von $5 auf $4 (−20 %) und Output von $30 auf $20 (−33 %),
// befristet bis mindestens 21.11.2026. Das Board rechnet die Senkung noch nicht
// ein, also hier selbst:
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

export type Ax = "left" | "right" | "center";

/** Herkunft eines Punkts, wenn ihn eine Preisanpassung verschoben hat. */
export interface Origin {
  x: number; // €/Task vorher
  y?: number; // Pass@1 vorher — weglassen heißt „unverändert" (Normalfall)
  eur: string;
  why: string;
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
  old?: Origin;
  sub?: number; // €/Task unter dem Claude-Code-Wochenkontingent (nur Stand 7)
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
    old?: Omit<Origin, "eur">;
    sub?: number;
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
    sub: extra.sub,
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
// der Agent, das Repo enthielt die vollständige Git-Historie. Scores sind
// deshalb NICHT mit v1.1 vergleichbar.
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
  P("gemini-3.1-pro", 8.3, 12, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4, 0, { lbl: true }),
  P("claude-fable-5", 18.95, 70, "left", 4),
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
  P("gemini-3.1-pro", 8.3, 12, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 18.95, 70, "left", 4),
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
  P("gemini-3.1-pro", 8.3, 12, "right", 4),
  P("claude-opus-5", 10.37, 74, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 18.95, 70, "left", 4),
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
  P("gemini-3.1-pro", 8.3, 12, "right", 4),
  P("claude-opus-5", 10.37, 74, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 18.95, 70, "left", 4),
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
  P("gemini-3.7-flash", 1.91, 65, "right", 14),
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
  P("grok-4.6", 4.82, 67, "right", -8),
  P("claude-sonnet-4.6", 4.84, 30, "right", 12),
  P("gpt-5.4", 4.95, 52, "right", -8),
  P("gpt-5.5", 6.33, 67, "right", 12),
  P("gpt-5.6-sol", 7.35, 73, "right", -10, 10),
  P("claude-opus-5", 10.37, 74, "right", 4),
  P("claude-opus-4.8", 11.58, 59, "right", 4),
  P("claude-fable-5", 18.95, 70, "left", 4),
  P("claude-sonnet-5", 23.13, 54, "left", 4),
];

// ---------------------------------------------------------------------------
// Stand 7 — 21.08.2026 (Board-Default + gpt-5.6-terra, 19 Modelle)
// ---------------------------------------------------------------------------
// Board-Stand 20.08. (glm-5.3 als 25. Modell dazu) plus die Sol-Preissenkung
// vom 21.08. Das Board blendet per Default sieben Modelle aus; gpt-5.6-terra
// ist hier wieder eingeblendet, weil es bestellbar ist und auf der Front läge.
// Die übrigen sechs (grok-4.5, muse-spark-1.1, gpt-5.4, kimi-k2.7-code,
// claude-sonnet-4.6, gemini-3.1-pro) bleiben nur auf der Historien-Folie
// stehen — dort geht es um Bewegung, hier um den aktuellen Stand.
//
// `sub` = Kosten unter dem Claude-Code-Wochenkontingent (13.05.–31.08.2026,
// +50 % Wochenlimit). Modell: Abo-Preis fix, Wochenlimit bindend ⇒
// €/Task ∝ 1/Kontingent ⇒ ×2/3. Kein API-Preis, deshalb per Toggle abschaltbar.
// Sieben Modelle drängen sich zwischen 1,9 € und 4,9 € — terra und glm-5.3
// liegen 3 Cent und einen Punkt auseinander, auf dem Canvas rund ein Pixel.
// Deren Beschriftungen sitzen deshalb versetzt und bekommen eine Führungslinie
// (`leader()` ab ~24 px Versatz), sonst wäre nicht zu erkennen, welches Label zu
// welchem Marker gehört.
const S_0821: Pt[] = [
  P("deepseek-v4-flash", 0.09, 53, "right", 8, 0, { ci: 3.6 }),
  P("deepseek-v4-pro", 0.21, 63, "right", 14, 0, { ci: 6.3 }),
  P("gpt-5.6-luna", 0.53, 67, "right", -8, 0, { ci: 4.0 }),
  P("gemini-3.7-flash", 1.91, 65, "right", 8, 0, { ci: 1.8 }),
  P("gemini-3.6-flash", 1.94, 47, "right", 0, 0, { ci: 3.7 }),
  P("gemini-3.5-flash", 3.02, 36, "right", 12, 0, { ci: 4.0 }),
  P("muse-spark-1.2", 3.24, 55, "right", 14, 0, { ci: 2.1 }),
  P("qwen3.8-max", 3.27, 57, "right", -6, 0, { ci: 2.7 }),
  P("glm-5.2", 3.43, 44, "right", 12, 0, { ci: 1.7 }),
  P("gpt-5.6-terra", 3.47, 70, "right", -24, 0, { ci: 2.6 }),
  P("glm-5.3", 3.5, 69, "right", 46, 34, { ci: 3.0 }),
  P("kimi-k3", 4.08, 69, "right", -14, -4, { ci: 4.5 }),
  // Zwischen Sol-Marker (oben), qwen3.8-max-Label (links) und gpt-5.5-Marker
  // (rechts) bleibt keine freie Zeile — das Label geht mit Führungslinie in die
  // leere Fläche rechts unterhalb.
  P("grok-4.6", 4.82, 67, "right", 32, 34, { ci: 2.2 }),
  P("gpt-5.6-sol", 5.67, 73, "right", -14, 20, {
    ci: 2.8,
    old: { x: 7.35, why: "OpenAI-Preissenkung 21.08.: −20 % / −33 %" },
  }),
  P("gpt-5.5", 6.33, 67, "right", 14, 0, { ci: 6.5 }),
  // dy so gewählt, dass das Label auch mit eingeschaltetem Abo-Overlay (Punkt
  // wandert auf 6,91 €) nicht in den Sol-Geisterring läuft.
  P("claude-opus-5", 10.37, 74, "right", 20, 0, { ci: 3.9, sub: 6.91 }),
  P("claude-opus-4.8", 11.58, 59, "right", 4, 0, { ci: 1.8, sub: 7.72 }),
  P("claude-fable-5", 18.95, 70, "left", 4, 0, { ci: 4.0, sub: 12.63 }),
  P("claude-sonnet-5", 23.13, 54, "left", 4, 0, { ci: 4.2, sub: 15.42 }),
];

// Stand 7 der Historie: dieselben Messwerte, plus die sechs vom Board
// ausgeblendeten Modelle — auf der Historien-Folie soll kein einmal gemessenes
// Modell verschwinden, sonst liest sich die Ausblendung wie ein Rückzug.
// Die Platzierungen sind eigene: das Historien-Chart ist flacher, und es
// beschriftet nur Front, Wanderung und ausdrücklich markierte Punkte.
const HIST_PLACE: Record<string, [Ax, number, number?, boolean?]> = {
  "deepseek-v4-flash": ["right", 24, 0, false], // siehe Kommentar bei Stand 6
  "deepseek-v4-pro": ["right", 14],
  "gpt-5.6-luna": ["right", -8],
  "gpt-5.6-terra": ["left", -16, -20],
  "glm-5.3": ["right", 22, 30, true],
  "gpt-5.6-sol": ["right", -10, 10],
  "claude-opus-5": ["right", 4],
};

const S_0821_HIST: Pt[] = [
  ...S_0821,
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

export const SNAPSHOTS: Snapshot[] = [
  {
    id: "v1",
    date: "v1 · Juni",
    title: "Erste Runde",
    note: "gpt-5.5 führt mit 70 %, alles andere bleibt unter 60 %. Anthropics bestes Modell kommt auf 58 % für 11 €. Bei Opus 4.7 stammten rund 18 % der Treffer aus `git log --all` — der Container enthielt die Lösung.",
    pts: S_V1,
  },
  {
    id: "v11",
    date: "15.06.",
    title: "v1.1: strengere Verifikation",
    note: "Die Verifikation zieht in einen eigenen Container um, das Repo kommt nur noch als Shallow Clone ohne die Lösungs-Commits. Acht Modelle, dieselben 113 Tasks, an der Spitze dieselbe Reihenfolge.",
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
    id: "0821",
    date: "21.08.",
    title: "Heutiger Stand",
    note: "glm-5.3 kommt auf 69 % und verfehlt die Front um drei Cent. sol wird um 23 % billiger und schiebt sich näher an Opus 5. Sechs Punkte auf der Front, von 9 Cent bis 10,37 €.",
    pts: S_0821_HIST,
  },
];

/** Der Stand, den die Hauptfolie zeigt. */
export const CURRENT: Pt[] = S_0821;

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
  const ox = s.px(p.x);
  const oy = s.py(p.y);
  const tx = lx(p, s);
  const ty = ly(p, s) - 3; // grob auf die Mittelhöhe der Zeile
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
  (p.old ? ` (vorher ${p.old.eur} €)` : "");

export interface MovedSeg {
  label: string;
  eur: string;
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
