import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DODGE,
  dodgeDetailed,
  frontUnion,
  HISTORY_SCALE,
  HIT_R,
  HIT_R_HISTORY,
  MARKER,
  PARETO_SCALE,
  visiblePoints,
  type DodgeOpts,
} from "../../paretoChrome";
import {
  CURRENT,
  paretoFront,
  SNAPSHOTS,
  V1_COMPARE,
  type Pt,
} from "../../paretoData";
import { PRESETS, presetModels } from "../../providerFilter";

// Die Entzerrung ist eine bewusste Abweichung vom Wert, damit die Folie auf
// einen Blick lesbar bleibt. Diese Tests halten fest, was sie darf und was
// nicht: kein Paar bleibt überlappt, kein Marker wandert weiter als die Kappe,
// kein dominierter Punkt rückt über die Front, kein Schalter bewegt einen
// festen Marker, und dieselbe Eingabe ergibt bitgleich dieselbe Ausgabe.

type Kind = keyof typeof MARKER;
interface Zustand {
  name: string;
  pts: Pt[];
  kind: Kind;
  movable: (p: Pt) => boolean;
  opts?: DodgeOpts;
}

const ALL = new Set(presetModels("all", CURRENT));
const none = () => false;
const claude = (p: Pt) => p.sub !== undefined;
const scale = (k: Kind) => (k === "history" ? HISTORY_SCALE : PARETO_SCALE);
// Wie die Hauptfolie: Front-Vereinigung über alle Presets bewegt sich nur
// waagerecht.
const MAIN_OPTS: DodgeOpts = { horizontalOnly: frontUnion(CURRENT) };
const run = (z: Zustand) =>
  dodgeDetailed(z.pts, scale(z.kind), z.kind, z.movable, z.opts);

const ZUSTAENDE: Zustand[] = [
  ...SNAPSHOTS.map((s) => ({
    name: `Historie ${s.id}`,
    pts: s.pts,
    kind: "history" as Kind,
    movable: none,
  })),
  ...V1_COMPARE.map((s) => ({
    name: `Bonus ${s.id}`,
    pts: s.pts,
    kind: "history" as Kind,
    movable: none,
  })),
  {
    name: "Hauptfolie",
    pts: visiblePoints(CURRENT, ALL, false),
    kind: "pareto",
    movable: claude,
    opts: MAIN_OPTS,
  },
  {
    name: "Hauptfolie mit Kontingent",
    pts: visiblePoints(CURRENT, ALL, true),
    kind: "pareto",
    movable: claude,
    opts: MAIN_OPTS,
  },
];

const half = (pts: Pt[], kind: Kind) => {
  const front = new Set(paretoFront(pts).front.map((p) => p.label));
  return (p: Pt) =>
    front.has(p.label) ? MARKER[kind].front : MARKER[kind].dom;
};

describe("Marker-Entzerrung", () => {
  it.each(ZUSTAENDE.map((z) => [z.name, z] as const))(
    "%s: trennt jedes Paar, hält die Kappe und konvergiert",
    (_name, z) => {
      const r = run(z);
      expect(r.residual).toBeLessThanOrEqual(DODGE.tol);
      expect(r.sweeps).toBeLessThanOrEqual(5);
      const s = scale(z.kind);
      for (const p of z.pts) {
        const c = r.pos.get(p.label)!;
        expect(c, p.label).toBeDefined();
        expect(
          Math.hypot(c.px - s.px(p.x), c.py - s.py(p.y)),
        ).toBeLessThanOrEqual(DODGE.cap + DODGE.eps);
      }
    },
  );

  it.each(ZUSTAENDE.map((z) => [z.name, z] as const))(
    "%s: ist deterministisch, auch bei umgekehrter Eingabe",
    (_name, z) => {
      const s = scale(z.kind);
      const a = run(z).pos;
      const b = dodgeDetailed(
        [...z.pts].reverse(),
        s,
        z.kind,
        z.movable,
        z.opts,
      ).pos;
      const c = run(z).pos;
      expect([...a.entries()].sort()).toStrictEqual([...b.entries()].sort());
      expect([...a.entries()].sort()).toStrictEqual([...c.entries()].sort());
    },
  );

  // Der Wächter: kein dominierter Punkt darf über den höchsten Frontpunkt
  // rücken, der nicht teurer ist — sonst sähe er besser aus als die Front.
  it.each(ZUSTAENDE.map((z) => [z.name, z] as const))(
    "%s: lässt keinen dominierten Punkt über die Front",
    (_name, z) => {
      const s = scale(z.kind);
      const { front, dom } = paretoFront(z.pts);
      const pos = run(z).pos;
      for (const d of dom) {
        const lvl = Math.min(
          ...front
            .filter((f) => s.px(f.x) <= s.px(d.x) + DODGE.eps)
            .map((f) => s.py(f.y)),
        );
        expect(pos.get(d.label)!.py, d.label).toBeGreaterThanOrEqual(
          lvl - DODGE.eps,
        );
      }
      // Die Front-Polyline bleibt in Anzeige-Koordinaten monoton.
      const xs = front.map((f) => pos.get(f.label)!.px);
      for (let i = 1; i < xs.length; i++)
        expect(xs[i]).toBeGreaterThan(xs[i - 1]!);
    },
  );

  // Jede Markermitte liegt außerhalb des fremden Klickziels: ein Klick auf
  // das sol-Quadrat trifft sol, nicht astra.
  it.each(ZUSTAENDE.map((z) => [z.name, z] as const))(
    "%s: hält jede Markermitte außerhalb fremder Klickziele",
    (_name, z) => {
      const s = scale(z.kind);
      const hitR = z.kind === "history" ? HIT_R_HISTORY : HIT_R;
      const pos = run(z).pos;
      const list = [...pos.entries()];
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const [a, pa] = list[i]!;
          const [b, pb] = list[j]!;
          expect(
            Math.hypot(pa.px - pb.px, pa.py - pb.py),
            `${a} ~ ${b}`,
          ).toBeGreaterThan(hitR);
        }
    },
  );

  it("bewegt an Stationen ohne Zwillinge nichts", () => {
    for (const id of ["v11", "0710"]) {
      const s = SNAPSHOTS.find((x) => x.id === id)!;
      expect(
        dodgeDetailed(s.pts, HISTORY_SCALE, "history").moved,
      ).toStrictEqual([]);
    }
    expect(
      dodgeDetailed(V1_COMPARE[1]!.pts, HISTORY_SCALE, "history").moved,
    ).toStrictEqual([]);
  });

  // Zusage der Hauptfolie: kein Schalter verschiebt einen festen Marker. Das
  // Overlay darf nur die Claude-Punkte bewegen.
  it("lässt auf der Hauptfolie die festen Marker unter beiden Overlay-Zuständen gleich", () => {
    const aus = dodgeDetailed(
      visiblePoints(CURRENT, ALL, false),
      PARETO_SCALE,
      "pareto",
      claude,
      MAIN_OPTS,
    ).pos;
    const an = dodgeDetailed(
      visiblePoints(CURRENT, ALL, true),
      PARETO_SCALE,
      "pareto",
      claude,
      MAIN_OPTS,
    ).pos;
    for (const p of CURRENT) {
      if (claude(p)) continue;
      expect(an.get(p.label), p.label).toStrictEqual(aus.get(p.label));
    }
  });

  // Der y-Versatz eines Punkts liegt unter seinem eigenen Fehlerbalken, wo es
  // einen gibt (Stände ab 26.08. und Hauptfolie).
  it("verschiebt senkrecht nie weiter als den eigenen Fehlerbalken", () => {
    for (const z of ZUSTAENDE) {
      const s = scale(z.kind);
      const r = run(z);
      for (const m of r.moved) {
        const p = z.pts.find((q) => q.label === m.label)!;
        if (!p.ci) continue;
        const pp = Math.abs(s.py(p.y + 1) - s.py(p.y)); // px je Prozentpunkt
        expect(
          Math.abs(m.dy) / pp,
          `${z.name}: ${m.label}`,
        ).toBeLessThanOrEqual(p.ci);
      }
    }
  });

  // Der Anbieter-Filter blendet nur aus, die Lagen bleiben die des vollen
  // Satzes. Was im vollen Satz dominiert ist, kann im Preset auf der Front
  // stehen (terra bei Windsurf) — dann darf es nicht in der Höhe verschoben
  // sein, und die Front des Presets muss weiter über jedem dominierten Punkt
  // liegen. Befund der Prüfung vom 05.09.2026, seither Front-Vereinigung.
  it.each(
    PRESETS.flatMap((pr) =>
      [false, true].map(
        (on) => [`${pr.id}${on ? " + Kontingent" : ""}`, pr.id, on] as const,
      ),
    ),
  )("Preset %s: Front in der Höhe exakt, Wächter hält", (_name, id, on) => {
    const s = PARETO_SCALE;
    const pos = dodgeDetailed(
      visiblePoints(CURRENT, ALL, on),
      s,
      "pareto",
      claude,
      MAIN_OPTS,
    ).pos;
    const pts = visiblePoints(CURRENT, new Set(presetModels(id, CURRENT)), on);
    const { front, dom } = paretoFront(pts);
    for (const f of front) {
      expect(pos.get(f.label)!.py, f.label).toBeCloseTo(s.py(f.y), 6);
    }
    for (const d of dom) {
      const lvl = Math.min(
        ...front
          .filter((f) => s.px(f.x) <= s.px(d.x) + DODGE.eps)
          .map((f) => s.py(f.y)),
      );
      expect(pos.get(d.label)!.py, `${id}: ${d.label}`).toBeGreaterThanOrEqual(
        lvl - DODGE.eps,
      );
    }
    const xs = front.map((f) => pos.get(f.label)!.px);
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]).toBeGreaterThan(xs[i - 1]!);
  });

  it("nutzt je Chart die Halbmaße der gezeichneten Marker", () => {
    // Historie: Frontkreis r 6 + halber Strich, Quadrat 9 px, Ring r 4,5.
    // Hauptfolie: Frontkreis r 7, Quadrat 10 px, Ring r 5.
    expect(MARKER.history).toStrictEqual({ front: 7, dom: 4.5, ghost: 5.2 });
    expect(MARKER.pareto).toStrictEqual({ front: 8, dom: 5, ghost: 5.7 });
    expect(
      half(SNAPSHOTS[0]!.pts, "history")(SNAPSHOTS[0]!.pts[0]!),
    ).toBeGreaterThan(0);
  });

  // Welche Marker sich bewegen, ist eine redaktionelle Aussage der Folien
  // (Speaker Notes nennen die Paare). Verschiebt sich die Liste, muss die
  // Notiz mit.
  it("bewegt je Zustand genau diese Marker", () => {
    const moved = Object.fromEntries(
      ZUSTAENDE.map((z) => [
        z.name,
        run(z)
          .moved.filter((m) => Math.hypot(m.dx, m.dy) > 0.5)
          .map((m) => m.label)
          .sort(),
      ]),
    );
    expect(moved).toMatchInlineSnapshot(`
      {
        "Bonus v1": [
          "claude-opus-4.6",
          "claude-sonnet-4.6",
          "gpt-5.4-mini",
          "mimo-v2.5-pro",
        ],
        "Bonus v11-vs-v1": [],
        "Hauptfolie": [
          "glm-5.3",
          "gpt-5.6-sol",
          "gpt-5.6-terra",
          "gpt-6-astra",
          "muse-spark-1.2",
          "qwen3.8-max",
        ],
        "Hauptfolie mit Kontingent": [
          "claude-fable-5",
          "glm-5.3",
          "gpt-5.6-sol",
          "gpt-5.6-terra",
          "gpt-6-astra",
          "muse-spark-1.2",
          "qwen3.8-max",
        ],
        "Historie 0710": [],
        "Historie 0722": [
          "gpt-5.6-terra",
          "grok-4.5",
          "kimi-k3",
          "muse-spark-1.1",
        ],
        "Historie 0725": [
          "gpt-5.6-terra",
          "grok-4.5",
          "kimi-k3",
          "muse-spark-1.1",
        ],
        "Historie 0730": [
          "grok-4.5",
          "kimi-k3",
          "muse-spark-1.1",
        ],
        "Historie 0814": [
          "grok-4.5",
          "muse-spark-1.1",
          "muse-spark-1.2",
          "qwen3.8-max",
        ],
        "Historie 0826": [
          "glm-5.3",
          "gpt-5.6-terra",
          "grok-4.5",
          "muse-spark-1.1",
          "muse-spark-1.2",
          "qwen3.8-max",
        ],
        "Historie 0902": [
          "glm-5.3",
          "gpt-5.6-terra",
          "grok-4.5",
          "muse-spark-1.1",
          "muse-spark-1.2",
          "qwen3.8-max",
        ],
        "Historie 0903": [
          "glm-5.3",
          "gpt-5.6-sol",
          "gpt-5.6-terra",
          "gpt-6-astra",
          "grok-4.5",
          "muse-spark-1.1",
          "muse-spark-1.2",
          "qwen3.8-max",
        ],
        "Historie v11": [],
      }
    `);
  });
});

// Die Abweichung vom wahren Wert steht in den Speaker Notes jeder Chart-Folie
// — in Pixeln, Prozentpunkten und Prozent des Preises. Solche Zahlen veralten
// still, sobald ein Stand dazukommt; deshalb werden sie hier aus den Daten
// gerechnet und gegen den Notiztext gehalten. Der Satz muss wörtlich stehen.
describe("Abweichung in den Speaker Notes", () => {
  const slides = readFileSync(
    join(import.meta.dirname, "../../../slides.md"),
    "utf8",
  );
  const notesAfter = (anchor: string): string => {
    const i = slides.indexOf(anchor);
    expect(i, anchor).toBeGreaterThan(-1);
    const a = slides.indexOf("<!--", i);
    const b = slides.indexOf("-->", a);
    return slides.slice(a, b).replace(/\s+/g, " ");
  };
  const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");

  /** Maximum je Folie: Pixel, Prozentpunkte senkrecht, Prozent des Preises. */
  const maximum = (zs: Zustand[]) => {
    let px = 0;
    let pp = 0;
    let pct = 0;
    for (const z of zs) {
      const s = scale(z.kind);
      const perPp = Math.abs(s.py(1) - s.py(0));
      const perDecade = s.px(10) - s.px(1);
      for (const m of run(z).moved) {
        px = Math.max(px, Math.hypot(m.dx, m.dy));
        pp = Math.max(pp, Math.abs(m.dy) / perPp);
        pct = Math.max(
          pct,
          (Math.pow(10, Math.abs(m.dx) / perDecade) - 1) * 100,
        );
      }
    }
    return { px, pp, pct };
  };

  it.each([
    ["Hauptfolie", "# Welches Modell wofür? Die Datenlage", "Hauptfolie"],
    ["Historie", "routeAlias: pareto-historie", "Historie "],
    ["Bonusfolie", "routeAlias: pareto-v1-bonus", "Bonus "],
  ])("%s: nennt das gemessene Maximum", (_name, anchor, prefix) => {
    const zs = ZUSTAENDE.filter((z) => z.name.startsWith(prefix));
    expect(zs.length).toBeGreaterThan(0);
    const m = maximum(zs);
    const satz =
      `Entzerrte Marker: bis ${fmt1(m.px)} px verschoben, höchstens ` +
      `${fmt1(m.pp)} Prozentpunkte senkrecht oder ${fmt1(m.pct)} % im Preis waagerecht`;
    expect(notesAfter(anchor)).toContain(satz);
    expect(m.px).toBeLessThanOrEqual(DODGE.cap);
  });
});
