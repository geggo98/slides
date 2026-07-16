// Modul-globaler Zustand des Agent-Lauf-Simulators. Beide Sim-Folien
// importieren dieses Modul, daher überleben Vendor-Wahl und Token-Zähler
// den Folienwechsel Übersicht → Zoom (Slidev hält Nachbarfolien gemountet).
import { computed, ref } from "vue";
import {
  CODEX_TOKEN_FACTOR,
  STEPS_OVERVIEW,
  STEPS_ZOOM,
  type SimStep,
  type Vendor,
} from "./agentRunScript";

export const vendor = ref<Vendor>("claude");
/** Anzahl aufgedeckter Steps je View (1 = nur der Session-Header). */
export const overviewStep = ref(1);
export const zoomStep = ref(1);
export const playing = ref(false);
/** Welche Sim-Folie zuletzt aktiv war — die Zoom-Folie rechnet die Übersicht als abgeschlossen. */
export const activeView = ref<"overview" | "zoom">("overview");

function sumTokens(steps: SimStep[], count: number) {
  let main = 0;
  let sub = 0;
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    main += steps[i].tokens?.main ?? 0;
    sub += steps[i].tokens?.sub ?? 0;
  }
  return { main, sub };
}

export const totals = computed(() => {
  // Zoom-Folie: Übersichtslauf gilt als komplett (auch wenn der User vorgesprungen ist).
  const overviewCount =
    activeView.value === "zoom" ? STEPS_OVERVIEW.length : overviewStep.value;
  const base = sumTokens(STEPS_OVERVIEW, overviewCount);
  const zoom = sumTokens(
    STEPS_ZOOM,
    activeView.value === "zoom" ? zoomStep.value : 0,
  );
  const f = vendor.value === "codex" ? CODEX_TOKEN_FACTOR : 1;
  return {
    main: Math.round(base.main * f),
    sub: Math.round(base.sub * f),
    total: Math.round((base.main + base.sub) * f),
    workflow: Math.round((zoom.main + zoom.sub) * f),
  };
});

// Grobe €/MTok-Rate (Blended ≈ Input-Listenpreis, wie im MCP-Slide von
// agents-details). GROBE SCHÄTZWERTE — die GPT-5.6-Preise sind Platzhalter,
// im Code leicht anpassbar. Pro Vendor UND Rolle, weil Haupt- und Sub-Modell
// (siehe TOKEN_LABELS) unterschiedlich kosten.
const PRICE_EUR_PER_MTOK = {
  claude: { main: 4.6, sub: 2.8 }, // Opus xhigh / Sonnet 5
  codex: { main: 4.0, sub: 0.4 }, // gpt-5.6-sol ultra / low
} as const;

export const costs = computed(() => {
  const p = PRICE_EUR_PER_MTOK[vendor.value];
  // Codex-Faktor 0,87 steckt bereits in totals — hier nur Token × Rate.
  const eur = (tok: number, rate: number) => (tok * rate) / 1_000_000;
  const main = eur(totals.value.main, p.main);
  const sub = eur(totals.value.sub, p.sub);
  return {
    main,
    sub,
    // Workflow-Token stecken alle im Sub-Feld → Sub-Modellpreis.
    workflow: eur(totals.value.workflow, p.sub),
    run: main + sub,
  };
});

const multiplierIndex = STEPS_OVERVIEW.findIndex(
  (s) => s.flag === "multiplier",
);

export const multiplierRevealed = computed(
  () => activeView.value === "zoom" || overviewStep.value > multiplierIndex,
);

export function resetRun(view: "overview" | "zoom") {
  playing.value = false;
  if (view === "overview") overviewStep.value = 1;
  else zoomStep.value = 1;
}

export function stepsFor(view: "overview" | "zoom") {
  return view === "overview" ? STEPS_OVERVIEW : STEPS_ZOOM;
}

export function stepRefFor(view: "overview" | "zoom") {
  return view === "overview" ? overviewStep : zoomStep;
}

export function formatTokens(n: number) {
  return n.toLocaleString("de-DE");
}

// Auto-Einheit: unter 1 € als „15 ct", darüber als „1,20 €".
export function formatCost(eur: number) {
  return eur < 1
    ? Math.round(eur * 100) + " ct"
    : eur.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €";
}
