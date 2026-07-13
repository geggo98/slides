/**
 * littleEngine.js — kleiner diskreter-Ereignis-Kern (M/M/c) für die
 * Little's-Law-Rechen-Drills. Bewusst eigener Kern statt MM1Engine:
 * die Drills brauchen c Server, einen seeded PRNG (reproduzierbare
 * Messwerte pro Runde), eine Backlog-Vorbefüllung (Consumer-Lag) und
 * verankerte Seit-Anker-Statistiken für saubere Zwei-Phasen-Messungen
 * (Headroom-Runde: erst ρ=0,80 messen, dann +15 % einspielen).
 */
import { mulberry32 } from "./rng.js";

export class LittleEngine {
  constructor({ lambda, mu, c = 1, seed = 1, backlog0 = 0 }) {
    this.lambda0 = lambda;
    this.mu = mu;
    this.c = c;
    this.seed = seed;
    this.backlog0 = backlog0;
    this.reset();
  }

  reset() {
    this.rng = mulberry32(this.seed);
    this.lambda = this.lambda0;
    this.clock = 0;
    // Warteschlange = Ankunftszeitstempel (FIFO); Backlog-Items bekommen
    // synthetische Vergangenheits-Ankünfte „mit Rate λ eingetroffen“ —
    // so zeigt jede Backlog-Bedienung sofort w ≈ backlog0/λ (Lag-Alter).
    this.queue = [];
    this.servers = new Array(this.c).fill(null);
    this.nextArrival = this.expo(this.lambda);
    this.areaN = 0;
    this.cumW = 0;
    this.cumWq = 0;
    this.numArrivals = 0;
    this.numDepartures = 0;
    this.departures = []; // Ring {w, wq, st}
    this.anchor = this.snap();
    for (let i = 0; i < this.backlog0; i++)
      this.queue.push(-(this.backlog0 - i) / this.lambda);
    this.fillServers();
  }

  expo(rate) {
    return -Math.log(1 - this.rng()) / rate;
  }
  busy() {
    let b = 0;
    for (const s of this.servers) if (s) b++;
    return b;
  }
  N() {
    return this.queue.length + this.busy();
  }

  snap() {
    return {
      clock: this.clock,
      areaN: this.areaN,
      cumW: this.cumW,
      cumWq: this.cumWq,
      dep: this.numDepartures,
    };
  }
  markChange() {
    this.anchor = this.snap();
  }

  startService(i, arrival) {
    const st = this.expo(this.mu);
    this.servers[i] = {
      arrival,
      start: this.clock,
      st,
      depart: this.clock + st,
    };
  }
  fillServers() {
    for (let i = 0; i < this.c && this.queue.length; i++)
      if (!this.servers[i]) this.startService(i, this.queue.shift());
  }
  nextDeparture() {
    let t = Infinity;
    let idx = -1;
    for (let i = 0; i < this.c; i++) {
      const s = this.servers[i];
      if (s && s.depart < t) {
        t = s.depart;
        idx = i;
      }
    }
    return { t, idx };
  }

  advance(target) {
    let guard = 0;
    while (guard++ < 2e6) {
      const nd = this.nextDeparture();
      const tNext = Math.min(this.nextArrival, nd.t);
      if (tNext > target) break;
      this.integrate(tNext - this.clock);
      this.clock = tNext;
      if (this.nextArrival <= nd.t) this.handleArrival();
      else this.handleDeparture(nd.idx);
    }
    this.integrate(target - this.clock);
    this.clock = target;
  }
  integrate(dt) {
    if (dt > 0) this.areaN += this.N() * dt;
  }

  handleArrival() {
    this.numArrivals++;
    this.nextArrival = this.clock + this.expo(this.lambda);
    if (this.queue.length === 0) {
      for (let i = 0; i < this.c; i++)
        if (!this.servers[i]) {
          this.startService(i, this.clock);
          return;
        }
    }
    this.queue.push(this.clock);
  }
  handleDeparture(idx) {
    const s = this.servers[idx];
    const w = this.clock - s.arrival;
    const wq = s.start - s.arrival;
    this.numDepartures++;
    this.cumW += w;
    this.cumWq += wq;
    this.departures.push({ w, wq, st: s.st });
    if (this.departures.length > 4000) this.departures.shift();
    this.servers[idx] = null;
    if (this.queue.length) this.startService(idx, this.queue.shift());
  }

  /* Laständerung mid-run (Headroom-Runde): λ umstellen, nächste Ankunft neu
     ziehen, Statistik-Anker setzen — Messwerte danach gehören zur neuen Last. */
  setLambda(v) {
    this.lambda = v;
    this.nextArrival = this.clock + this.expo(v);
    this.markChange();
  }

  /* ---- Messwerte seit dem letzten Anker ---- */
  depSince() {
    return this.numDepartures - this.anchor.dep;
  }
  timeSince() {
    return this.clock - this.anchor.clock;
  }
  thrSince() {
    const t = this.timeSince();
    return t > 0 ? this.depSince() / t : 0;
  }
  meanWSince() {
    const n = this.depSince();
    return n > 0 ? (this.cumW - this.anchor.cumW) / n : null;
  }
  meanWqSince() {
    const n = this.depSince();
    return n > 0 ? (this.cumWq - this.anchor.cumWq) / n : null;
  }
  /* Gleitendes Fenster über die letzten n Abgänge (Transienten-arm; der
     Aufrufer klemmt n auf depSince(), damit keine Vor-Anker-Werte einfließen). */
  meanLast(field, n) {
    const d = this.departures;
    if (!d.length || n <= 0) return null;
    const m = Math.min(n, d.length);
    let s = 0;
    for (let i = d.length - m; i < d.length; i++) s += d[i][field];
    return s / m;
  }
  LavgSince() {
    const t = this.timeSince();
    return t > 0 ? (this.areaN - this.anchor.areaN) / t : 0;
  }
  /* Little-Konsistenz λ̂·Ŵ/L̂ = ΣW / ∫N dt (seit Anker) — muss gegen 1 gehen. */
  littleSince() {
    const dA = this.areaN - this.anchor.areaN;
    return dA > 0 ? (this.cumW - this.anchor.cumW) / dA : 1;
  }
}
