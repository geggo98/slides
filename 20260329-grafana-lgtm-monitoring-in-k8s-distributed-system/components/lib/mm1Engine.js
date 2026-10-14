/**
 * mm1Engine.js — diskreter-Ereignis-Kern (M/M/1) + XY-Chart (Phasenraum).
 * Aus mm1-simulator.jsx übernommen; `drawXY` nimmt die Grafana-Palette `C`
 * (lib/grafanaPalette.ts) + Fonts entgegen.
 */
import { randomPerson, withAlpha } from "./queueing.js";

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
    this.cumWq = 0;
    this.numArrivals = 0;
    this.numDepartures = 0;
    this.departures = [];
    this.settleAnchorDep = 0;
    this.overflow = 0;
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
    c.serviceTime = this.expo(this.mu);
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
    this.cumWq += wq;
    this.departures.push({ w, wq, st: c.serviceTime });
    if (this.departures.length > 4000) this.departures.shift();
    if (this.queue.length) this.startService(this.queue.shift());
    else if (this.overflow > 0) {
      this.overflow--;
      this.startService({ id: this.nextId++, arrival: this.clock });
    } else {
      this.inService = null;
      this.nextDeparture = Infinity;
    }
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
  Lavg() {
    return this.clock > 0 ? this.areaN / this.clock : 0;
  }
}

export { K as MM1_WINDOW };

/* ---- Geometrie-Konstanten ---- */
export const XY = {
  W: 440,
  H: 236,
  padL: 48,
  padR: 10,
  padT: 14,
  padB: 34,
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

/* ---- XY-Chart (Phasenraum): Latency Wq über Saturation ρ — Theorie-Kurve +
   aktueller Messpunkt mit verblassender Spur. Wie Grafanas XY-Chart: zwei
   Metriken gegeneinander statt gegen die Zeit.
   `C` = aufgelöste Palette (useGrafanaPalette().value), `fonts` = {MONO, SANS}. */
export function drawXY(ctx, C, fonts, trail, rhoSet, yMeas, over) {
  const { MONO, SANS } = fonts;
  const { W, H, padL, padR, padT, padB, RHO_MAX, YMAX } = XY;
  const px = (r) => padL + (r / RHO_MAX) * (W - padL - padR);
  const py = (y) => H - padB - (Math.min(y, YMAX) / YMAX) * (H - padT - padB);
  ctx.clearRect(0, 0, W, H);
  for (const [a, b, col] of [
    [0, 0.7, withAlpha(C.ok, 0.06)],
    [0.7, 0.9, withAlpha(C.warn, 0.08)],
    [0.9, 1.0, withAlpha(C.crit, 0.08)],
    [1.0, RHO_MAX, withAlpha(C.crit, 0.18)],
  ]) {
    ctx.fillStyle = col;
    ctx.fillRect(px(a), padT, px(b) - px(a), H - padT - padB);
  }

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = C.textMid;
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
  ctx.font = `12px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Saturation: Auslastung ρ = λ/μ", (padL + W - padR) / 2, H - 2);
  ctx.save();
  ctx.translate(14, (padT + H - padB) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText("Latency: Wartezeit Wq (× Bed.)", 0, 0);
  ctx.restore();

  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C.warn;
  ctx.beginPath();
  ctx.moveTo(px(0.8), padT);
  ctx.lineTo(px(0.8), H - padB);
  ctx.stroke();
  ctx.strokeStyle = C.crit;
  ctx.beginPath();
  ctx.moveTo(px(1.0), padT);
  ctx.lineTo(px(1.0), H - padB);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.warn;
  ctx.font = `11px ${MONO}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("80 % → 4×", px(0.8) - 4, padT + 2);
  ctx.fillStyle = C.crit;
  ctx.fillText("ρ=1: kein Gleichgewicht", px(1.0) - 4, padT + 16);

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

  const live = C.series.wq;
  for (const p of trail) {
    const a = p.alpha;
    ctx.fillStyle = withAlpha(live, 0.06 + 0.4 * a);
    ctx.beginPath();
    ctx.arc(px(p.rho), py(p.y), 2.5 + 2 * a, 0, 2 * Math.PI);
    ctx.fill();
  }
  if (yMeas != null) {
    const X = px(rhoSet),
      Y = py(yMeas);
    ctx.fillStyle = live;
    ctx.strokeStyle = C.panel;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X, Y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    if (over) {
      ctx.fillStyle = C.crit;
      ctx.font = `bold 12px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("▲ läuft davon", X, padT + 16);
    }
  }
}
