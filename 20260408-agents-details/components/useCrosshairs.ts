import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { Pt, Scale } from "./paretoData";

// Fadenkreuz-Vergleichsmodus, geteilt von `ModelRoutingPareto.vue` (Folie
// „Welches Modell wofür?") und `ModelRoutingHistory.vue` (Historien-Folie, dort
// opt-in). Hover zeigt temporär, Klick pinnt permanent (erneuter Klick löst),
// mehrere Pins gleichzeitig — die Einfüge-Reihenfolge bestimmt die Farbe.
//
// Hier steckt nur die Zustands- und Geometrie-Logik. Was daraus gezeichnet wird
// (Linien, Badges, Fehlerbalken) bleibt in den Komponenten: die beiden Charts
// sind unterschiedlich hoch und zeigen nicht dasselbe.

export interface Crosshair {
  p: Pt;
  /** Farbklasse: `mp-ch-0…3` je Pin-Reihenfolge, `mp-ch-hover` beim Hover. */
  cls: string;
  /** Y der %-Badge am linken Rand, gegen Nachbar-Badges entzerrt. */
  badgeY: number;
}

export interface CrosshairsOpts {
  /**
   * true = gepinnte Punkte zeigen unter dem %-Badge noch ein ±-Badge, die
   * Entzerrung braucht dann die doppelte Zeilenhöhe. Nur das Pareto-Chart.
   */
  ciBadge?: boolean;
}

export function useCrosshairs(
  pts: Ref<Pt[]> | ComputedRef<Pt[]>,
  s: Scale,
  opts: CrosshairsOpts = {},
) {
  const byLabel = computed(() => new Map(pts.value.map((p) => [p.label, p])));
  const hovered = ref<string | null>(null);
  const pinned = ref<string[]>([]);

  function togglePin(label: string) {
    const i = pinned.value.indexOf(label);
    if (i >= 0) pinned.value.splice(i, 1);
    else pinned.value.push(label);
  }

  function clear() {
    pinned.value = [];
    hovered.value = null;
  }

  // label → Farbklasse (Pin-Farbe aus dem Cycle, bzw. neutral beim Hover).
  // Fadenkreuz UND Wanderung lesen dieselbe Quelle, damit Geisterpunkt und Pfeil
  // im selben Ton mitleuchten wie das Fadenkreuz ihres Punkts.
  const activeCls = computed(() => {
    const m = new Map<string, string>();
    pinned.value.forEach((label, i) => m.set(label, `mp-ch-${i % 4}`));
    if (hovered.value && !m.has(hovered.value)) {
      m.set(hovered.value, "mp-ch-hover");
    }
    return m;
  });

  // Zwei Pins mit einem Punkt Score-Unterschied liegen gut 3 px auseinander —
  // ihre Achsen-Badges lägen übereinander. Deshalb werden sie beim Aufbau
  // auseinandergeschoben (die Fadenkreuz-Linie bleibt exakt): 22 px, sobald ein
  // Badge zweizeilig wird, sonst 11.
  const crosshairs = computed<Crosshair[]>(() => {
    const list = [...activeCls.value].flatMap(([label, cls]) => {
      const p = byLabel.value.get(label);
      return p ? [{ p, cls, badgeY: s.py(p.y) + 3 }] : [];
    });
    const gap =
      opts.ciBadge &&
      list.some((c) => c.p.ci && pinned.value.includes(c.p.label))
        ? 22
        : 11;
    let last = -Infinity;
    for (const c of [...list].sort((a, b) => a.badgeY - b.badgeY)) {
      c.badgeY = Math.max(c.badgeY, last + gap);
      last = c.badgeY;
    }
    return list;
  });

  /** Leer, solange der zugehörige Punkt weder gehovt noch gepinnt ist. */
  const movedCls = (label: string) => {
    const cls = activeCls.value.get(label);
    return cls ? `mp-moved-on ${cls}` : "";
  };

  /**
   * Nur die Pin-Farbe, kein Hover-Ton: Die Beschriftung eines gepinnten Punkts
   * färbt sich wie sein Ring, sonst sind zwei Pins im dichten Feld schwer
   * auseinanderzuhalten. Leer, solange der Punkt nicht gepinnt ist.
   */
  const pinCls = (label: string) =>
    pinned.value.includes(label) ? (activeCls.value.get(label) ?? "") : "";

  return {
    byLabel,
    hovered,
    pinned,
    togglePin,
    clear,
    activeCls,
    crosshairs,
    movedCls,
    pinCls,
  };
}
