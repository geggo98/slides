/**
 * mm1Engine.js — diskreter-Ereignis-Kern (M/M/1) + Phosphor-Scope-Zeichnung.
 * Aus mm1-simulator.jsx übernommen; `drawScope` nimmt jetzt die adaptive
 * Palette `C` + Fonts entgegen (statt modul-globaler fester Farben).
 */
import { randomPerson, withAlpha, WATER_SPEEDUP } from "./queueing.js";

const K = 80; // gleitendes Fenster (Anzahl letzter Abgänge)

/* ---- DES-Kern — reine M/M/1-Simulation, getrennt von der Animation ---- */
export class MM1Engine {
  constructor(lambda, mu) {
    this.lambda = lambda;
    this.mu = mu;
    this.reset();
  }
  reset() {
    this.clock = 0;
    this.queue = [];
    this.inService = null;
    this.nextArrival = this.expo(this.lambda);
    this.nextDeparture = Infinity;
    this.nextId = 1;
    this.areaN = 0;
    this.areaNq = 0;
    this.busyTime = 0;
    this.cumW = 0;
    this.cumWq = 0;
    this.numArrivals = 0;
    this.numDepartures = 0;
    this.departures = [];
    this.depTimes = [];
    this.settleAnchorDep = 0;
    this.overflow = 0;
    this.numShed = 0;
    this.waterLeft = 0; // Feature-Shed: so viele Bedienstarts nur noch 🥛
  }
  expo(rate) {
    return -Math.log(1 - Math.random()) / rate;
  }
  N() {
    return this.queue.length + this.overflow + (this.inService ? 1 : 0);
  }
  Nq() {
    return this.queue.length + this.overflow;
  }
  markChange() {
    this.settleAnchorDep = this.numDepartures;
  }

  startService(c) {
    this.inService = c;
    c.serviceStart = this.clock;
    if (this.waterLeft > 0) {
      // Feature-Shed: super einfaches Gericht (🥛) — 10× schnellere Bedienung,
      // niemand wird verworfen.
      this.waterLeft--;
      c.water = true;
      c.serviceTime = this.expo(this.mu * WATER_SPEEDUP);
    } else {
      c.water = false;
      c.serviceTime = this.expo(this.mu);
    }
    this.nextDeparture = this.clock + c.serviceTime;
  }
  integrate(dt) {
    if (dt <= 0) return;
    this.areaN += this.N() * dt;
    this.areaNq += this.Nq() * dt;
    if (this.inService) this.busyTime += dt;
  }
  advance(target) {
    let g = 0;
    while (g++ < 1e6) {
      const tNext = Math.min(this.nextArrival, this.nextDeparture);
      if (tNext > target) break;
      this.integrate(tNext - this.clock);
      this.clock = tNext;
      if (this.nextArrival <= this.nextDeparture) this.handleArrival();
      else this.handleDeparture();
    }
    this.integrate(target - this.clock);
    this.clock = target;
  }
  handleArrival() {
    const c = { id: this.nextId++, arrival: this.clock };
    this.numArrivals++;
    this.nextArrival = this.clock + this.expo(this.lambda);
    if (!this.inService) this.startService(c);
    else if (this.queue.length < 5000)
      this.queue.push(c); // Sicherheitsventil
    else this.overflow++; // Backlog zählen, nicht speichern
  }
  handleDeparture() {
    const c = this.inService;
    const w = this.clock - c.arrival,
      wq = c.serviceStart - c.arrival;
    this.numDepartures++;
    this.cumW += w;
    this.cumWq += wq;
    this.departures.push({ w, wq, st: c.serviceTime });
    if (this.departures.length > 4000) this.departures.shift();
    this.depTimes.push(this.clock);
    const lo = this.clock - 60;
    while (this.depTimes.length && this.depTimes[0] < lo) this.depTimes.shift();
    if (this.queue.length) this.startService(this.queue.shift());
    else if (this.overflow > 0) {
      this.overflow--;
      this.startService({ id: this.nextId++, arrival: this.clock });
    } else {
      this.inService = null;
      this.nextDeparture = Infinity;
    }
  }
  /* Batch-Ankunft (Bus): n Kunden auf einen Schlag, als Dirac-Impuls auf die
     Schlange. Zählt als reguläre Ankünfte; Einschwing-Anker wird neu gesetzt.
     `tag` wird an die Kunden gehängt (z.B. { robot: true } für die Anzeige). */
  injectBurst(n, tag) {
    for (let i = 0; i < n; i++) {
      const c = { id: this.nextId++, arrival: this.clock, ...tag };
      this.numArrivals++;
      if (!this.inService) this.startService(c);
      else if (this.queue.length < 5000) this.queue.push(c);
      else this.overflow++;
    }
    this.markChange();
  }

  /* Feature-Shed (Graceful Degradation): jeder Wartende wird bedient, aber
     die nächsten n Bedienstarts servieren nur ein Glas Wasser 🥛 —
     WATER_SPEEDUP-fach schnellere Bedienung statt verworfener Kunden. */
  featureShed(n) {
    this.waterLeft = n;
    this.markChange();
  }

  /* Load-Shedding: verwirft alle Wartenden (nicht den Kunden in Bedienung).
     Verworfene verlassen das System unbedient — sie tauchen nie in den
     Abgangs-Statistiken auf (deshalb weicht der Little-Check danach kurz ab).
     Liefert die verworfenen Kunden für die Abgang-nach-unten-Animation. */
  shedQueue() {
    const dropped = this.queue.splice(0, this.queue.length);
    const total = dropped.length + this.overflow;
    this.overflow = 0;
    this.numShed += total;
    this.markChange();
    return { dropped, total };
  }

  _meanLast(field, n) {
    const d = this.departures;
    if (!d.length) return null;
    const m = Math.min(n, d.length);
    let s = 0;
    for (let i = d.length - m; i < d.length; i++) s += d[i][field];
    return s / m;
  }
  meanWq(n) {
    return this._meanLast("wq", n);
  }
  meanW(n) {
    return this._meanLast("w", n);
  }
  meanSt(n) {
    return this._meanLast("st", n) ?? 1 / this.mu;
  }
  throughput(win) {
    const lo = this.clock - win;
    let c = 0;
    for (let i = this.depTimes.length - 1; i >= 0; i--) {
      if (this.depTimes[i] >= lo) c++;
      else break;
    }
    return c / win;
  }
  Lavg() {
    return this.clock > 0 ? this.areaN / this.clock : 0;
  }
  littleRatio() {
    return this.areaN > 0 ? this.cumW / this.areaN : 1;
  }
}

export { K as MM1_WINDOW };

/* ---- Geometrie-Konstanten ---- */
export const SCOPE = {
  W: 660,
  H: 380,
  padL: 52,
  padR: 18,
  padT: 22,
  padB: 40,
  RHO_MAX: 1.08,
  YMAX: 20,
};
export const ST = {
  W: 1000,
  H: 360,
  qFrontX: 660,
  qSlot: 34,
  qMaxDraw: 13,
  serviceX: 740,
  serviceY: 192,
  lineY: 192,
  qLeft: 305,
};

export function spawn(id) {
  return {
    state: "queue",
    emoji: randomPerson(),
    x: -30,
    y: 60 + Math.random() * 240,
    tx: ST.qFrontX,
    ty: ST.lineY,
    opacity: 1,
    draw: true,
  };
}

/* ---- Phosphor-Scope: Wq(ρ) — Theorie-Kurve + Live-Punkt mit Nachleuchten ----
   `C` = aufgelöste Palette (useScopeColors().value), `fonts` = {MONO, SANS}. */
export function drawScope(ctx, C, fonts, trail, rhoSet, yMeas, over) {
  const { MONO, SANS } = fonts;
  const { W, H, padL, padR, padT, padB, RHO_MAX, YMAX } = SCOPE;
  const px = (r) => padL + (r / RHO_MAX) * (W - padL - padR);
  const py = (y) => H - padB - (Math.min(y, YMAX) / YMAX) * (H - padT - padB);
  ctx.clearRect(0, 0, W, H);
  for (const [a, b, col] of [
    [0, 0.7, withAlpha(C.phosphor, 0.05)],
    [0.7, 0.9, withAlpha(C.amber, 0.06)],
    [0.9, 1.0, withAlpha(C.red, 0.07)],
    [1.0, RHO_MAX, withAlpha(C.red, 0.16)],
  ]) {
    ctx.fillStyle = col;
    ctx.fillRect(px(a), padT, px(b) - px(a), H - padT - padB);
  }

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = C.textLow;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let r = 0; r <= 1.0001; r += 0.2) {
    ctx.beginPath();
    ctx.moveTo(px(r), padT);
    ctx.lineTo(px(r), H - padB);
    ctx.stroke();
    ctx.fillText(r.toFixed(1), px(r), H - padB + 6);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const yv of [0, 4, 8, 12, 16, 20]) {
    ctx.beginPath();
    ctx.moveTo(padL, py(yv));
    ctx.lineTo(W - padR, py(yv));
    ctx.stroke();
    ctx.fillText(yv === 20 ? "≥20×" : yv + "×", padL - 6, py(yv));
  }
  ctx.fillStyle = C.textMid;
  ctx.font = `11px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Auslastung  ρ = λ/μ", (padL + W - padR) / 2, H - 4);
  ctx.save();
  ctx.translate(12, (padT + H - padB) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Wartezeit  Wq  (× Bedienzeit)", 0, 0);
  ctx.restore();

  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C.amber;
  ctx.beginPath();
  ctx.moveTo(px(0.8), padT);
  ctx.lineTo(px(0.8), H - padB);
  ctx.stroke();
  ctx.strokeStyle = C.red;
  ctx.beginPath();
  ctx.moveTo(px(1.0), padT);
  ctx.lineTo(px(1.0), H - padB);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.amber;
  ctx.font = `10px ${MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("80 % → 4×", px(0.8) + 4, padT + 2);
  ctx.fillStyle = C.red;
  ctx.fillText("ρ=1: kein Gleichgewicht", px(1.0) + 4, padT + 16);

  ctx.strokeStyle = C.theory;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let r = 0; r <= 0.9999; r += 0.004) {
    const y = r / (1 - r);
    if (y > YMAX * 1.2) break;
    const X = px(r),
      Y = py(y);
    if (first) {
      ctx.moveTo(X, Y);
      first = false;
    } else ctx.lineTo(X, Y);
  }
  ctx.stroke();

  for (const p of trail) {
    const a = p.alpha;
    ctx.fillStyle = withAlpha(C.phosphor, 0.05 + 0.35 * a);
    ctx.beginPath();
    ctx.arc(px(p.rho), py(p.y), 2.2 + 2 * a, 0, 2 * Math.PI);
    ctx.fill();
  }
  if (yMeas != null) {
    const X = px(rhoSet),
      Y = py(yMeas);
    ctx.shadowColor = C.phosphor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = C.phosphor;
    ctx.beginPath();
    ctx.arc(X, Y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (over) {
      ctx.fillStyle = C.red;
      ctx.font = `bold 12px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("▲ läuft davon", X, padT + 16);
    }
  }
}
