<script setup lang="ts">
/**
 * DeadlineOutcomeViz.vue — Überlast aus Kundensicht: Was wird aus den
 * Anfragen, je nach Gegenmaßnahme? Eine Zeile je Situation, per Klick
 * aufgedeckt (Prop `step`, aus der Folie `:step="$clicks"`; ohne Prop sind
 * alle Zeilen sichtbar).
 *
 *   0 Online, ohne Maßnahme      alles im Timeout
 *   1 Back Pressure / Shedding   Kapazitätsanteil rechtzeitig, Rest abgewiesen
 *   2 Feature Shedding …         alles rechtzeitig, wenn es reicht
 *   3 Batch, gedrosselt          Kapazitätsanteil sofort, Rest später
 *   4 Online + Batch gemeinsam   Online im Timeout, Batch verdrängt Online
 *   5 Workload Separation        Online rechtzeitig, nur Batch gedrosselt
 *   6 Jitter für Batch-Starts    gleiche Arbeit, kleinere Spitze
 *
 * Mit `lenses` (Monitoring-Deck) folgen auf die sieben Zeilen weitere
 * Klicks, je einer pro Sicht (LENS_KEYS): Dieselben Zeilen, gesehen durch
 * ein Dashboard, das Schritt für Schritt eine Fehlerkonvention, die Dauer,
 * den Messpunkt am Load Balancer, eine Metrik für degradierte Antworten
 * und das Label workload dazubekommt. Die Farbe eines Segments ist dann,
 * was das Panel daraus macht; rechts steht der Wert eines Stat-Panels.
 * Die Leiste oben springt per Slidev-Navigation zur Sicht (`nav.go`),
 * damit Presenter- und Publikumsfenster synchron bleiben.
 *
 * Alle Zahlen kommen aus lib/deadlineOutcomes.ts (Fluid-Rechnung, getestet
 * in shared/__tests__/deadlineOutcomes.test.ts). Die Online-Zahlen sind die
 * der Rabattaktion aus der SRE-Simulation „Wandernde Engpässe“.
 *
 * Alle Balken stehen auf einer Skala (barScale: volle Breite = 1.000
 * req/s), der Kapazitätsstrich für 300 liegt also in jeder Zeile an
 * derselben Stelle. Die gemischten Zeilen (400 req/s) sind entsprechend
 * kürzer; ihre Segmente tragen nur die Klasse (ohne Label: die Menge), die
 * Ausgänge stehen rechts neben dem Balken.
 *
 * Farbfamilien wie PipelineViz im Monitoring-Deck (grün, orange, rot,
 * blau), die Töne aber für Text auf der Füllung angepasst: hell 700er-Töne
 * mit weißer Schrift, dunkel 400er-Töne mit dunkler Schrift (Kontrast
 * jeweils ≥ 4,5:1). Die Bedeutung ist eine eigene, siehe Legende. Timeout
 * ist zusätzlich schraffiert, damit Rot/Grün nicht allein über die Farbe
 * getrennt wird (Streifen gemessen: hell 5,2:1, dunkel 4,6:1). Die
 * Jitter-Spuren sind neutral grau: Blau heißt in der Legende „später“.
 * Im Dunkelmodus ist „abgewiesen“ orange-400 statt amber: Das gelbe Panel
 * „eingeschränkt“ wäre sonst kaum davon zu trennen (ΔE2000 5).
 * In den Sichten kommen dazu: Fehler (rot, ohne Schraffur), degradiert
 * (türkis), nicht gezählt (grau schraffiert, gestrichelt umrandet), und
 * ein violetter Randbalken für Zeilen, deren Panel anders alarmiert als die
 * Kundensicht (Violett kommt sonst nicht vor).
 *
 * Aufdecken per v-show: Die Erläuterung steht unter der zuletzt
 * aufgedeckten Zeile, der Endzustand ist also der höchste — dort auf
 * Überlauf prüfen; mit `lenses` jede Sicht (Klick 6–12), weil Legende und
 * Erläuterung je Sicht wechseln. Einbinden: im Deck global registrieren (setup/main.ts,
 * Slidev auto-importiert shared/ nicht); die Folie braucht `clicks: 6`
 * (mit `lenses`: 6 + Sichten − 1) und `:step="$clicks"`, das prüft
 * shared/__tests__/deadlineOutcomes.test.ts.
 */
import { computed } from "vue";
import {
  useDarkMode,
  useIsSlideActive,
  useNav,
  useSlideContext,
} from "@slidev/client";
import {
  JITTER_JOB_MIN,
  JITTER_JOBS,
  LENS_KEYS,
  MIXED_BATCH,
  MIXED_CAPACITY,
  MIXED_ONLINE,
  ROW_KEYS,
  SIM_CAPACITY,
  SIM_CAPACITY_FS,
  SIM_DEMAND,
  barScale,
  deviatesFromCustomer,
  jitterProfiles,
  lensPanel,
  lensSegments,
  mixedShared,
  outcomeRows,
  rowFlows,
  type LensKey,
  type PanelTone,
  type RowKey,
  type ViewKind,
  type ViewSegment,
} from "./lib/deadlineOutcomes";

const props = withDefaults(defineProps<{ step?: number; lenses?: boolean }>(), {
  step: Number.POSITIVE_INFINITY,
  lenses: false,
});

const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

type CaptionPart = string | { code: string };
interface RowText {
  title: string;
  sub: string;
  lead: string;
  caption: CaptionPart[];
}

const shared = mixedShared(MIXED_ONLINE, MIXED_BATCH, MIXED_CAPACITY);

// Formulierungen aus dem Faktencheck („Formulierungsvorschläge“); Zahlen aus
// der Rechnung, damit Text und Balken nicht auseinanderlaufen.
const TEXT: Record<RowKey, RowText> = {
  unprotected: {
    title: "Online, ohne Maßnahme",
    sub: `${fmt(SIM_DEMAND)} req/s auf ${fmt(SIM_CAPACITY)} Kapazität`,
    lead: "Ohne Maßnahme:",
    caption: [
      "Die Wartezeit wächst über die Deadline. Der Server arbeitet weiter, aber für Antworten, auf die niemand mehr wartet. Bei genug Überlast kommt keine Anfrage mehr durch.",
    ],
  },
  shed: {
    title: "Back Pressure / Load Shedding",
    sub: `Annahme begrenzt auf ${fmt(SIM_CAPACITY)} req/s`,
    lead: "Back Pressure / Load Shedding:",
    caption: [
      "Was angenommen wird, ist schnell fertig; der Überschuss wird sofort abgewiesen (429/503), statt in den Timeout zu laufen.",
    ],
  },
  enough: {
    title: "Feature Shedding, Cache, Scaling",
    sub: `${fmt(SIM_DEMAND)} req/s auf ${fmt(SIM_CAPACITY_FS)} Kapazität`,
    lead: "Alle Kunden in der Deadline",
    caption: [
      `nur, wenn die Arbeit pro Anfrage sinkt (Feature Shedding, Cache), die Kapazität steigt (Scaling) oder andere Last weicht (etwa Batch) – und nur, wenn das reicht und rechtzeitig greift. Hier: Seiten ohne Empfehlungen, die DB schafft ${fmt(SIM_CAPACITY_FS)} statt ${fmt(SIM_CAPACITY)}\u00a0req/s.`,
    ],
  },
  batch: {
    title: "Batch, gedrosselt",
    sub: `${fmt(SIM_DEMAND)} req/s auf ${fmt(SIM_CAPACITY)} Kapazität`,
    lead: "Batch:",
    caption: [
      "Kein Mensch wartet, aber es gibt ein Fertigstellungsfenster: drosseln statt abweisen und den Rückstand später abarbeiten.",
    ],
  },
  mixedShared: {
    title: "Online + Batch, gemeinsam",
    sub: `${fmt(MIXED_ONLINE)} + ${fmt(MIXED_BATCH)} req/s auf ${fmt(MIXED_CAPACITY)}`,
    lead: "Mixed Load ohne Trennung:",
    caption: [
      `Online allein (${fmt(MIXED_ONLINE)}\u00a0req/s) passt in die Kapazität (${fmt(MIXED_CAPACITY)}). Mit Batch wächst die gemeinsame Queue: Alle Online-Anfragen laufen in den Timeout, ${fmt(shared.onlineServedLate)}\u00a0req/s Kapazität gehen an Antworten, auf die niemand mehr wartet.`,
    ],
  },
  mixedSeparated: {
    title: "Workload Separation",
    sub: "Online zuerst, Batch nimmt den Rest",
    lead: "Workload Separation:",
    caption: [
      "Online und Batch getrennt behandeln – logisch (Priorität je Anfrage, eigene Thread-Pools und Limits) oder physisch (eigene, anders konfigurierte Instanzen). Gedrosselt oder abgewiesen wird nur Batch.",
    ],
  },
  jitter: {
    title: "Jitter für Batch-Starts",
    sub: `${JITTER_JOBS.length} Jobs à ${JITTER_JOB_MIN} min`,
    lead: "Jitter:",
    caption: [
      "Batch-Starts verteilen (Jenkins ",
      { code: "H" },
      ", systemd ",
      { code: "RandomizedDelaySec" },
      "): gleiche Arbeit, kleinere Spitze – aber keine zusätzliche Kapazität. Online wählt der Kunde den ersten Zeitpunkt; Jitter bleibt dort für Retries und Arbeit, auf die er nicht wartet.",
    ],
  },
};

const BAR_ROWS = outcomeRows();
const SCALE = barScale(BAR_ROWS); // req/s bei voller Balkenbreite
const JITTER = jitterProfiles();
const ROW_COUNT = ROW_KEYS.length; // Balkenzeilen + Jitter-Zeile

const panelOf = (key: Exclude<RowKey, "jitter">, l: LensKey) =>
  lensPanel(rowFlows(key), l);

/* ===== Sichten (nur mit `lenses`) ===== */

interface LensText {
  tab: string;
  hint: string; // Tooltip der Leiste: die Panel-Formel
  lead: string;
  caption: CaptionPart[];
}
const LENS_TEXT: Record<Exclude<LensKey, "kunde">, LensText> = {
  status5xx: {
    tab: "Fehler: 5xx",
    hint: "Server, Anfragen nach Statuscode; Fehler = 5xx (SRE Workbook, Grafana SLO)",
    lead: "Fehler = 5xx:",
    caption: [
      `Ohne Maßnahme ${fmt(panelOf("unprotected", "status5xx").pct)}\u00a0% ohne 5xx – grün. Ein Timeout ist kein Statuscode: Der Server zählt nur, was er beantwortet (200, nur zu spät), der Rest wartet ungezählt in der Queue. Load Shedding (503) ist rot, gedrosselter Batch (429) gilt als Erfolg.`,
    ],
  },
  statusNot2xx: {
    tab: "Fehler: ≠ 2xx",
    hint: "Server, Anfragen nach Statuscode; Fehler = alles außer 2xx (wie im PromQL-Beispiel zur RED-Methode)",
    lead: "Fehler = alles außer 2xx:",
    caption: [
      `Jetzt ist jede Absage rot, auch Back Pressure per 429 (Batch-Drosselung): Workload Separation steht mit ${fmt(panelOf("mixedSeparated", "statusNot2xx").pct)}\u00a0% schlechter da als ohne Trennung. Ob 429 ein Fehler ist, ist Konvention; die Zeile ohne Maßnahme bleibt grün.`,
    ],
  },
  dauer: {
    tab: "+ Dauer",
    hint: "Gut = 2xx und schneller als die Deadline (Histogramm mit Bucket an der Schwelle)",
    lead: "+ Dauer gegen die Deadline:",
    caption: [
      "Gut ist nur, was mit 2xx rechtzeitig kommt: Die Zeile ohne Maßnahme ist jetzt rot. Schnell abgewiesen und zu spät lassen sich trennen. Was in der Queue wartet, zählt weiter niemand.",
    ],
  },
  eingang: {
    tab: "+ Eingang",
    hint: "Gezählt am Load Balancer / Gateway statt am Server",
    lead: "+ gezählt am Load Balancer:",
    caption: [
      `Er zählt auch, was der Server nie beantwortet: 504, wenn er selbst aufgibt, 499 (nginx) oder 460 (ALB), wenn der Client geht. Ohne Maßnahme: ${fmt(panelOf("unprotected", "eingang").pct)}\u00a0% von ${fmt(panelOf("unprotected", "eingang").of)}/s statt von ${fmt(panelOf("unprotected", "dauer").of)}/s.`,
    ],
  },
  degradiert: {
    tab: "+ degradiert",
    hint: "Eigener Zähler oder eigenes Attribut für reduzierte Antworten (kein Standard)",
    lead: "+ Metrik für reduzierte Antworten:",
    caption: [
      "Feature Shedding antwortet schnell mit 200, nur ohne Empfehlungen. Ohne eigene Metrik sieht es aus wie Scaling; mit ihr ist es als eingeschränkt erkennbar: gewollt, aber kein Normalbetrieb.",
    ],
  },
  workload: {
    tab: "+ workload",
    hint: "Label workload=online|batch: je Klasse ein eigenes Ziel",
    lead: "+ Label workload (online/batch):",
    caption: [
      "Gedrosselter Batch ist gewollt; Workload Separation hält Online vollständig in der Deadline. Kein Panel alarmiert mehr anders als die Kundensicht – beim Kunden selbst misst aber nur RUM (etwa Grafana Faro).",
    ],
  },
};
const LENS_TABS = LENS_KEYS.map((key) => ({
  key,
  tab: key === "kunde" ? "Kunde" : LENS_TEXT[key].tab,
  hint:
    key === "kunde"
      ? "Was der Kunde erlebt"
      : LENS_TEXT[key as Exclude<LensKey, "kunde">].hint,
}));

/* ===== Klickzustand ===== */

const stepNo = computed(() => Math.max(0, Math.floor(props.step)));
const cur = computed(() => Math.min(ROW_COUNT - 1, stepNo.value));
// Solange sich die Zeilen aufbauen, gilt die Kundensicht. Ohne `step`
// (Infinity) zeigt die Grafik alle Zeilen in der Kundensicht. Der
// PDF-Export ohne Klicks klemmt $clicks auf `clicks:` der Folie, zeigt also
// die letzte Sicht (geprüft per `slidev export --format png`).
const LAST_STEP = ROW_COUNT - 1 + LENS_KEYS.length - 1;
const lensIdx = computed(() =>
  props.lenses && stepNo.value <= LAST_STEP
    ? Math.max(0, stepNo.value - (ROW_COUNT - 1))
    : 0,
);
const rowsComplete = computed(() => stepNo.value >= ROW_COUNT - 1);
const lens = computed<LensKey>(() => LENS_KEYS[lensIdx.value]!);
const metricLens = computed(() => lens.value !== "kunde");

// Sprung per Leiste: dieselbe Navigation wie ein Klick, also synchron in
// Presenter- und Publikumsfenster. Danach den Fokus abgeben, sonst schluckt
// der Button die Pfeiltasten des Vortrags.
const nav = useNav();
const slideCtx = useSlideContext();
const isActive = useIsSlideActive();
// Druck rendert mit Kontext "slide"; dort schützt isActive (aktiv ist im
// Druck nur Folie 1).
function goLens(k: number) {
  const where = slideCtx.$renderContext.value;
  if (!isActive.value || !["slide", "presenter"].includes(where)) return;
  void nav.go(slideCtx.$page.value, ROW_COUNT - 1 + k);
  blurLater();
}
function blurNow() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el.closest(".dov")) el.blur();
}
function blurLater() {
  blurNow();
  setTimeout(blurNow, 0);
  requestAnimationFrame(blurNow);
}

/* ===== Farben ===== */

const { isDark } = useDarkMode();
const C = computed(() => {
  const d = isDark.value;
  return {
    // hell slate-600: ≥ 4,5:1 auch auf dem Hintergrund der aktiven Zeile
    muted: d ? "#94a3b8" : "#475569",
    track: d ? "#1e2536" : "#e2e8f0",
    highlight: d ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.08)",
    // Zeile alarmiert anders als die Kundensicht: violetter Randbalken plus
    // leichte Tönung. Violett kommt sonst nicht vor.
    devMark: d ? "#a78bfa" : "#7c3aed",
    devBand: d ? "rgba(167,139,250,0.12)" : "rgba(124,58,237,0.07)",
    capLine: d ? "#e2e8f0" : "#0f172a",
    fillText: d ? "#111827" : "#ffffff",
    jitterBar: d ? "#94a3b8" : "#475569",
    unseenBase: d ? "#1e2536" : "#e2e8f0",
    unseenStripe: d ? "#2b3448" : "#cbd5e1",
    unseenText: d ? "#cbd5e1" : "#334155",
    fill: {
      ontime: d ? "#4ade80" : "#15803d",
      rejected: d ? "#fb923c" : "#b45309",
      timeout: d ? "#f87171" : "#b91c1c",
      later: d ? "#60a5fa" : "#1d4ed8",
      error: d ? "#f87171" : "#b91c1c",
      degraded: d ? "#2dd4bf" : "#0f766e",
      unseen: d ? "#1e2536" : "#e2e8f0",
    } as Record<ViewKind, string>,
    // Panel-Hintergrund wie ein Grafana-Stat-Panel mit Schwellwerten; Gelb
    // in beiden Modi mit dunkler Schrift (11:1).
    tone: {
      good: d ? "#4ade80" : "#15803d",
      bad: d ? "#f87171" : "#b91c1c",
      warn: "#facc15",
      info: d ? "#94a3b8" : "#475569",
    } as Record<PanelTone, string>,
    toneText: {
      good: d ? "#111827" : "#ffffff",
      bad: d ? "#111827" : "#ffffff",
      warn: "#111827",
      info: d ? "#111827" : "#ffffff",
    } as Record<PanelTone, string>,
  };
});
// Strichelung als Verlauf statt `border: dashed`: Chromium zeichnet einen
// kurzen gestrichelten Rand durchgezogen, WebKit gestrichelt.
const capDash = computed(
  () =>
    `repeating-linear-gradient(to bottom, ${C.value.capLine} 0 4px, transparent 4px 7px)`,
);

function fillOf(kind: ViewKind) {
  const base = C.value.fill[kind];
  if (kind === "unseen")
    return `repeating-linear-gradient(135deg, ${C.value.unseenBase} 0 6px, ${C.value.unseenStripe} 6px 9px)`;
  const stripe = isDark.value ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.14)";
  return kind === "timeout"
    ? `repeating-linear-gradient(135deg, ${base} 0 6px, ${stripe} 6px 9px), ${base}`
    : base;
}
const textOf = (kind: ViewKind) =>
  kind === "unseen" ? C.value.unseenText : C.value.fillText;

/* ===== Beschriftung ===== */

const CLASS_LABEL = { online: "Online", batch: "Batch" } as const;

function kindLabel(kind: ViewKind, l: LensKey, cls: ViewSegment["cls"]) {
  switch (kind) {
    case "ontime":
      if (cls === "batch") return "sofort";
      if (l === "kunde") return "rechtzeitig";
      if (l === "status5xx") return "ohne 5xx";
      if (l === "statusNot2xx") return "2xx";
      return "gut";
    case "error":
      return l === "status5xx" ? "Fehler (503)" : "Fehler (≠ 2xx)";
    case "rejected":
      return l === "kunde" ? "abgewiesen (429/503)" : "abgewiesen";
    case "timeout":
      return l === "dauer" ? "zu spät" : "Timeout";
    // Ob Batch später erledigt wird, sieht keine Anfrage-Metrik; mit Label
    // weiß das Panel nur, dass Batch ein eigenes Ziel hat.
    case "later":
      return l === "kunde" ? "später" : "toleriert";
    case "unseen":
      return "in der Queue";
    case "degraded":
      return "degradiert";
  }
}

// Kundensicht wie ohne Sichten; in den Metrik-Sichten kurz, damit die
// Legende auch mit fünf Einträgen einzeilig bleibt.
function legendLabel(kind: ViewKind, l: LensKey) {
  switch (kind) {
    case "ontime":
      if (l === "kunde") return "rechtzeitig / sofort erledigt";
      if (l === "status5xx") return "ohne 5xx (auch 429)";
      if (l === "statusNot2xx") return "2xx";
      return "gut: 2xx, rechtzeitig";
    case "error":
      return l === "status5xx" ? "Fehler: 5xx" : "Fehler: alles außer 2xx";
    case "rejected":
      return l === "kunde" ? "schnell abgewiesen (429/503)" : "abgewiesen";
    case "timeout":
      if (l === "kunde") return "Timeout: Antwort zu spät";
      if (l === "dauer") return "zu spät: 2xx nach der Deadline";
      return "Timeout (504/499/460)";
    case "later":
      return l === "kunde"
        ? "später erledigt (Batch)"
        : "toleriert (Batch: eigenes Ziel)";
    case "unseen":
      return "in der Queue: nicht gezählt";
    case "degraded":
      return "degradiert";
  }
}

/* ===== Balken ===== */

// Balken einer Zeile: Breiten exakt proportional zu req/s auf der
// gemeinsamen Skala. Zwischen Online und Batch steht eine Lücke von GAP px;
// sie geht vom folgenden Segment ab, damit jede Segmentgrenze und der
// Kapazitätsstrich genau bei ihrem Anteil liegen.
const GAP = 3;
const pct = (v: number) => `${(v / SCALE) * 100}%`;
function barLayout(segs: readonly ViewSegment[], capacity: number) {
  const parts = segs.map((seg, k) => {
    const gap = k > 0 && segs[k - 1]!.cls !== seg.cls;
    const first = k === 0 || gap;
    const last = k === segs.length - 1 || segs[k + 1]!.cls !== seg.cls;
    const r = (on: boolean) => (on ? "4px" : "0");
    return {
      seg,
      style: {
        width: gap ? `calc(${pct(seg.value)} - ${GAP}px)` : pct(seg.value),
        marginLeft: gap ? `${GAP}px` : "0",
        background: fillOf(seg.kind),
        color: textOf(seg.kind),
        borderRadius: `${r(first)} ${r(last)} ${r(last)} ${r(first)}`,
      },
    };
  });
  // Kapazität innerhalb der Skala: Strich; darüber: Hinweis am Balkenende.
  return {
    parts,
    capLeft: capacity < SCALE ? pct(capacity) : null,
    capBeyond: capacity >= SCALE ? capacity : null,
  };
}

// Im Segment: auf voller Skala Menge und Einordnung; in den kürzeren
// gemischten Zeilen nur die Klasse (ohne Label die Menge), weil 100 req/s
// zu schmal für mehr sind.
function segText(seg: ViewSegment, compact: boolean, l: LensKey) {
  if (compact) return seg.cls ? CLASS_LABEL[seg.cls] : fmt(seg.value);
  return `${fmt(seg.value)} ${kindLabel(seg.kind, l, seg.cls)}`;
}

// Rechts neben einem gemischten Balken: die Einordnung in Worten, je Klasse
// (ohne Label: alles zusammen).
function compactSummary(segs: readonly ViewSegment[], l: LensKey) {
  const groups: ViewSegment["cls"][] = segs.some((s) => s.cls === null)
    ? [null]
    : ["online", "batch"];
  return groups
    .map((cls) => {
      const own = segs.filter((s) => s.cls === cls);
      if (own.length === 0) return "";
      const parts = own.map(
        (s) => `${fmt(s.value)} ${kindLabel(s.kind, l, s.cls)}`,
      );
      if (cls === null) return parts.join(" · ");
      if (own.length === 1)
        return `${CLASS_LABEL[cls]} ${fmt(own[0]!.value)}: ${kindLabel(own[0]!.kind, l, cls)}`;
      return `${CLASS_LABEL[cls]}: ${parts.join(", ")}`;
    })
    .filter(Boolean)
    .join(" · ");
}

const rows = computed(() => {
  const l = lens.value;
  return [
    ...BAR_ROWS.map((r) => {
      const flows = rowFlows(r.key);
      const segs = lensSegments(flows, l);
      const compact = r.total < SCALE;
      return {
        kind: "bar" as const,
        key: r.key as RowKey,
        text: TEXT[r.key],
        compact,
        summary: compact ? compactSummary(segs, l) : "",
        panel: lensPanel(flows, l),
        deviates: l !== "kunde" && deviatesFromCustomer(flows, l),
        ...barLayout(segs, r.capacity),
      };
    }),
    { kind: "jitter" as const, key: "jitter" as RowKey, text: TEXT.jitter },
  ];
});

// Jitter-Spuren: gleiche Skala (Spitze ohne Jitter = volle Höhe), je Profil
// ein Pfad (Einzelrechtecke zeigen Antialiasing-Nähte).
const J_W = 650;
const J_H = 32;
const J_H_LENSES = 22; // mit Sichten flacher: Platz für Leiste und Panels
const jScale = J_H / JITTER.peakFixed;
const jColW = J_W / JITTER.fixed.length;
const r2 = (n: number) => Math.round(n * 100) / 100;
function profilePath(profile: readonly number[]) {
  let d = `M0 ${J_H}`;
  profile.forEach((n, m) => {
    const y = r2(J_H - n * jScale);
    d += ` L${r2(m * jColW)} ${y} L${r2((m + 1) * jColW)} ${y}`;
  });
  return `${d} L${J_W} ${J_H} Z`;
}
const jTracks = [
  {
    label: "0 0 * * *",
    path: profilePath(JITTER.fixed),
    peak: JITTER.peakFixed,
    work: JITTER.workFixed,
  },
  {
    label: "H 0 * * *",
    path: profilePath(JITTER.hashed),
    peak: JITTER.peakHashed,
    work: JITTER.workHashed,
  },
];
// Zeitachse: Minute m liegt bei m / Profillänge der Spurbreite.
const J_TICKS = [0, 30, 60].map((m) => ({
  label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
  left: `${(m / JITTER.fixed.length) * 100}%`,
}));
// Panel der Jitter-Zeile: Kundensicht die Spitzen, in den Metrik-Sichten
// die Verdichtung. Gleiche Arbeit heißt gleiches Tagesmittel; nur das
// Maximum (max_over_time) trennt die beiden.
const jitterPanel = computed(() =>
  metricLens.value
    ? {
        val: `max ${JITTER.peakFixed} | ${JITTER.peakHashed}`,
        sub: "Ø Tag gleich",
      }
    : { val: `${JITTER.peakFixed} | ${JITTER.peakHashed}`, sub: "Spitze" },
);
// Ampel nicht nur über die Farbe
const TONE_MARK: Record<PanelTone, string> = {
  good: "✓",
  bad: "✗",
  warn: "!",
  info: "", // Batch mit eigenem Ziel: das Wort genügt, „~“ läse sich als „circa“
};

/* ===== Legende, Hervorhebung, Erläuterung ===== */

const legend = computed(() => {
  const l = lens.value;
  const seen = new Set<ViewKind>();
  rows.value.forEach((r, i) => {
    if (r.kind === "bar" && i <= cur.value)
      r.parts.forEach((p) => seen.add(p.seg.kind));
  });
  // Ohne Sichten wie bisher: die vier Ausgänge, auch bevor sie vorkommen
  const kinds: ViewKind[] =
    l === "kunde"
      ? ["ontime", "rejected", "timeout", "later"]
      : (
          [
            "ontime",
            "degraded",
            "error",
            "rejected",
            "timeout",
            "later",
            "unseen",
          ] as ViewKind[]
        ).filter((k) => seen.has(k));
  return kinds.map((k) => ({ kind: k, label: legendLabel(k, l) }));
});

const titleOf = (key: RowKey, title: string) =>
  props.lenses && key === "enough" ? "Feature Shedding" : title;

const current = computed(() =>
  metricLens.value
    ? LENS_TEXT[lens.value as Exclude<LensKey, "kunde">]
    : rows.value[cur.value]!.text,
);
</script>

<template>
  <div
    class="dov"
    :class="{ 'dov-lenses': lenses }"
    :data-lens="lenses ? lens : undefined"
    :data-step="stepNo"
  >
    <div
      v-if="lenses"
      class="lensbar"
      :style="{ color: C.muted }"
      @pointerup.capture="blurLater"
    >
      <span class="lb-label">Sicht:</span>
      <button
        v-for="(t, k) in LENS_TABS"
        :key="t.key"
        type="button"
        class="lb-btn"
        :data-lens="t.key"
        :aria-pressed="k === lensIdx"
        :disabled="!rowsComplete"
        :title="t.hint"
        :style="
          k === lensIdx
            ? {
                background: C.capLine,
                color: isDark ? '#0f172a' : '#ffffff',
                borderColor: C.capLine,
              }
            : { borderColor: C.muted, color: C.muted }
        "
        @click="goLens(k)"
      >
        {{ t.tab }}
      </button>
      <span v-if="metricLens" class="lb-dev"
        ><i class="lb-dev-mark" :style="{ background: C.devMark }" />≠ Kunde:
        Panel alarmiert anders</span
      >
    </div>

    <div class="legend" :style="{ color: C.muted }">
      <span v-for="l in legend" :key="l.kind" class="lg">
        <i
          class="sw"
          :class="{ 'sw-unseen': l.kind === 'unseen' }"
          :style="{ background: fillOf(l.kind), outlineColor: C.muted }"
        />{{ l.label }}
      </span>
      <span class="lg"
        ><i class="sw-cap" :style="{ background: capDash }" />Kapazität</span
      >
    </div>

    <div class="rows">
      <div
        v-for="(r, i) in rows"
        v-show="i <= cur"
        :key="r.key"
        class="row"
        :data-row="r.key"
        :data-deviates="r.kind === 'bar' && r.deviates ? 'true' : undefined"
        :style="
          metricLens
            ? r.kind === 'bar' && r.deviates
              ? {
                  background: C.devBand,
                  boxShadow: `inset 4px 0 0 ${C.devMark}`,
                }
              : { background: 'transparent' }
            : { background: i === cur ? C.highlight : 'transparent' }
        "
      >
        <div class="label">
          <div class="t">{{ titleOf(r.key, r.text.title) }}</div>
          <div class="s" :style="{ color: C.muted }">{{ r.text.sub }}</div>
        </div>

        <div v-if="r.kind === 'bar'" class="bar">
          <div
            v-for="(p, k) in r.parts"
            :key="k"
            class="seg"
            :class="{ 'seg-unseen': p.seg.kind === 'unseen' }"
            :data-outcome="p.seg.kind"
            :data-cls="p.seg.cls ?? 'alle'"
            :style="[p.style, { outlineColor: C.muted }]"
          >
            {{ segText(p.seg, r.compact, lens) }}
          </div>
          <div v-if="r.compact" class="out">{{ r.summary }}</div>
          <div
            v-if="r.capLeft !== null"
            class="cap"
            :style="{ left: r.capLeft, background: capDash }"
          />
          <div
            v-if="r.capBeyond !== null"
            class="cap-beyond"
            :style="{ color: C.fillText }"
          >
            Kapazität {{ fmt(r.capBeyond) }} →
          </div>
        </div>

        <div v-else class="jitter">
          <div v-for="t in jTracks" :key="t.label" class="jtrack">
            <code class="jlabel" :style="{ color: C.muted }">{{
              t.label
            }}</code>
            <svg
              class="jsvg"
              :style="{ height: `${lenses ? J_H_LENSES : J_H}px` }"
              :viewBox="`0 0 ${J_W} ${J_H}`"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`${t.label}: höchstens ${t.peak} Jobs gleichzeitig, ${t.work} Job-Minuten`"
            >
              <rect :width="J_W" :height="J_H" :fill="C.track" rx="2" ry="2" />
              <path :d="t.path" :fill="C.jitterBar" />
            </svg>
            <span class="jpeak" :style="{ color: C.muted }"
              >Spitze <b>{{ t.peak }}</b
              ><br />{{ t.work }} Job-Minuten</span
            >
          </div>
          <div class="jaxis" :style="{ color: C.muted }">
            <span
              v-for="tk in J_TICKS"
              :key="tk.label"
              :style="{ left: tk.left }"
              >{{ tk.label }}</span
            >
          </div>
        </div>

        <div
          v-if="lenses && r.kind === 'bar'"
          class="panel"
          :data-tone="r.panel.tone"
          :style="{
            background: C.tone[r.panel.tone],
            color: C.toneText[r.panel.tone],
          }"
        >
          <div class="p-val">
            <template v-if="TONE_MARK[r.panel.tone]"
              >{{ TONE_MARK[r.panel.tone] }}&nbsp;</template
            ><b>{{ fmt(r.panel.pct) }}&nbsp;%</b>
            {{ r.panel.label }}
          </div>
          <div class="p-sub">
            <template v-if="r.deviates">≠ Kunde · </template>von
            {{ fmt(r.panel.of) }}/s
          </div>
        </div>
        <div
          v-else-if="lenses"
          class="panel"
          data-tone="info"
          :style="{ background: C.tone.info, color: C.toneText.info }"
        >
          <div class="p-val">
            <b>{{ jitterPanel.val }}</b>
          </div>
          <div class="p-sub">{{ jitterPanel.sub }}</div>
        </div>
      </div>
    </div>

    <div class="caption">
      <b>{{ current.lead }}</b>
      <template v-for="(p, k) in current.caption" :key="k"
        ><code v-if="typeof p !== 'string'">{{ p.code }}</code
        ><template v-else>{{ (k === 0 ? " " : "") + p }}</template></template
      >
    </div>
  </div>
</template>

<style scoped>
.dov {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: inherit;
}
.lensbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding-left: 6px;
}
.lb-label {
  margin-right: 2px;
}
.lb-btn {
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 11.5px;
  padding-left: 6px;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.sw {
  display: inline-block;
  width: 12px;
  height: 10px;
  border-radius: 2px;
}
.sw-unseen,
.seg-unseen {
  outline: 1px dashed;
  outline-offset: -1px;
}
.sw-cap {
  display: inline-block;
  width: 2px;
  height: 14px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  transition: background 0.3s ease;
  /* läuft bei jedem Aufdecken an (display: none → sichtbar) */
  animation: dov-in 0.3s ease;
}
@keyframes dov-in {
  from {
    opacity: 0;
  }
}
.label {
  flex: 0 0 212px;
  min-width: 0;
  line-height: 1.15;
}
/* 600, nicht 700: Slidev lädt per Default nur Inter 200/400/600, das
 * SRE-Deck zusätzlich 700. Mit 700 wäre der Titel dort breiter und bräche
 * „Feature Shedding, Cache, Scaling“ in der 212-px-Spalte um; 600 sieht in
 * jedem Deck gleich aus. */
.t {
  font-size: 13px;
  font-weight: 600;
}
.s {
  font-size: 11px;
}
.bar {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  height: 26px;
  border-radius: 4px;
  overflow: visible;
}
.seg {
  flex: none;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  line-height: 26px;
  padding: 0 8px;
  box-sizing: border-box;
}
.out {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 26px;
  padding-left: 10px;
}
/* Mit Sichten ist der Balken um die Panel-Spalte schmaler: In den kurzen
 * gemischten Zeilen rücken die Segmenttexte enger, die Zusammenfassung
 * darf zweizeilig werden (2 × 13 px = Balkenhöhe). */
.dov-lenses .seg {
  padding: 0 5px;
}
.dov-lenses .out {
  display: flex;
  align-items: center;
  white-space: normal;
  font-size: 11px;
  line-height: 13px;
}
.cap {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  pointer-events: none;
}
.cap-beyond {
  position: absolute;
  top: 0;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 26px;
  white-space: nowrap;
  pointer-events: none;
}
.jitter {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.jtrack {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jlabel {
  flex: 0 0 72px;
  font-size: 11px;
  white-space: nowrap;
}
.jsvg {
  flex: 1 1 0;
  min-width: 0;
}
.jpeak {
  flex: 0 0 82px;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}
.jaxis {
  position: relative;
  height: 13px;
  margin: 0 90px 0 80px; /* jlabel + gap | gap + jpeak */
  font-size: 11px;
  line-height: 13px;
}
.jaxis span {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;
}
.panel {
  flex: 0 0 124px;
  box-sizing: border-box;
  border-radius: 4px;
  padding: 2px 7px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
}
.p-val {
  font-size: 10.5px;
}
.p-val b {
  font-size: 12.5px;
  font-weight: 600;
}
.p-sub {
  font-size: 10px;
}
/* Vor Klick 6 gesperrt: sichtbar zurückgenommen, nur „Kunde“ bleibt voll */
.lb-btn:disabled {
  cursor: default;
}
.lb-btn:disabled:not([aria-pressed="true"]) {
  opacity: 0.4;
}
.lb-dev {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.lb-dev-mark {
  display: inline-block;
  width: 4px;
  height: 14px;
  border-radius: 1px;
}
.caption {
  font-size: 13px;
  line-height: 1.35;
  min-height: 2.7em;
  margin-top: 2px;
}
.caption code {
  font-size: 0.92em;
  padding: 0 2px;
}
</style>
