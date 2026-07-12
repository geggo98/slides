/**
 * mmc.js — diskreter-Ereignis-Kern (M/M/c-Vergleich) + Crossover-Scope.
 * Aus mmc-compare.jsx übernommen; `drawScope` nimmt jetzt Palette `C` + Fonts.
 */
import { expo, foodFor, randomPerson, WATER_SPEEDUP } from "./queueing.js";

const K = 120; // gleitendes Fenster (Abgänge)
const MAXQ = 4000; // Sicherheitsventil je Queue

/* ---- Theorie (für Scoreboard-Striche und Scope-Kurven) ---- */
export function erlangC(c, a) {
  const rho = a / c;
  if (rho >= 1) return 1;
  let sum = 0,
    term = 1;
  for (let k = 0; k < c; k++) {
    sum += term;
    term *= a / (k + 1);
  }
  const top = term / (1 - rho);
  return top / (sum + top);
}
export function theory(sys, lam, mu, c) {
  const rho = lam / (c * mu);
  if (rho >= 1) return { pw: 1, Wq: Infinity, T: Infinity, L: Infinity, rho };
  if (sys === "pool") {
    const a = lam / mu,
      pw = erlangC(c, a),
      Wq = pw / (c * mu - lam),
      T = Wq + 1 / mu;
    return { pw, Wq, T, L: lam * T, rho };
  }
  if (sys === "tempo") {
    // 1 Server @ cμ
    const Wq = rho / (c * mu - lam),
      T = Wq + 1 / (c * mu);
    return { pw: rho, Wq, T, L: lam * T, rho };
  }
  // pooling: c unabhängige M/M/1 @ μ, je λ/c
  const Wq = rho / (mu - lam / c),
    T = Wq + 1 / mu;
  return { pw: rho, Wq, T, L: lam * T, rho };
}

/* ---- Subsystem — generisch: Pool (geteilt), Tempo (1 schnell), Pooling (c Spuren) ---- */
export class Subsystem {
  constructor({ nServers, nQueues, serviceDiv, side }) {
    this.nServers = nServers;
    this.nQueues = nQueues;
    this.serviceDiv = serviceDiv;
    this.side = side;
    this.servers = Array.from({ length: nServers }, () => ({
      busy: false,
      cust: null,
      depart: Infinity,
      food: null,
    }));
    this.queues = Array.from({ length: nQueues }, () => []);
    this.areaN = 0;
    this.cumW = 0;
    this.numDep = 0;
    this.overflow = 0;
    this.numShed = 0;
    this.waterLeft = 0; // Feature-Shed: so viele Bedienstarts nur noch 🥛
    this.dep = []; // {w,wq,waited}
  }
  N() {
    let n = this.overflow;
    for (const s of this.servers) if (s.busy) n++;
    for (const q of this.queues) n += q.length;
    return n;
  }
  integrate(dt) {
    if (dt > 0) this.areaN += this.N() * dt;
  }
  nextDepart() {
    let m = Infinity;
    for (const s of this.servers) if (s.busy && s.depart < m) m = s.depart;
    return m;
  }
  meanRef() {
    return 1 / this.world.mu / this.serviceDiv;
  }

  findFree(qIdx) {
    if (this.nQueues === 1) {
      for (let i = 0; i < this.nServers; i++)
        if (!this.servers[i].busy) return i;
      return -1;
    }
    return this.servers[qIdx].busy ? -1 : qIdx;
  }
  start(i, cust, clock) {
    const s = this.servers[i];
    s.busy = true;
    s.cust = cust;
    cust.serviceStartT = clock;
    cust.serverIdx = i;
    let t = cust.S / this.serviceDiv;
    if (this.waterLeft > 0) {
      // Feature-Shed: 🥛 statt Menü — derselbe (gekoppelte) Zufallszug S,
      // nur WATER_SPEEDUP-fach schneller; niemand wird verworfen.
      this.waterLeft--;
      t /= WATER_SPEEDUP;
      s.food = "🥛";
    } else {
      s.food = foodFor(t, this.meanRef());
    }
    s.depart = clock + t;
  }
  arrive(base, clock) {
    const cust = {
      id: base.id,
      arrival: base.arrival,
      S: base.S,
      emoji: base.emoji,
      waited: false,
      serviceStartT: 0,
      serverIdx: -1,
    };
    const qIdx = this.nQueues === 1 ? 0 : (Math.random() * this.nQueues) | 0;
    const free = this.findFree(qIdx);
    if (free >= 0 && this.queues[qIdx].length === 0)
      this.start(free, cust, clock);
    else {
      cust.waited = true;
      if (this.queues[qIdx].length < MAXQ) this.queues[qIdx].push(cust);
      else this.overflow++;
    }
  }
  departEarliest(clock, world) {
    let i = -1,
      m = Infinity;
    for (let k = 0; k < this.nServers; k++) {
      const s = this.servers[k];
      if (s.busy && s.depart < m) {
        m = s.depart;
        i = k;
      }
    }
    if (i < 0) return;
    const s = this.servers[i],
      cust = s.cust;
    this.numDep++;
    this.cumW += clock - cust.arrival;
    this.dep.push({
      w: clock - cust.arrival,
      wq: cust.serviceStartT - cust.arrival,
      waited: cust.waited,
    });
    if (this.dep.length > 3000) this.dep.shift();
    s.busy = false;
    s.cust = null;
    s.depart = Infinity;
    s.food = null;
    if (cust.id >= 0) world.recordDeparture(this.side, cust.id, clock);
    const qIdx = this.nQueues === 1 ? 0 : i;
    if (this.queues[qIdx].length)
      this.start(i, this.queues[qIdx].shift(), clock);
    else if (this.overflow > 0) {
      this.overflow--;
      this.start(
        i,
        {
          id: -1,
          arrival: clock,
          S: expo(world.mu),
          emoji: "🍎",
          waited: true,
          serviceStartT: clock,
        },
        clock,
      );
    }
  }
  /* „Leichter Cheat“ nach dem Vorspulen: setzt dieses Subsystem deterministisch
     auf ~`waiting` Wartende (überzählige abschneiden, fehlende ergänzen) und
     belegt bei Wartenden alle Server (work-conserving). Frische Kunden bekommen
     id=-1 → sie zählen NICHT in der Renn-Wertung. Reproduzierbarer Startzustand. */
  snap(waiting, clock) {
    waiting = Math.max(0, Math.round(waiting));
    this.overflow = 0;
    const mk = () => ({
      id: -1,
      arrival: clock,
      S: expo(this.world.mu),
      emoji: randomPerson(),
      waited: true,
      serviceStartT: clock,
      serverIdx: -1,
    });
    const rho = this.world.lambda / (this.world.c * this.world.mu);
    // Wartende ⇒ alle Server belegt; sonst im Mittel belegte Serverzahl.
    const busyTarget =
      waiting > 0
        ? this.nServers
        : Math.min(this.nServers, Math.round(this.nServers * rho));
    for (let i = 0; i < this.nServers; i++) {
      const s = this.servers[i];
      if (i < busyTarget) {
        if (!s.busy) this.start(i, mk(), clock);
      } else if (s.busy) {
        s.busy = false;
        s.cust = null;
        s.depart = Infinity;
        s.food = null;
      }
    }
    for (const q of this.queues) q.length = 0;
    for (let k = 0; k < waiting; k++) this.queues[k % this.nQueues].push(mk());
  }
  metrics() {
    const d = this.dep;
    const n = Math.min(K, d.length);
    if (!n)
      return {
        pw: 0,
        Wq: 0,
        T: 0,
        N: this.N(),
        L: this.areaN / Math.max(1e-9, this.world.clock),
      };
    let sw = 0,
      st = 0,
      swait = 0;
    for (let i = d.length - n; i < d.length; i++) {
      sw += d[i].wq;
      st += d[i].w;
      swait += d[i].waited ? 1 : 0;
    }
    return {
      pw: swait / n,
      Wq: sw / n,
      T: st / n,
      N: this.N(),
      L: this.areaN / Math.max(1e-9, this.world.clock),
    };
  }
}

/* ---- World — gemeinsamer Ankunftsstrom + zwei Subsysteme + Rennzähler ---- */
export class World {
  constructor(lambda, mu, c, mode) {
    this.lambda = lambda;
    this.mu = mu;
    this.c = c;
    this.mode = mode;
    this.configure();
  }
  configure() {
    this.clock = 0;
    this.nextId = 1;
    this.nextArrival = expo(this.lambda);
    this.completion = new Map();
    this.race = [];
    this.right = new Subsystem({
      nServers: this.c,
      nQueues: 1,
      serviceDiv: 1,
      side: "r",
    });
    this.left =
      this.mode === "tempo"
        ? new Subsystem({
            nServers: 1,
            nQueues: 1,
            serviceDiv: this.c,
            side: "l",
          })
        : new Subsystem({
            nServers: this.c,
            nQueues: this.c,
            serviceDiv: 1,
            side: "l",
          });
    this.left.world = this;
    this.right.world = this;
  }
  recordDeparture(side, id, t) {
    let e = this.completion.get(id);
    if (!e) {
      e = {};
      this.completion.set(id, e);
    }
    e[side] = t;
    if (e.l != null && e.r != null) {
      this.race.push({ lFirst: e.r > e.l, diff: Math.abs(e.r - e.l) });
      if (this.race.length > 250) this.race.shift();
      this.completion.delete(id);
    }
    if (this.completion.size > 50000) {
      const k = this.completion.keys().next().value;
      this.completion.delete(k);
    }
  }
  integrate(dt) {
    this.left.integrate(dt);
    this.right.integrate(dt);
  }
  advance(target) {
    let g = 0;
    while (g++ < 1e6) {
      const tA = this.nextArrival,
        dL = this.left.nextDepart(),
        dR = this.right.nextDepart();
      const tMin = Math.min(tA, dL, dR);
      if (tMin > target) break;
      this.integrate(tMin - this.clock);
      this.clock = tMin;
      if (tA <= dL && tA <= dR) {
        const base = {
          id: this.nextId++,
          arrival: this.clock,
          S: expo(this.mu),
          emoji: randomPerson(),
        };
        this.left.arrive(base, this.clock);
        this.right.arrive(base, this.clock);
        this.nextArrival = this.clock + expo(this.lambda);
      } else if (dL <= dR) this.left.departEarliest(this.clock, this);
      else this.right.departEarliest(this.clock, this);
    }
    this.integrate(target - this.clock);
    this.clock = target;
  }
  /* Batch-Ankunft (Bus): n Zwillinge auf einen Schlag in BEIDE Subsysteme —
     gleiche id, gleicher Arbeitsbedarf S, damit das Rennen fair bleibt. */
  injectBurst(n) {
    for (let i = 0; i < n; i++) {
      const base = {
        id: this.nextId++,
        arrival: this.clock,
        S: expo(this.mu),
        emoji: "🤖",
      };
      this.left.arrive(base, this.clock);
      this.right.arrive(base, this.clock);
    }
  }

  /* Feature-Shed (Graceful Degradation): beide Seiten servieren den nächsten
     n Bedienstarts nur ein Glas Wasser 🥛 — bedient wird jeder. */
  featureShed(n) {
    this.left.waterLeft = n;
    this.right.waterLeft = n;
  }

  /* Load-Shedding: verwirft alle Wartenden beider Subsysteme (nicht die in
     Bedienung). Halb gelaufene Zwillinge fliegen aus der Rennwertung —
     verworfene tauchen nie in den Abgangs-Statistiken auf. Liefert die
     Verworfenen je Seite für die Abgang-nach-unten-Animation. */
  shedQueues() {
    const drop = (sub) => {
      const dropped = [];
      for (const q of sub.queues) dropped.push(...q.splice(0, q.length));
      const total = dropped.length + sub.overflow;
      sub.overflow = 0;
      sub.numShed += total;
      return { dropped, total };
    };
    const l = drop(this.left);
    const r = drop(this.right);
    for (const cust of [...l.dropped, ...r.dropped])
      this.completion.delete(cust.id);
    return { l, r };
  }

  /* „Leichter Cheat“ am Ende des Vorspulens: beide Subsysteme deterministisch
     auf ihre theoretische Warteschlangenlänge Lq = λ·Wq (Little) setzen, damit
     der Vergleich reproduzierbar von einem definierten Stand aus startet.
     Offene Zwillings-Halbläufe werden verworfen (die neuen Kunden sind id=-1). */
  snapToSteadyState() {
    const rho = this.lambda / (this.c * this.mu);
    if (rho >= 1) return;
    const leftSys = this.mode === "tempo" ? "tempo" : "pooling";
    const wqL = theory(leftSys, this.lambda, this.mu, this.c).Wq;
    const wqR = theory("pool", this.lambda, this.mu, this.c).Wq;
    this.left.snap(this.lambda * wqL, this.clock);
    this.right.snap(this.lambda * wqR, this.clock);
    this.completion.clear();
  }

  raceSummary() {
    const rr = this.race;
    let lc = 0,
      ls = 0,
      rs = 0,
      rc = 0;
    for (const x of rr) {
      if (x.lFirst) {
        lc++;
        ls += x.diff;
      } else {
        rc++;
        rs += x.diff;
      }
    }
    const n = rr.length;
    return {
      n,
      lPct: n ? lc / n : 0,
      rPct: n ? rc / n : 0,
      lLead: lc ? (ls / lc) * this.mu : 0,
      rLead: rc ? (rs / rc) * this.mu : 0,
    };
  }
}

/* ---- Layout je Seite (SVG viewBox 480×360) ---- */
// Flacheres viewBox (300 statt 360), damit beide Kantinen + Race-Bar + Kennzahlen
// auf eine Folie passen, ohne die Bühnen zu schmal zu machen.
export const SV = { W: 480, H: 300, xServer: 392, drawCap: 5, qy1: 150 };
export function makeLayout(sub) {
  const n = sub.nServers;
  const ys =
    n === 1
      ? [SV.qy1]
      : Array.from({ length: n }, (_, i) => 50 + i * (200 / (n - 1)));
  return {
    ys,
    xServer: SV.xServer,
    drawCap: SV.drawCap,
    qy1: SV.qy1,
    nQueues: sub.nQueues,
    serverPos: ys.map((y) => ({ x: SV.xServer, y })),
    queueSlot: (q, p) => ({
      x: SV.xServer - 48 - p * 30,
      y: sub.nQueues === 1 ? SV.qy1 : ys[q],
    }),
  };
}
// „+N“ mittig: bei vollem Lauf vordere FH + hintere BH zeichnen, Lücke in der
// Mitte (Slot MID) für das hervorgehobene Badge.
const Q_FRONT = 2;
const Q_BACK = 2;
const Q_MID = 2; // Lücken-Slot (zwischen Slot 1 und 3)

export function reconcile(sub, vis, layout, dtReal) {
  const present = new Set();
  const badges = [];
  for (let i = 0; i < sub.nServers; i++) {
    const s = sub.servers[i];
    if (!s.busy) continue;
    const c = s.cust;
    present.add(c.id);
    let v = vis.get(c.id);
    if (!v) {
      v = spawnE(c.emoji);
      vis.set(c.id, v);
    }
    v.tx = layout.serverPos[i].x;
    v.ty = layout.serverPos[i].y;
    v.state = "svc";
  }
  const placeQ = (c, q, p) => {
    present.add(c.id);
    let v = vis.get(c.id);
    if (!v) {
      v = spawnE(c.emoji);
      vis.set(c.id, v);
    }
    const pos = layout.queueSlot(q, p);
    v.tx = pos.x;
    v.ty = pos.y;
    v.state = "q";
  };
  for (let q = 0; q < sub.queues.length; q++) {
    const Q = sub.queues[q];
    const len = Q.length;
    if (len > layout.drawCap) {
      for (let p = 0; p < Q_FRONT; p++) placeQ(Q[p], q, p);
      for (let b = 0; b < Q_BACK; b++)
        placeQ(Q[len - Q_BACK + b], q, layout.drawCap - Q_BACK + b);
      const mid = layout.queueSlot(q, Q_MID);
      badges.push({ x: mid.x, y: mid.y, n: len - (Q_FRONT + Q_BACK) });
    } else {
      for (let p = 0; p < len; p++) placeQ(Q[p], q, p);
    }
  }
  for (const [id, v] of vis)
    if (!present.has(id) && v.state !== "leave" && v.state !== "shed") {
      v.state = "leave";
      v.tx = 520;
      v.ty = 50 + Math.random() * 260;
    }
  const k = 1 - Math.exp(-6 * dtReal),
    out = [];
  for (const [id, v] of vis) {
    v.x += (v.tx - v.x) * k;
    v.y += (v.ty - v.y) * k;
    if (v.state === "leave" && v.x > 504) {
      vis.delete(id);
      continue;
    }
    if (v.state === "shed" && v.y > SV.H + 16) {
      vis.delete(id);
      continue;
    }
    v.opacity =
      v.state === "leave"
        ? Math.max(0, 1 - (v.x - 480) / 24)
        : v.state === "shed"
          ? Math.max(0.15, 1 - (v.y - SV.qy1) / 170)
          : 1;
    out.push({ id, x: v.x, y: v.y, emoji: v.emoji, opacity: v.opacity });
  }
  return { entities: out, badges };
}
/* Haltestelle des Burst-Busses (oben links, unter dem „Ankunft"-Label) —
   Burst-Roboter steigen hier aus statt links zu spawnen. */
export const BUS_STOP = { x: 58, y: 64 };
export const spawnE = (emoji) =>
  emoji === "🤖"
    ? {
        emoji,
        x: BUS_STOP.x,
        y: BUS_STOP.y + 16,
        tx: 0,
        ty: 0,
        state: "q",
        opacity: 1,
      }
    : {
        emoji,
        x: -20,
        y: 50 + Math.random() * 260,
        tx: 0,
        ty: 0,
        state: "q",
        opacity: 1,
      };

/* ---- Crossover-Scope je Metrik (Theoriekurven + Live-Punkte) ---- */
export const SC = {
  W: 560,
  H: 300,
  padL: 46,
  padR: 14,
  padT: 16,
  padB: 34,
  RHO_MAX: 0.985,
};
export function drawScope(
  ctx,
  C,
  fonts,
  metric,
  mu,
  c,
  mode,
  liveL,
  liveR,
  rhoNow,
) {
  const { MONO, SANS } = fonts;
  const { W, H, padL, padR, padT, padB, RHO_MAX } = SC;
  const isP = metric === "pw";
  const YMAX = isP ? 1.05 : metric === "T" ? 14 : 12;
  const norm = (v) => (isP ? v : v * mu); // Wq/T in Bedienzeiten
  const px = (r) => padL + (r / RHO_MAX) * (W - padL - padR);
  const py = (y) => H - padB - (Math.min(y, YMAX) / YMAX) * (H - padT - padB);
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.font = `10px ${MONO}`;
  ctx.fillStyle = C.textLow;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let r = 0; r <= RHO_MAX + 1e-6; r += 0.2) {
    ctx.beginPath();
    ctx.moveTo(px(r), padT);
    ctx.lineTo(px(r), H - padB);
    ctx.stroke();
    ctx.fillText(r.toFixed(1), px(r), H - padB + 5);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const yticks = isP
    ? [0, 0.25, 0.5, 0.75, 1]
    : metric === "T"
      ? [0, 4, 8, 12]
      : [0, 3, 6, 9, 12];
  for (const yv of yticks) {
    ctx.beginPath();
    ctx.moveTo(padL, py(yv));
    ctx.lineTo(W - padR, py(yv));
    ctx.stroke();
    ctx.fillText(isP ? yv.toFixed(2) : yv + "×", padL - 5, py(yv));
  }

  ctx.fillStyle = C.textMid;
  ctx.font = `11px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Auslastung ρ = λ/(cμ)", (padL + W - padR) / 2, H - 2);

  const leftSys = mode === "tempo" ? "tempo" : "pooling";
  const curve = (sys, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let r = 0.02; r <= RHO_MAX; r += 0.004) {
      const lam = r * c * mu,
        t = theory(sys, lam, mu, c);
      const y = norm(metric === "pw" ? t.pw : metric === "T" ? t.T : t.Wq);
      if (!Number.isFinite(y)) break;
      const X = px(r),
        Y = py(y);
      if (first) {
        ctx.moveTo(X, Y);
        first = false;
      } else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  };
  curve("pool", C.pool);
  curve(leftSys, C.alt);

  // aktuelle ρ-Linie
  if (rhoNow > 0 && rhoNow < RHO_MAX) {
    ctx.strokeStyle = C.gridStrong;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px(rhoNow), padT);
    ctx.lineTo(px(rhoNow), H - padB);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Live-Punkte
  const dot = (val, color) => {
    const y = norm(val);
    if (!Number.isFinite(y) || rhoNow <= 0 || rhoNow >= RHO_MAX) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(rhoNow), py(y), 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  const pick = (m) => (metric === "pw" ? m.pw : metric === "T" ? m.T : m.Wq);
  dot(pick(liveR), C.pool);
  dot(pick(liveL), C.alt);
}
