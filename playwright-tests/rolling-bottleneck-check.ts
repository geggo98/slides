/**
 * Prüft das Szenario „Wandernder Engpass“ im SystemDynamicsSimulator.
 *
 * Zieht die reine Simulationslogik (alles zwischen `function clamp` und dem
 * Abschnitt REACTIVE STATE) aus den .vue-Dateien und führt sie aus — es wird
 * also der echte Code getestet, keine Kopie.
 *
 *   1. Die drei unveränderten Szenarien liefern bit-gleiche Arrays wie HEAD.
 *   2. „rolling“: die Station mit dem höchsten Füllgrad wechselt über die Zeit
 *      (Quote-Service → Provider-Adapter → Gateway).
 *   3. Dieselbe Kette mit ~20 % Schutzkapazität: kein Rückstau, keine 503.
 *   4. Beide Decks enthalten dasselbe Szenario.
 *
 * usage: bun run playwright-tests/rolling-bottleneck-check.ts
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FILES = [
  "20260329-grafana-lgtm-monitoring-in-k8s-distributed-system/components/SystemDynamicsSimulator.vue",
  "20260711-sre-simulations/components/SystemDynamicsSimulator.vue",
];

type Stage = {
  name: string;
  capacity: number;
  bufferMax: number;
  damping: number;
  capacityDips?: { start: number; end: number; factor: number }[];
};
type Sim = {
  id: string;
  stages: Stage[];
  inputType: string;
  inputParams: Record<string, number>;
  duration: number;
  steps: number;
};
type Result = Record<"inputs" | "outputs" | "buffers" | "clipped", unknown>;
type Engine = {
  SIMS: Sim[];
  simulatePipeline: (
    input: (t: number) => number,
    stages: Stage[],
    steps: number,
    dt: number,
  ) => Result;
  signal: (s: Sim) => (t: number) => number;
};

function load(source: string): Engine {
  const start = source.indexOf("function clamp");
  const end = source.indexOf("REACTIVE STATE");
  if (start < 0 || end < 0) throw new Error("Simulationsblock nicht gefunden");
  const block = source.slice(start, source.lastIndexOf("/*", end));
  return new Function(`${block}
    const signal = (s) => {
      const p = s.inputParams;
      if (s.inputType === "dirac") return diracSignal(p.peakTime, p.peakWidth, p.peakHeight, p.baseRate);
      if (s.inputType === "step") return stepSignal(p.stepTime, p.stepDuration, p.highRate, p.lowRate);
      return oscillatingSignal(p.freq, p.amplitude, p.baseRate);
    };
    return { SIMS, simulatePipeline, signal };`)() as Engine;
}

let failed = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failed++;
};

const run = (e: Engine, s: Sim, stages = s.stages) =>
  e.simulatePipeline(e.signal(s), stages, s.steps, s.duration / s.steps);

const cur = load(readFileSync(FILES[0]!, "utf8"));
const head = load(
  execFileSync("git", ["show", `HEAD:${FILES[0]}`], { encoding: "utf8" }),
);

// 1. Unveränderte Szenarien bit-gleich
for (const id of ["springs", "dirac", "step"]) {
  const a = run(head, head.SIMS.find((s) => s.id === id)!);
  const b = run(cur, cur.SIMS.find((s) => s.id === id)!);
  check(JSON.stringify(a) === JSON.stringify(b), `${id}: identisch zu HEAD`);
}

// 2. rolling wandert
const rolling = cur.SIMS.find((s) => s.id === "rolling")!;
const dt = rolling.duration / rolling.steps;
const fillOf = (r: Result, stages: Stage[], t: number) =>
  stages.map((st, i) => (r.buffers as Float64Array[])[i]![t]! / st.bufferMax);
const r = run(cur, rolling);
const leaders: string[] = [];
for (let sec = 0; sec < rolling.duration; sec++) {
  const t = Math.min(rolling.steps - 1, Math.round((sec + 0.9) / dt));
  const fill = fillOf(r, rolling.stages, t);
  const max = Math.max(...fill);
  if (max > 0.15) {
    const name = rolling.stages[fill.indexOf(max)]!.name;
    if (leaders.at(-1) !== name) leaders.push(name);
  }
}
// Erstes Auftreten je Station; ein Rest-Rückstau nach dem letzten Einbruch
// (Gateway-Burst schwappt kurz in den Provider-Adapter) ist Modellverhalten.
const firstSeen = [...new Set(leaders)];
check(
  firstSeen.join(" → ") === "Quote-Service → Provider-Adapter → API Gateway",
  `rolling: Rückstau wandert (${leaders.join(" → ")})`,
);

// 3. Mit ~20 % Schutzkapazität bleibt es ruhig
const protectedStages = rolling.stages.map((s) => ({
  ...s,
  capacity: s.capacity * 1.2,
}));
const rp = run(cur, rolling, protectedStages);
const dropped = (r: Result) =>
  (r.clipped as Float64Array[]).reduce(
    (acc, a) => acc + a.reduce((x, y) => x + y, 0) * dt,
    0,
  );
const maxFill = Math.max(
  ...Array.from({ length: rolling.steps }, (_, t) =>
    Math.max(...fillOf(rp, protectedStages, t)),
  ),
);
check(
  dropped(r) > 0,
  `rolling: ohne Schutz werden Requests verworfen (${dropped(r).toFixed(1)})`,
);
check(dropped(rp) === 0, "rolling +20 %: keine 503");
check(
  maxFill < 0.3,
  `rolling +20 %: kaum Rückstau (max. Füllgrad ${maxFill.toFixed(2)})`,
);

// 4. Beide Decks dasselbe Szenario
const other = load(readFileSync(FILES[1]!, "utf8"));
check(
  JSON.stringify(other.SIMS.find((s) => s.id === "rolling")) ===
    JSON.stringify(rolling),
  "sre-sim: rolling identisch zum Monitoring-Deck",
);

console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nalles ok");
process.exit(failed ? 1 : 0);
