---
theme: default
title: "SRE-Simulationen: Komplexe Systeme interaktiv"
info: |
  Komplexe Systeme im SRE-Alltag, erklärt durch interaktive Simulationen:
  Warteschlangen, Sättigung, Hysterese, metastabile Ausfälle und
  Diagnose-Drills. Als Workshop konzipiert — jede Simulation hat einen
  Deep-Link zum eigenständigen Nachspielen.
mdc: true
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  serif: Playfair Display
  mono: 0xProto
  weights: "400,500,600,700"
  italic: true
hideInToc: true
lang: de
---

# Komplexe Systeme im SRE-Alltag

Interaktive Simulationen: erst vorhersagen, dann laufen lassen, dann verstehen

<div class="text-sm opacity-75 mt-6">

Warteschlangen · Sättigung · Hysterese · metastabile Ausfälle · Diagnose-Drills.
Jede Simulation läuft hier im Vortrag **und** später bei euch im Browser.

</div>

<!--
Workshop-Deck. Zeitbudget pro Simulation ~5 min: 1 min Setup-Folie,
2 min Vorhersage/Spielen, 2 min Debrief. Bei knapper Zeit: pro Kapitel
eine Sim live, den Rest als Hausaufgabe (Deep-Links auf der End-Folie).
-->

---
hideInToc: true
---

# Inhalt

<Toc columns="2" minDepth="1" maxDepth="1" />

---
routeAlias: architektur-der-komplexitaet
---

# Die Architektur der Komplexität

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### Dekomponierbar

Interaktionen **zwischen** Subsystemen sind vernachlässigbar
gegenüber den Interaktionen **innerhalb**.

Das Ganze verhält sich wie die **Summe unabhängiger Teile** —
man darf pro Komponente denken.

</div>
<div class="intro-box intro-box-accent">

### Fast-dekomponierbar

Auf **kurzen Zeitskalen** näherungsweise wahr —
auf **langen nicht**: die schwachen Kopplungen zwischen den
Subsystemen **akkumulieren** zu qualitativ anderem Verhalten.

</div>
</div>

<div v-click class="mt-4">

<Callout tone="info" title="Simons These — seit 60 Jahren bestätigt (Biologie, Ökonomie, Engineering)">
Alle realen Systeme nennenswerter Größe sind <b>fast-dekomponierbar</b>, nicht dekomponierbar.
</Callout>

</div>

<div class="abs-br m-4 text-xs opacity-50">

Herbert Simon, _The Architecture of Complexity_, Proc. Am. Phil. Soc. (1962)

</div>

<!--
- Einstieg: das Argument ist älter als die Informatik. Simon 1962.
- Links: die Welt, die wir uns wünschen — Diagramm-Denken funktioniert.
- Rechts: die Welt, die wir haben — kurzfristig sieht alles unabhängig aus,
  langfristig schlagen die schwachen Kopplungen durch.
- Klick: Simons These. Sechzig Jahre Empirie quer durch die Disziplinen.
-->

---
hideInToc: true
---

# Verteilte Systeme: der Extremfall

Saubere Interfaces — im Architekturdiagramm sieht alles **dekomponierbar** aus.

<div class="mt-3">

Aber die Interaktionen laufen über **geteilte Ressourcen** — und die überträgt
das Diagramm nicht:

<div class="shared-res mt-2">
<span>🌐 Netz</span><span>⏱️ Clocks</span><span>💾 Storage</span><span>🎛️ Control Planes</span>
</div>

</div>

<div v-click class="mt-4">

<div class="chain">
<span class="chain-node">Änderung in&nbsp;A</span>
<span class="chain-arrow">→</span>
<span class="chain-node">Lastprofil im Netz</span>
<span class="chain-arrow">→</span>
<span class="chain-node">Queueing bei&nbsp;B</span>
<span class="chain-arrow">→</span>
<span class="chain-node">Antwort-Timing</span>
<span class="chain-arrow">→</span>
<span class="chain-node">Retry-Verhalten bei&nbsp;C</span>
</div>

</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Warum Simulationen?">
Die Komposition ist opak, <b>weil die Kopplungen unsichtbar sind</b>.
Genau diese unsichtbaren Kopplungen machen die folgenden Simulationen sichtbar.
</Callout>

</div>

<div class="abs-br m-4 text-xs opacity-50">

thesoftwarefrontier.com — _How Systems Really Fail, Part I_

</div>

<!--
- Verteilte Systeme sind Simons Extremfall: Interfaces sauber, Diagramm
  dekomponierbar — die Kopplung steckt in Netz, Clocks, Storage, Control Plane.
- Klick 1: die Kausalkette. Ein Deployment ändert das Lastprofil, das ändert
  Queueing woanders, das ändert Timing, das ändert Retries eines Dritten.
- Klick 2: die Überleitung — jede Sim in diesem Deck macht genau eine dieser
  unsichtbaren Kopplungen sichtbar.
-->

---
routeAlias: landkarte
hideInToc: true
---

# Simulations-Landkarte

Jede Simulation macht **eine unsichtbare Kopplung** sichtbar:

<div class="map-grid mt-3">
<div class="map-col">
<div class="map-head">🪀 Warteschlange als Feder</div>
<div class="map-item">✏️ M/M/1-Kantine <span class="map-tag">+ Burst & Shedding</span></div>
<div class="map-item">✏️ M/M/c: Pool vs. Tempo</div>
<div class="map-item">✏️ Systemdynamik-Pipeline</div>
<div class="map-item">✏️ Bufferbloat</div>
<div class="map-item">✏️ Little's-Law-Drill</div>
<div class="map-item">🔍 RabbitMQ: Queue wächst</div>
</div>
<div class="map-col">
<div class="map-head">🔁 Retry als Verstärker</div>
<div class="map-item">✏️ Retry-Sturm</div>
<div class="map-item">✏️ Cache-Stampede</div>
<div class="map-item">✏️ Cascading Failure</div>
<div class="map-item">✏️ Circuit Breaker & Shedding</div>
<div class="map-item">✏️ Metastabilität: MTTF-Klippe <span class="map-tag">Bonus</span></div>
</div>
<div class="map-col">
<div class="map-head">🎛️ Regelkreis mit Verzögerung</div>
<div class="map-item">✏️ Autoscaler-Hunting</div>
<div class="map-item">✏️ Bullwhip-Effekt</div>
<div class="map-item">✏️ SLO-Burn-Rate-Alerts</div>
<div class="map-item">🖱️ Hysterese-Katalog</div>
<div class="map-item">🖱️ Back-Pressure-Quadrant</div>
</div>
<div class="map-col">
<div class="map-head">🚿 Geteilte Ressource</div>
<div class="map-item">🖱️ Sättigungs-Szenarien</div>
<div class="map-item">🔍 Noisy Neighbor</div>
<div class="map-item">🔍 Latenz: Loss vs. App</div>
<div class="map-item">🔍 CrashLoopBackOff</div>
<div class="map-item">🔍 Heap: Leak vs. Cache</div>
</div>
</div>

<div class="mt-3 text-xs opacity-60">

✏️ Predict-first &nbsp;·&nbsp; 🔍 Diagnose-Drill &nbsp;·&nbsp; 🖱️ interaktiver Katalog

</div>

<!--
- Übersichtsfolie, auch als Selbststudium-Sprungbrett gedacht.
- Vier Kopplungs-Familien statt Kapitel-Reihenfolge: die Frage ist immer
  „welche geteilte Ressource / welcher Regelkreis steckt dahinter?"
- Nicht jede Sim heute live — die Landkarte zeigt, was es alles gibt.
-->

---
routeAlias: workshop-mechanik
hideInToc: true
---

# So funktioniert dieser Workshop

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### ✏️ Predict first

1. **Szenario verstehen** — Setup-Folie, keine Auflösung
2. **Vorhersage festlegen** — Kurve skizzieren oder Preset wählen
3. **Simulation läuft** — das Verdict vergleicht eure Vorhersage mit der Messung
4. **Weiterspielen** — Detail-Regler hinter dem ⚙-Zahnrad

</div>
<div class="intro-box">

### 🔍 Diagnose

1. **Leitsignal ansehen** — in allen Szenarien identisch
2. **Signale gezielt aufdecken** — jedes Aufdecken „kostet" etwas
3. **Hypothesen-Balken beobachten** — welche Ursache wird wahrscheinlicher?
4. **Auflösung** — welcher Kanal hätte sofort diskriminiert?

</div>
</div>

<div class="mt-4">

<Callout tone="success" title="Zum Nachspielen">
Jede Simulations-Folie hat einen <b>Deep-Link</b> (…/&lt;name&gt;) — Folie im Browser öffnen genügt.
Die Regler unter dem ⚙-Zahnrad sind fürs Experimentieren zu Hause gedacht.
</Callout>

</div>

<!--
- Die zwei Spielmechaniken einmal zentral erklären, dann laufen alle Sims gleich.
- Predict first: der Fehler in der eigenen Vorhersage ist der Lerneffekt —
  deshalb wird skizziert, BEVOR die Simulation läuft.
- Diagnose: Konjunktion statt Einzelsignal — Signale kosten, wie in echt
  (Dashboards bauen, Queries schreiben, warten).
-->

---
layout: section
---

# Warteschlangen: das Fundament

Die einfachste unsichtbare Kopplung — und die Mutter aller folgenden Effekte

<!--
- Warum Warteschlangen zuerst? Jede geteilte Ressource hat eine Queue davor —
  sichtbar (RabbitMQ) oder unsichtbar (Threadpool, NIC, Disk, CPU-Runqueue).
- Alles Weitere in diesem Deck (Sättigung, Hysterese, Retry-Stürme) ist
  Warteschlangen-Verhalten plus Rückkopplung.
-->

---
routeAlias: warteschlange-ziel
hideInToc: true
---

# Worum es geht: die Warteschlange als Systemzustand

<div class="grid grid-cols-3 gap-4 mt-6">
<div class="intro-box">

### 1 · Zustand = Länge

Die **Länge der Schlange** ist der Zustand des Systems.
Wächst sie, staut sich Arbeit; schrumpft sie, holt das System auf.
Alles Weitere liest sich aus dieser einen Zahl.

</div>
<div class="intro-box">

### 2 · Auslastung ↔ Wartezeit

Mehr **Auslastung ρ** heißt mehr **Wartezeit Wq** — nicht linear,
sondern als Hyperbel: ab ~80 % explodiert die Wartezeit.

</div>
<div class="intro-box intro-box-accent">

### 3 · „Besser“ ist eine Frage der Metrik

Wartezeit? Durchsatz? Gesamtzeit, bis der Kunde glücklich ist?
Welches Szenario **gewinnt**, hängt davon ab, **was man misst** —
dieselbe Schlange, andere Sieger.

</div>
</div>

<!--
- Erklärfolie zu Beginn des Kapitels: roter Faden für M/M/1 & M/M/c.
- Punkt 1 motiviert die animierte Schlangenlänge — der ⏩-Button spult genau
  bis zum Gleichgewicht dieses Zustands vor.
- Punkt 2 ist die Hyperbel der Folgefolie („Warum 80 %“).
- Punkt 3 ist die Pointe des M/M/c-Vergleichs: der Metrik-Umschalter
  (Wq / T / P(warten)) zeigt, dass „besser“ von der Messgröße abhängt.
-->

---
routeAlias: mm1-theorie
hideInToc: true
---

# M/M/1: Warum 80 %

<div class="mm1-merge">
<div class="mm1-merge-top">
<div class="mm1-merge-chart">

<MM1Chart />

Faustregel: **T = S / (1 − ρ)** — bei 80%: **5×** Service-Time, bei 90%: **10×**.

</div>
<div v-click>

<MM1Rules part="caveats" />

</div>
</div>
<div v-click>

<MM1Rules part="rules" />

</div>
</div>

<div class="abs-br m-3 text-xs opacity-60">

Schwellwerte & Praxis-Kontext: <TalkXref slug="20260329-grafana-lgtm-monitoring-in-k8s-distributed-system" anchor="mm1-80-prozent">Monitoring-Talk</TalkXref>

</div>

<style>
.mm1-merge {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.mm1-merge-top {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 1em;
  align-items: start;
}
.mm1-merge-chart p {
  font-size: 0.82em;
  line-height: 1.4;
  margin-top: 0.3em;
}
</style>

<!--
- Erklärfolie des Kapitels: die Hyperbel 1/(1−ρ) ist der ganze Trick.
- Klick 1: die Caveats (bursty Traffic, M/M/c). Klick 2: die Faustregeln.
- Danach empirisch nachprüfen — nächste Folie ist die Kantine.
-->

---
clicks: false
hideInToc: true
routeAlias: mm1-simulator
---

<MM1Simulator />

<!--
- Bedienung: ▶ startet die Kantine. λ (Ankunft) und μ (Kapazität) hinter 🛠️;
  die ρ-Schnellwahl ist immer sichtbar — auf 0.80, dann 0.95 springen.
- Zeigen: Bei ρ=0,8 pendelt Wq auf ~4× Bedienzeit ein (Gauge-Strich = Theorie);
  bei 0,95 zappelt der Phosphor-Punkt stark, der Einschwing-Balken braucht lange
  — läuft aber nicht davon. Erst ρ≥1: der Punkt verlässt das Feld nach oben.
- 🚌 Burst +12: der Bus bringt 12 🤖 auf einen Schlag (Dirac-Impuls) — Wq/N
  springen, bei ρ<1 konvergiert alles zurück zur Kurve. Brücke zu Kap. 4.
- ✂️ Load-Shed: alle Wartenden gehen nach unten ab — Wq sinkt sofort, der
  rote Zähler zeigt die Kosten (verworfene Requests). Brücke zu Kap. 5.
- 🥛 Feature-Shed (Graceful Degradation): niemand fliegt raus — die nächsten
  30 Gäste bekommen nur ein Glas Wasser (10× schneller). Die Schlange leert
  sich, ohne einen Request zu verlieren: Degradation statt Verlust.
  Gegenüberstellung ✂️ vs. 🥛 live zeigen!
- Kernaussage: „80 %" ist ein Punkt auf 1/(1−ρ), keine Klippe.
-->

---
clicks: false
hideInToc: true
routeAlias: mmc-vergleich
---

<MMcCompare />

<!--
- Bedienung: Modus „Tempo" (1 schneller Koch vs. Pool) ist Default. Metrik im
  Scope zwischen Wq und T umschalten — der Gewinner dreht sich. Slider hinter 🛠️.
- Zeigen: Der Zwillings-Rennbalken (mittig) misst id-gekoppelt, wer zuerst fertig
  ist: Pool gewinnt P(warten)/Wq (Pooling-Effekt), der schnelle Koch gewinnt T.
- Dann Modus „Pooling" (c getrennte Schlangen vs. Pool): der Pool gewinnt alles —
  Head-of-Line-Blocking in den getrennten Spuren. Rechtfertigt eine gemeinsame
  Queue / einen Work-Stealing-Pool gegenüber Sharding per Hash.
- 🚌 Burst +12: derselbe Bus liefert 12 🤖-Zwillinge in BEIDE Kantinen —
  beobachten, welche Seite den Spike schneller abbaut (der Pool!).
- ✂️ Load-Shed: leert beide Schlangen nach unten; die Zähler zeigen die
  verworfenen Gäste je Seite — der Pool hält typischerweise weniger
  Wartende vor und verwirft daher weniger.
- 🥛 Feature-Shed: beide Seiten servieren den nächsten 30 Gästen nur Wasser
  (10× schneller, niemand wird verworfen) — beobachten, welche Seite den
  Rückstau damit schneller abbaut.
-->

---
hideInToc: true
---

# Kapazitätsplanung & Little's Law

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box intro-box-accent">

### L = λ · W

Drei Größen, ein Gesetz — **zwei messen, die dritte ausrechnen**:
mittlere Anzahl im System, Ankunftsrate, mittlere Verweilzeit.
Gilt verteilungsfrei für jedes stabile System.

</div>
<div class="intro-box">

### Die Übung (nächste Folie)

- Aus λ und Ziel-Latenz die **nötige Kapazität** herleiten
- **Headroom-Planung** mit der Wq-Hyperbel aus diesem Kapitel
- Fünf Rechen-Drills mit Auflösung — Zahlen aus echten Systemen

</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Erst schätzen, dann messen">
Jede Runde zeigt zwei der drei Größen — die dritte ist verdeckt. Der Raum schätzt, die Simulation misst, die Auflösung zeigt den Rechenweg. Der Little-Check-Gauge aus der Kantine war der Vorgeschmack.
</Callout>

</div>

<!--
- Konzeptfolie: L = λ·W ruhig erklären, die drei Richtungen nennen
  (N = λ·W, W = N/λ, λ = N/W).
- Brücke: der fünfte Gauge der Kantinen-Sim rechnet genau diese Gleichung
  live nach — jetzt wird sie zum Planungswerkzeug.
- Klick: Übungsmodus ankündigen — „gleich dürfen Sie schätzen“.
-->

---
clicks: false
hideInToc: true
routeAlias: littles-law
---

<LittleLawDrill />

<!--
- Bedienung: Runde 1–5 oben wählen. Zwei Karten sind gefüllt, eine zeigt „?“.
  Publikum schätzen lassen (Zuruf oder Schieberegler), dann ▶ Messen:
  die Gauges konvergieren, die verdeckte Karte füllt sich. ⏩ Auflösen
  springt ans Ende; das Verdict zeigt Messwert, Theorie und Rechenweg.
- R1 Thread-Pool: λ=200/s · W=150 ms → N = 30 in-flight (Pool ≥ 30).
- R2 Consumer-Lag: 3.000 msg Lag · 25 msg/s → W = 120 s. Lag in Sekunden!
- R3 Worker: λ=120/s · S=25 ms · Ziel Wq≤10 ms → c=5. Die Falle: c=4 hält
  den Durchsatz (ρ=0,75), reißt aber das SLO (Erlang-C: ≈12,7 ms).
- R4 Headroom: erst bei ρ=0,80 messen (≈4 ms), dann „⚡ +15 % einspielen“:
  ρ=0,92 → Wq ≈ 11,5 ms (≈3×) — die Hyperbel aus dem Scope.
- R5 Konsistenz-Check: N=24 · W=60 ms → λ=400 req/s — drei Metrik-Quellen
  müssen Little erfüllen, sonst lügt eine.
- ⚙: Zeitraffer, gleicher/neuer Seed. Tab „Erklärung & Modell“: Herleitung,
  Erlang-C, Ehrlichkeitshinweise.
-->

---
layout: section
---

# Sättigung erkennen

Wo aus einer schwachen Kopplung eine starke wird

<!--
- Brücke zu Simon: solange nichts gesättigt ist, sind die Kopplungen schwach —
  das System wirkt dekomponierbar. Sättigung ist der Punkt, an dem die
  geteilte Ressource anfängt, Störungen zu übertragen.
-->

---
hideInToc: true
---

# Sättigung: das Signal hinter den Signalen

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### Utilization sagt „beschäftigt"

CPU 80 % kann völlig gesund sein.
Auslastung allein hat **keine Richtung** —
sie sagt nicht, ob Arbeit liegen bleibt.

</div>
<div class="intro-box intro-box-accent">

### Saturation sagt „es staut sich"

Queue-Depth, Pending-Threads, Throttling-Anteil:
**wartende Arbeit** ist das Frühwarnsignal —
und genau das, was die Hyperbel von eben treibt.

</div>
</div>

<div class="mt-4">

<Callout tone="info" title="Praxis-Schwellwerte & PromQL">
P1–P3-Prioritäten, Schwellwert-Tabellen und die zugehörigen Queries:
<TalkXref slug="20260329-grafana-lgtm-monitoring-in-k8s-distributed-system" anchor="saturation-schwellwerte">Monitoring-Talk — Saturation erkennen</TalkXref>
</Callout>

</div>

<!--
- Erklärfolie vor dem Szenario-Player: Utilization vs. Saturation in einem Satz.
- Die Simulation gleich zeigt, wie Sättigung ein Szenario von HEALTHY bis
  CRITICAL durchläuft — die Theorie dazu steht im Monitoring-Talk.
-->

---
clicks: false
hideInToc: true
routeAlias: saturation-szenarien
---

# Saturation-Szenarien — Interaktiv

<SaturationSimulator />

<!--
- Bedienung: links Szenario wählen (Filter-Pills: Alle, Compute, Pools,
  Infra-Komponente, Extern, Kaskade), dann ▶ drücken — der Fortschritts-Slider
  fährt das Szenario von HEALTHY über DEGRADED/WARNING bis CRITICAL, die vier
  Gauges laufen mit. Slider auch manuell ziehbar.
- Zeigen: „CPU-Throttling" komplett durchspielen (GC-Verstärkung!), danach
  „DB Checkpoint-Sättigung" oder „Broker Back-Pressure" als Infra-Komponente,
  „Kaskaden-Failure" als Eskalation.
- Unten „PromQL-Queries anzeigen" aufklappen — Queries + Gegenmaßnahmen-Box.
-->

---
layout: section
---

# Systeme mit Gedächtnis

Rückkopplung & Hysterese: warum „Last weg" nicht „Problem weg" heißt

<!--
- Kapitel 3: die Kopplungen bekommen Gedächtnis. Interner Zustand (kalter
  Cache, Backlog, offener Breaker) bleibt, obwohl die externe Last sinkt.
-->

---
hideInToc: true
---

# Hysterese in 60 Sekunden

Systeme bauen unter Überlast **interne Zustände** auf, die nicht verschwinden, wenn die externe Last sinkt:

<div class="mt-3">

- **Set-Schwelle ≠ Reset-Schwelle** — der Weg zurück liegt tiefer als der Weg hinein (Schmitt-Trigger)
- **Der Zustand ist das Gedächtnis** — kalter Cache, Queue-Backlog, offener Circuit-Breaker, kalte Pods
- **Extremfall metastabiler Fehler** — die Rückkopplung hält die Überlast selbst aufrecht; Reset-Punkt unerreichbar, Rückkehr nur via Load-Shedding / Drain / Restart

</div>

<div class="mt-4">

<Callout tone="info" title="Theorie & Mechanismen-Tabelle">
Feedback-Loops im Detail (Cache-Stampede, GC Death Spiral, Flow-Control …):
<TalkXref slug="20260329-grafana-lgtm-monitoring-in-k8s-distributed-system" anchor="hysterese">Monitoring-Talk — Hysterese</TalkXref>
</Callout>

</div>

<!--
- Erklärfolie: die drei Sätze, die man für Katalog + Quadrant braucht.
- Danach der Katalog zum Explorieren (26 Mechanismen), dann die Synthese
  (Quadrant), dann die Pipeline-Simulation.
-->

---
clicks: false
hideInToc: true
routeAlias: hysterese-katalog
---

# Hysterese-Katalog — Interaktiv

<HystereseCatalog />

<!--
- Bedienung: Filter-Pills oben (Applikation, Garbage Collection,
  Infra-Komponente, Plattform, Netzwerk, Kubernetes); Klick auf eine Karte
  klappt die Detail-Ansicht mit Feedback-Loop + Regelkreis-Badges
  (Gedächtnis, Bremse, Set/Reset) auf. Die Kurven-Animation läuft von selbst.
- Zeigen: „Cache-Stampede" und „Runtime GC Death Spiral" aufklappen, dann das
  Paar ZGC Allocation Stall (binär) vs. Shenandoah Pacing (proportional) —
  die zwei Achsen der folgenden Quadranten-Folie an einem GC-Beispiel.
- Hinweis: alle 26 Mechanismen teilen dasselbe Muster — interner Zustand
  bleibt bestehen, obwohl die externe Last längst gesunken ist.
-->

---
hideInToc: true
routeAlias: backpressure-quadrant
---

# Back-Pressure als Regelkreise

Zwei Achsen entscheiden über Monitorbarkeit und Hysterese — **Gedächtnis** (Pegel vs. Momentanrate) und **Bremsform** (binär vs. proportional):

<div class="bpq-layout">
<div class="bpq-diagram"><BackpressureQuadrant /></div>
<div class="bpq-explain">
<Callout tone="info" dense>
<strong>Hysterese = Integrator + Doppelschwelle.</strong> Entsteht, wo ein gedächtnisbehafteter Mechanismus getrennte Set-/Reset-Schwellen hat (Schmitt-Trigger) — gewollt als Anti-Flattern (Galera <code>fc_factor</code>, Grafana Recovery Threshold).
</Callout>
<Callout tone="danger" dense>
<strong>Metastabiler Fehler.</strong> Wird die „Bremse" eine positive Rückkopplung (super-linear), bleibt das System nach der Lastspitze überlastet — effektiv unendliche Hysterese. Rückkehr nur via Load-Shedding/Drain/Restart.
</Callout>
</div>
</div>

<div class="text-slate-500" style="margin-top:0.3em; font-size:0.6em;">
Brendan Gregg · USE-Methode &nbsp;·&nbsp; Neil Gunther · Universal Scalability Law &nbsp;·&nbsp; Bronson et al. · Metastable Failures (HotOS 2021)
</div>

<style>
.bpq-layout {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
  margin-top: 0.4em;
  align-items: start;
}
.bpq-explain {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.82em;
}
</style>

<!--
- Synthese-Folie nach dem Katalog: der Magic-Quadrant ordnet jeden Mechanismus
  nach Gedächtnis (Y: Rate → Pegel) und Bremsform (X: binär → proportional) ein
  und quantifiziert die Ausprägung über die Position.
- Zeigen: das ZGC-vs-Shenandoah-Paar (beide GC, aber binär vs. proportional) und
  die Diagonale — lange Zeitkonstante neigt zu binär, kurze zu proportional.
- Merksatz: zustandsbehaftet = vorhersagbar (Pegel-Gauge + dL/dt → Time-to-
  threshold); zustandsarm = nur detektierbar. Metastabiler Fehler = die
  super-lineare Eskalation oben-links (∞ Hysterese).
-->

---
clicks: false
hideInToc: true
routeAlias: systemdynamik
---

# Systemdynamik — Interaktiv

<SystemDynamicsSimulator />

<!--
- Bedienung: Tab „Simulation": Szenario wählen (Queues als Federn,
  Dirac-Impuls, Überlast + Recovery, Rolling Bottleneck), ▶ startet die
  Pipeline-Animation Gateway → Quote-Service → Provider-Adapter.
- Zeigen: „Dirac-Impuls" (Batch = maximale Oszillation) und „Rolling
  Bottleneck" (der Engpass wandert) — die Kernaussagen der Sektion live.
- Tab „M/M/1 & Regeln": Kurve plus die drei Regeln (Excess Capacity,
  Steady Flow, Hysterese) — als Abschluss der Sektion kurz zeigen.
-->

---
layout: section
---

# Predict first: metastabile Ausfälle

Erst vorhersagen, dann messen — der Fehler ist der Lerneffekt

<!--
- Regie: ab hier gilt die Workshop-Mechanik von Folie „So funktioniert dieser
  Workshop". Skizziert eure Vermutung, BEVOR die Simulation läuft.
- Fünf Szenarien, ein Muster: eine positive Rückkopplung über eine geteilte
  Ressource, die das Diagramm nicht zeigt.
-->

---
hideInToc: true
---

# Setup: Der Retry-Sturm

Ein Service verarbeitet **μ = 100 req/s**, die Grundlast beträgt **λ = 70 req/s** (Auslastung ρ = 0,7).
Clients haben **1 s Timeout** und wiederholen fehlgeschlagene Anfragen bis zu **2-mal**.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Clients</b>&ensp;λ = 70 req/s · Timeout 1 s · ≤ 2 Retries</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Queue</b>&ensp;unbegrenzt (FIFO)</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Service</b>&ensp;μ = 100 req/s</span>
</div>

Bei **t = 20 s** trifft für **10 Sekunden** eine Lastspitze (×2) ein — danach kehrt die Last zur Normalität zurück.

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Wie entwickelt sich der <b>Goodput</b> (erfolgreiche Antworten innerhalb der Deadline), nachdem die Lastspitze vorbei ist? Erholung, dauerhaft reduziert — oder Kollaps?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Zahlen kurz durchgehen: ρ=0,7 klingt gesund,
  der Burst ist nur 10 Sekunden lang, danach ist die Last wieder normal.
- Klick: die Frage stellen, Publikum diskutieren lassen (30 s), dann
  weiter zur Simulation — dort skizzieren oder Preset wählen.
-->

---
clicks: false
hideInToc: true
routeAlias: retry-sturm
---

<RetryStormSim />

<!--
- Bedienung: Vorhersage direkt ins Goodput-Diagramm skizzieren (Maus/Finger)
  oder Preset wählen (Erholung / teilweise / Kollaps), dann ▶ starten.
  Coverage-Gate: Skizze muss bis fast zum rechten Rand reichen.
- Während des Laufs: „Load-Shedding auslösen" zeigt die Gegenmaßnahme live —
  Queue kappen + Annahme begrenzen rettet den Goodput.
- Verdict unten vergleicht Vorhersage und Messung (Mittel t ≥ 90 s).
- ⚙ Experimentieren: Burst-Amplitude & Retries R; nahe der Kipp-Schwelle
  (~×1,4–1,6) entscheidet der Seed — „Gleicher Seed" vs. „Nochmal" zeigen!
- Tab „Erklärung & Modell": die Arithmetik (λ_eff = λ·(R+1) > μ),
  Selbsterhaltung ab R=1, „Der Mittelwert verschweigt die Gefahr".
-->

---
hideInToc: true
---

# Setup: Die Cache-Stampede

Ein heißer Cache-Key wird mit **400 req/s** abgefragt. Solange der Key gültig ist, sieht die Datenbank davon **nichts**.
Die DB verarbeitet **200 einfache Queries/s** und trägt **100 Queries/s Grundlast** von anderen Endpoints.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Clients</b>&ensp;400 req/s auf einen Key</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Cache</b>&ensp;TTL 20 s · 1 heißer Key</span>
<span class="chain-arrow">→ <i>nur bei Miss</i></span>
<span class="chain-node"><b>Datenbank</b>&ensp;200 Äq/s · Grundlast 100 Äq/s · Rebuild = 40 Äq</span>
</div>

Der Neuaufbau des Keys ist teuer: **40 Query-Äquivalente** (≈ 0,2 s reine DB-Zeit — deshalb wird er ja gecacht).
Der Key lebt **20 s** ab Befüllung; der erste Ablauf ist bei **t = 20 s**. **Jeder Request, der einen Miss sieht, startet einen eigenen Neuaufbau.**

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Wie entwickelt sich die <b>Antwortzeit einer einfachen DB-Query</b> (die Latenz, die alle <i>anderen</i> Endpoints an dieser Datenbank sehen) über 90 Sekunden? Ein kurzer Blip, ein Berg mit Erholung — oder Eskalation?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Zahlen kurz durchgehen: 100 Äq/s freie DB-Kapazität,
  ein Rebuild kostet 40 Äq — klingt nach viel Luft. Und der Cache fängt ja
  99 % ab, solange der Key lebt.
- Wichtig: Solange der Key gültig ist, sieht die DB nichts — die Kopplung
  zwischen den 400 req/s und der DB ist im Architekturdiagramm unsichtbar.
- Klick: die Frage stellen, Publikum diskutieren lassen (30 s), dann
  weiter zur Simulation — dort skizzieren oder Preset wählen.
-->

---
clicks: false
hideInToc: true
routeAlias: cache-stampede
---

<CacheStampedeSim />

<!--
- Bedienung: Vorhersage direkt ins Latenz-Diagramm skizzieren (Maus/Finger)
  oder Preset wählen (kurzer Blip / Berg, dann Erholung / Eskalation), dann
  ▶ starten. Coverage-Gate: Skizze muss (fast) den ganzen Zeitraum abdecken.
- Zeigen: Der erste Ablauf bei t = 20 s ist nur der Auftakt — entscheidend
  ist der zweite: Er trifft auf den Rest-Backlog, das Miss-Fenster wird
  länger, jedes Fenster füttert das nächste. Readout unten:
  Duplikat-Rebuilds = pure verschwendete DB-Arbeit.
- Verdict unten vergleicht Vorhersage und Messung (Kategorie Blip / Berg /
  Eskalation, Latenz-Spitze + Endwert, verschwendete Äquivalente).
- ⚙ Experimentieren: Die Eskalationsschwelle hängt vom Produkt aus
  Anfragerate und Rebuild-Kosten ab; dann Single-Flight einschalten —
  genau ein Neuaufbau pro Ablauf, die Stampede verschwindet.
  „Gleicher Seed" vs. „Nochmal (neuer Seed)" zeigen!
- Tab „Erklärung & Modell": Synchronisation + Arbeitsduplikation als
  Mechanik, kein Bullwhip, Verwandter des Retry-Sturms; Gegenmittel-Liste
  (Single-Flight, XFetch, stale-while-revalidate, TTL-Jitter).
-->

---
hideInToc: true
---

# Setup: Der Puffer, der alles rettet

Ein Service verarbeitet **μ = 100 req/s**, Clients geben nach **1 s** auf — Antworten danach sind wertlos, der Client ist weg.
Damit bei Lastspitzen **keine Anfrage verloren geht**, hat das Team der Warteschlange großzügige **2 000 Plätze** spendiert.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Clients</b>&ensp;70 → 140 → 70 req/s · Deadline 1 s</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Queue</b>&ensp;Puffer: 2 000 Plätze (FIFO)</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Service</b>&ensp;μ = 100 req/s</span>
</div>

Von **t = 20 s** bis **t = 50 s** liegt die Last mit **140 req/s** über der Kapazität; davor und danach sind es **70 req/s**. **Es gibt keine Retries** — nur den Puffer.

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Wie entwickelt sich der <b>Goodput</b> — Antworten, die den Client noch <i>innerhalb</i> seiner Deadline erreichen — über die vollen 120 Sekunden? Volle Auslastung, ein begrenzter Einbruch — oder ein Einbruch weit über die Überlast hinaus?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Zahlen kurz durchgehen: 2 000 Puffer-Plätze klingen
  fürsorglich („keine Anfrage geht verloren"), die Überlast dauert 30 s,
  danach ist die Last wieder normal.
- Wichtig: Es gibt KEINE Retries — das ist nicht der Retry-Sturm, sondern
  der Verstärker darunter. Nur der Puffer.
- Klick: die Frage stellen, Publikum diskutieren lassen (30 s), dann
  weiter zur Simulation — dort skizzieren oder Preset wählen.
-->

---
clicks: false
hideInToc: true
routeAlias: bufferbloat
---

<BufferbloatSim />

<!--
- Bedienung: Vorhersage direkt ins Goodput-Diagramm skizzieren (Maus/Finger)
  oder Preset wählen (volle Auslastung / Einbruch, dann Erholung / Einbruch
  weit über die Überlast hinaus), dann ▶ starten. Coverage-Gate: Skizze muss
  (fast) den ganzen Zeitraum 0–120 s abdecken.
- Zeigen: das Wartezeit-Diagramm unten. Sobald mehr als μ·D = 100 Anfragen
  warten, reißt jede Antwort die 1-s-Deadline — der Server läuft mit 100 %
  Auslastung und produziert tote Arbeit. Nach der Überlast fließt der
  Backlog nur mit μ − λ = 30 req/s ab: Goodput bleibt lange bei null.
- Verdict unten vergleicht Vorhersage und Messung (minimaler Goodput im
  Überlastfenster) + Fehlerrate, tote Antworten, Goodput gesamt.
- ⚙ Experimentieren: Puffergröße 25…3 200 Plätze — der Gesamt-Goodput wird
  mit wachsendem Puffer monoton schlechter! Oder Age-Drop (CoDel-Idee)
  einschalten und den Puffer groß lassen. „Gleicher Seed" vs. „Nochmal
  (neuer Seed)" zeigen.
- Tab „Erklärung & Modell": w = q/μ, tote Arbeit, „Fehler in Latenz
  umgewandelt", Abgrenzung zum Retry-Sturm (bewusst keine Retries) +
  bewusste Vereinfachungen des Modells.
-->

---
hideInToc: true
---

# Setup: RAM für die Flotte — der Bullwhip-Effekt

Die Server-Flotte verbraucht RAM sehr gleichmäßig: **100 Riegel/Woche** (± kleines Rauschen).
Ab **Woche 15** steigt der Bedarf **dauerhaft um 20 %** auf **120 Riegel/Woche** (Fleet-Wachstum) — mehr passiert nicht.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Server / Workloads</b>&ensp;100 → 120 Riegel/Woche</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Lokales Inventar</b>&ensp;Stufe 1</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Zentrallager</b>&ensp;Stufe 2</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Distributor</b>&ensp;z. B. DigiKey · Stufe 3</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Hersteller</b>&ensp;z. B. Micron · Lieferzeit je Stufe: 2 Wochen</span>
</div>

Jede Stufe der Kette sieht nur die **Bestellungen ihrer Nachbarstufe**, prognostiziert daraus
und bestellt nach einer Order-up-to-Politik (Ziel: Prognose × (Lieferzeit + 1) im Bestand + unterwegs).

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Was bestellt <b>Micron</b> pro Woche, wenn der RAM-Bedarf ein einziges Mal dauerhaft um <b>+20 %</b> steigt? Eine glatte Anpassung, moderates Überschwingen — oder starke Oszillation?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Zahlen kurz durchgehen: Die Nachfrage ist fast
  konstant, +20 % ist die einzige Änderung — und sie ist vorab bekannt.
  Jede Stufe handelt für sich völlig „vernünftig".
- Klick: die Frage stellen, Publikum diskutieren lassen (30 s), dann
  weiter zur Simulation — dort skizzieren oder Preset wählen.
-->

---
clicks: false
hideInToc: true
routeAlias: bullwhip
---

<BullwhipSim />

<!--
- Header-Umschalter „Grundszenario ⇄ Preisschock": beide Predict-first,
  Micron ist die oberste Stufe (Hersteller). Erst das Grundszenario zeigen.
- Bedienung: Vorhersage der Micron-Bestellungen direkt ins obere Diagramm
  skizzieren (Maus/Finger) oder Preset wählen (glatte Anpassung /
  Überschwingen / starke Oszillation), dann ▶ starten. Coverage-Gate:
  Skizze muss von (fast) links bis (fast) rechts reichen.
- Zeigen: Die dunkle Linie (Server-Nachfrage) ist vorab vollständig
  bekannt — nur +20 % ab Woche 15. Nach dem Lauf: Micron-Spitze weit über
  der Nachfrage, danach Wochen mit 0 Bestellungen (Bestell-Stopp);
  unteres Diagramm: Bestand schießt hoch und fällt bis auf 0 (Stockout,
  physischer Bestand ≥ 0). Klick auf Legenden-Einträge blendet einzelne
  Stufen ein/aus. Beachte: Micron schwankt schon VOR Woche 15 —
  reines Rauschen wird genauso verstärkt.
- Preisschock-Szenario: Micron bedient noch den Bestell-Peak und hebt dann
  in Woche 20 (kurz nach dem Nachfrage-Sprung) die Preise an → roter Marker;
  alle Stufen fahren zuerst ihr Lager herunter → bei Micron kommen ~6 Wochen
  KEINE Bestellungen an (Flaute), obwohl die Server unverändert verbrauchen.
  Hoher Peak, direkt gefolgt von der Flaute. Danach erholt sich die Rate, der
  Bestand bleibt dauerhaft magerer (Feast → Famine). Erklärung-Tab: besonders
  fatal, wenn der Hersteller die Kapazität am Peak ausrichtet (Kapital in
  Überkapazität → Flaute → Finanzproblem; IT: Nodes / Reserved Instances).
- Lagerbestand ist physisch nie negativ: der Chart zeigt den On-hand-Bestand
  ≥ 0 (0 = Stockout). Fachlich üblich (Bestandstheorie) ist der
  vorzeichenbehaftete Netto-Bestand — negativ = Rückstand/Backorder, der
  später nachgeliefert wird. Intern rechnen wir so, zeigen aber den
  physischen Bestand — Standardpraxis, kein Bug.
- Verdict unten vergleicht Vorhersage- und Mess-Kategorie (Spitzenwert)
  und zeigt die Varianz-Verstärkung je Stufe (× vs. Nachfrage).
- ⚙ Experimentieren: Lieferzeit L und Prognose-α verstärken die Peitsche;
  POS-Sharing (alle Stufen sehen die echte Server-Nachfrage) dämpft sie
  drastisch — mit „Gleicher Seed" direkt vergleichen! Frühere
  Micron-Läufe bleiben blass sichtbar.
- Tab „Erklärung & Modell": Order-up-to-Arithmetik (Faktor 1 + (L+1)·α je
  Stufe, vier Stufen multiplikativ verkettet), P&G/Pampers (Lee et al.
  1997), IT-Übersetzung: verkettete Autoscaler bauen dieselbe Peitsche.
-->

---
hideInToc: true
---

# Setup: Der Autoscaler, der es gut meint

Ein Deployment mit **7 Pods** à **100 req/s** Kapazität, Ziel-CPU **60 %**. Der Autoscaler rechnet
alle **15 s** nach der Kubernetes-HPA-Formel `desired = ceil(current · CPU/Ziel)` (mit 10 % Toleranzband).

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Last</b>&ensp;400 → 900 req/s bei t = 2 min</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Pods</b>&ensp;à 100 req/s · Start dauert 60 s</span>
<span class="chain-arrow">← skaliert</span>
<span class="chain-node"><b>HPA</b>&ensp;alle 15 s · Ziel-CPU 60 % · Metrik-Lag 60 s</span>
</div>

Aber: Die CPU-Metrik ist **träge** (≈ 60 s Verzögerung durch Scrape-Intervall und Mittelung), und neue Pods
brauchen **60 s bis ready**. Bei **t = 2 min** springt die Last dauerhaft von **400** auf **900 req/s** —
dafür bräuchte es **15 Pods**.

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Wie entwickelt sich die <b>Pod-Anzahl</b> über die vollen 20 Minuten? Eine glatte Treppe auf 15, ein Überschwinger mit anschließender Ruhe — oder Dauerschwingen?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Zahlen kurz durchgehen: die HPA-Formel ist der
  Kubernetes-Standard, 60 % Ziel-CPU klingt konservativ — verdächtig sind
  die beiden Verzögerungen: Metrik-Lag ≈ 60 s und Pod-Start 60 s.
- Kopfrechnung mit dem Publikum: 900 / (100 · 0,6) = 15 Pods. Die Frage
  ist nicht OB der Autoscaler dort ankommt, sondern WIE.
- Klick: die Frage stellen, Publikum diskutieren lassen (30 s), dann
  weiter zur Simulation — dort skizzieren oder Preset wählen.
-->

---
clicks: false
hideInToc: true
routeAlias: hpa-hunting
---

<HpaHuntingSim />

<!--
- Bedienung: Vorhersage (Pod-Anzahl, Minute 0–20) direkt ins obere Diagramm
  skizzieren oder Preset wählen (glatte Treppe / Überschwingen / Dauerschwingen),
  dann ▶ starten. Coverage-Gate: von (fast) links bis (fast) rechts zeichnen.
- Zeigen: die gestrichelte Referenz (benötigt: 6,7 → 15 Pods) und das untere
  Diagramm — CPU momentan vs. träge gemessen. Der Regler sieht die alte Welt,
  und bei Überlast steht die Metrik gesättigt bei 100 %.
- Verdict unten vergleicht die Kategorie (glatt / Überschwinger / Hunting)
  plus Chips: Schwingungen, Pod-Spitze, CPU-Sättigungszeit (Nutzer leiden).
- ⚙ Experimentieren: Pod-Startzeit & Metrik-Trägheit τ — die Hunting-Grenze
  liegt zwischen ~30 s und ~60 s; „Gleicher Seed" vs. „Nochmal" zeigen. Dann
  Stabilization Window 300 s (K8s-Default) einschalten: die Schwingung beruhigt
  sich — genau deshalb existiert dieses Feature.
- Tab „Erklärung & Modell": Totzeit (Pod-Start) + Messverzögerung (Metrik-Lag)
  ⇒ Hunting; Parallele zum Bullwhip-Effekt; Gegenmittel (Stabilization Window,
  glattere Metriken, kürzere Pod-Starts, trägere Regler — Smith-Prädiktor).
-->

---
hideInToc: true
---

# Debrief: Das gemeinsame Muster

<div class="mt-3" />

| Simulation             | Die unsichtbare Kopplung                           | Der Verstärker                            |
| ---------------------- | -------------------------------------------------- | ----------------------------------------- |
| **Retry-Sturm**        | Timeouts koppeln Clients an die Queue              | Timeout → Retry → längere Queue           |
| **Cache-Stampede**     | Ein TTL synchronisiert hunderte Clients            | Miss → Rebuild → DB langsam → mehr Misses |
| **Bufferbloat**        | Der Puffer koppelt Last an Latenz                  | Backlog → Deadline-Miss → tote Arbeit     |
| **Bullwhip**           | Jede Stufe sieht nur Bestellungen der Nachbarstufe | Prognose auf Prognose, je Stufe ×         |
| **Autoscaler-Hunting** | Der Regler sieht die Welt von vor 60 Sekunden      | Totzeit + Messverzögerung → Schwingen     |

<div v-click class="mt-3">

<Callout tone="info" title="Simon, angewandt">
Im Architekturdiagramm war jedes dieser Systeme <b>dekomponierbar</b>. Die Kopplung lief über eine geteilte Ressource oder eine Verzögerung — und nahe der Kipp-Schwelle entscheidet der <b>Seed</b>: Der Mittelwert verschweigt die Gefahr.
</Callout>

</div>

<style>
table {
  font-size: 0.72em;
}
table td,
table th {
  padding-top: 0.3em;
  padding-bottom: 0.3em;
}
</style>

<!--
- Debrief nach den fünf Predict-first-Sims: das Muster ist immer gleich —
  positive Rückkopplung über eine Kopplung, die das Diagramm nicht zeigt.
- Rückbindung an Simon (Intro): fast-dekomponierbar heißt genau das.
- Klick: und der Zufall — wer im ⚙-Labor nahe der Schwelle experimentiert
  hat, hat gesehen: gleicher Parametersatz, anderes Ergebnis.
-->

---
layout: section
---

# Gegenmaßnahmen

Die Verstärker entschärfen — der Load Balancer als Verstärker, der Breaker als gewollte Hysterese

<!--
- Zwei Predict-first-Sims: Health-Check-Spirale (Kaskade + Panic-Mode)
  und Circuit Breaker (Opfer kauft Erholung).
-->

---
hideInToc: true
---

# Setup: Die Health-Check-Spirale

**8 Instanzen** à **μ = 100 req/s** hinter einem Load Balancer, Gesamtlast **λ = 560 req/s** (ρ = 0,7).
Health-Check: Probe **jede Sekunde**, Timeout **0,4 s** — **2 Fails** → raus (Auswurf Nr. k hält **k·5 s**, Envoy-Backoff), danach wieder rein.

<div class="chain mt-4 mb-4">
<span class="chain-node">Instanz wird <b>langsam</b></span>
<span class="chain-arrow">→</span>
<span class="chain-node">Health-Check schlägt fehl</span>
<span class="chain-arrow">→</span>
<span class="chain-node">LB nimmt sie <b>aus der Rotation</b></span>
<span class="chain-arrow">→</span>
<span class="chain-node">Rest bekommt <b>mehr Last</b></span>
<span class="chain-arrow">→</span>
<span class="chain-node">nächste wird langsam …</span>
</div>

- Bei **t = 20 s** werden **3 Instanzen** für **15 s** langsam (40 % Kapazität — GC, Noisy Neighbor, schlechtes Canary)
- Der Load Balancer ist als **Schutz** gebaut — unter Last wird er zum **Verstärker**
- Verwandt mit dem Retry-Sturm: dieselbe Selbsterhaltung, eine Ebene höher

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Die Störung ist nach 15 s vorbei. Wie entwickelt sich die <b>Zahl der Instanzen in Rotation</b> über 120 s — kurzer Dip, Dauer-Flattern oder Kaskade?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Kopfrechnung mit dem Publikum: nach k Auswürfen
  trägt jeder Überlebende 560/(8−k) — k=1: 80, k=2: 93 (knapp), k=3:
  112 > μ=100. Die dritte Instanz kippt das System.
- Brücke: das ist der Retry-Sturm auf Infrastruktur-Ebene — der „Retry"
  ist hier die Lastumverteilung des LB.
- Klick: die Frage stellen, Publikum diskutieren lassen (30 s), dann
  weiter zur Simulation — dort skizzieren oder Preset wählen.
-->

---
clicks: false
hideInToc: true
routeAlias: cascading-failure
---

<HealthCheckCascadeSim />

<!--
- Bedienung: Zahl der Instanzen in Rotation ab t = 20 s skizzieren
  (Maus/Finger) oder Preset wählen (Dip / Flattern / Kaskade), dann ▶.
- Während des Laufs: „Panic-Mode (Fail-Open) aktivieren" zeigt das
  Gegenmittel live — der LB routet wieder an alle, der Goodput erholt
  sich, obwohl der Health-Check die Instanzen weiter für krank hält.
- Instanzen-Reihe unten: Füllstand = Queue, Rand grün/amber/rot, ×k =
  Auswurf-Zähler (Backoff!).
- Verdict vergleicht Skizze und Messung (Mittel t ≥ 90 s) + Chips
  (Minimum in Rotation, Sekunden Goodput < 50 %, verlorene Requests).
- ⚙ Experimentieren: m = 2 ist die Kipp-Kante — der Seed entscheidet
  („Gleicher Seed" vs. „Nochmal" zeigen!). F = 5, P = 3 (F·P ≈
  Störungsdauer) rettet: besser kurz langsam als kaskadiert.
- Tab „Erklärung & Modell": 560/(8−k)-Arithmetik, Envoy-Auswurf-Backoff
  als Selbsterhaltung, Gegenmittel Panic/Quorum/langsame Auswürfe.
-->

---
hideInToc: true
---

# Setup: Der Circuit Breaker

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### Schon live gesehen

- **✂️ Load-Shed** in beiden Kantinen-Sims: Wartende verwerfen, Wq sofort runter
- **🥛 Feature-Shed** ebendort: alle bedienen, aber nur Wasser — Degradation statt Verlust
- **Shed-Knopf** im Retry-Sturm: aussichtslose Anfragen verwerfen bricht die Selbsterhaltung
- **Single-Flight** (Cache-Stampede) und **Age-Drop** (Bufferbloat) — dieselbe Familie

</div>
<div class="intro-box intro-box-accent">

### Der Circuit Breaker als Regelkreis

Closed → Open → Half-Open ist **absichtlich eingebaute Hysterese**
(Kapitel „Systeme mit Gedächtnis"): getrennte Kipp- und
Rückkehr-Schwellen gegen das Flattern.

</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Gleiches Szenario wie der Retry-Sturm (Burst ×2 für 10 s, ≤ 2 Retries) — diesmal mit Breaker: Kippen bei 50 % Fehlerrate, 5 s Cooldown, Half-Open-Proben. Was macht der Breaker mit dem <b>Goodput</b> — rettet er ihn ohne Einbruch, opfert er ihn kurz und kontrolliert, oder hilft er gar nicht?
</Callout>

</div>

<!--
- Die Gegenmaßnahmen-Perspektive bündeln — vier Sims dieses Decks haben
  schon je ein Gegenmittel eingebaut (Shed, Single-Flight, Age-Drop,
  Stabilization Window). Der Breaker ist die systematische Form davon.
- Merksatz: Ein Breaker ist gewollte Hysterese — dieselbe Mechanik, die
  in Kapitel 3 als Problem auftrat, hier als Werkzeug.
- Klick: die Frage stellen — die drei Hypothesen sind die Presets der
  nächsten Folie.
-->

---
clicks: false
hideInToc: true
routeAlias: circuit-breaker
---

<CircuitBreakerSim />

<!--
- Header-Umschalter „Manuell ⇄ Vorhersage" — die Folie startet im
  MANUELL-Modus. Erst ein Gefühl geben, dann vorhersagen lassen.
- Manuell (Sandbox, kein Zeichnen): ▶ startet den Lauf schon VOR dem
  Incident — Zeit, die Maus zum Knopf zu bringen. Ohne Auto-Breaker
  kollabieren beide Kurven (Lane B == Lane A). „Breaker öffnen" von Hand
  → Lane B erholt sich sofort, Latenz stürzt vom Timeout auf ~0. Der Knopf
  wechselt dann zu „Breaker schließen": komplett manuell, der Breaker
  bleibt offen, bis du ihn schließt (kein Auto-Cooldown ohne Auto-Breaker).
- Der Latenz-Graph (unten) ist die Pointe: ohne Breaker klebt die Latenz
  am Timeout-Deckel (1 s) — ein stiller Drop, KEINE Fehlermeldung. Der
  offene Breaker weist sofort ab → Latenz fällt unter den Good-Case
  („billiger Fehler statt teurem Timeout").
- „Auto-Breaker" zuschalten (auch mitten im Kollaps) → der Breaker kippt
  selbst bei 50 % Fehlerrate und erholt sich per Cooldown/Half-Open; der
  Lauf startet dann wie gehabt direkt am Incident. Manuelles Öffnen und
  Schließen bleibt möglich.
- Vorhersage-Modus: der bekannte Flow — Goodput MIT Breaker ab t = 20 s
  skizzieren oder Preset wählen („rettet ohne Einbruch" ist die
  verbreitete falsche Intuition), dann ▶. Beide Kurven aus demselben
  Seed; die rote (ohne Breaker) ist das Kollaps-Ende aus dem Retry-Sturm.
- Zustandsband oben: rot = Open, amber = Half-Open. Während des Bursts
  re-trippt der Breaker typischerweise einmal.
- Pointe im Verdict: der Breaker rettet nicht den Burst — er opfert ihn
  kontrolliert. Chips: Recovery ≈ 10–20 s vs. nie · ≈ 900 billig
  verworfen vs. ≈ 7.800 teuer verloren (und steigend, Queue → OOM).
- ⚙: Cooldown 1 s → Zustandsband flattert (verfrühtes Schließen slammt
  die Queue); Kipp-Schwelle 0,85 → teurer; ×1,2 → Breaker kippt nie,
  beide Kurven identisch.
- Tab „Erklärung & Modell": FSM, gewollte Hysterese (Brücke Kapitel 3),
  der Handel (billig verworfen kauft Erholung).
-->

---
layout: section
---

# Diagnose: ein Symptom, drei Ursachen

Signale gezielt aufdecken — welcher Kanal diskriminiert?

<!--
- Mechanik-Wechsel: nicht mehr vorhersagen, sondern diagnostizieren.
- Das Leitsignal ist in allen Szenarien IDENTISCH generiert — erst die
  Konjunktion mit weiteren Signalen trennt die Ursachen.
- Jedes Aufdecken „kostet" (wie in echt: Dashboard bauen, Query schreiben).
  Vor jedem Aufdecken das Publikum tippen lassen!
-->

---
hideInToc: true
---

# Setup: Gleiche p99 — andere Krankheit?

Ein Latenz-Alarm: die **p99** eines Dienstes ist deutlich erhöht. Zwei völlig verschiedene Ursachen können **exakt dieselben Perzentil-Werte** erzeugen:

<div class="grid grid-cols-2 gap-3 mt-4">
<div class="intro-box"><b>Packet Loss</b><br>Das Netz verliert Pakete — TCP wartet auf den Retransmission-Timeout und sendet erneut.</div>
<div class="intro-box"><b>Langsame Anwendung</b><br>Der Dienst selbst braucht länger — GC-Pausen, Lock-Contention, langsame Queries.</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Auf dem p50/p99-Dashboard sehen beide Fälle <b>identisch</b> aus. Welche Darstellung der Latenz würdest du anfordern, um die Ursachen zu trennen — und worauf genau würdest du darin achten?
</Callout>

</div>

<!--
- Setup ohne Auflösung: nur die zwei Verdächtigen vorstellen. Das Publikum
  überlegen lassen, welche Ansicht sie anfordern würden (mehr Perzentile?
  Histogramm? Heatmap? Traces?).
- Nicht spoilern, WAS man in der Verteilung sieht — das zeigt die Simulation.
- Überleitung: in der Simulation sind beide Szenarien so kalibriert, dass
  die p99 identisch ist — Perzentile allein KÖNNEN sie also nicht trennen.
-->

---
clicks: false
hideInToc: true
routeAlias: latenz-verteilung
---

<LatencyRtoSim />

<!--
- Bedienung: ▶ startet den laufenden Request-Strom (startet bewusst
  pausiert — Slidev hält Nachbar-Folien gemountet). Szenario oben
  umschalten: Packet Loss vs. Langsame Anwendung — die p99-Anzeige im
  Kopf bleibt dabei (fast) gleich, das ist der Kernmoment.
- Zeigen: Packet Loss sammelt die Masse in diskreten Banden auf den
  RTO-Stufen (~40 / 240 / 640 / 1440 ms), geometrisch dünner werdend
  (p, p², p³); die langsame Anwendung erzeugt ein Kontinuum. Gleiche p99,
  andere Form — das Perzentil vernichtet genau die Information, die
  diagnostiziert.
- Ehrlichkeitshinweise (⚙-Modellnotiz): der Median unterscheidet sich
  sehr wohl; die konkreten RTO-Millisekunden sind Modellannahmen —
  universell ist die Banden-Struktur, nicht die Zahlen.
- ⚙: Schweregrad-Regler (beide Szenarien pro Stufe p99-kalibriert, LUT)
  und Zurücksetzen; der Erklärtext unter den Charts wechselt mit dem
  Szenario.
-->

---
hideInToc: true
---

# Setup: Die Queue wächst — warum?

Eine RabbitMQ-Queue wächst seit dem Incident-Zeitpunkt stetig. Drei völlig verschiedene Ursachen erzeugen **exakt dieses Leitsignal**:

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Producer</b>&ensp;publiziert msgs/s</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Queue</b>&ensp;Depth wächst 📈</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Consumer</b>&ensp;prefetcht, verarbeitet, ack't</span>
</div>

<div class="grid grid-cols-3 gap-3 mt-2">
<div class="intro-box"><b>Producer-Spike</b><br>Der Producer publiziert plötzlich mehr, der Consumer arbeitet normal.</div>
<div class="intro-box"><b>Vergifteter Consumer</b><br>Der Consumer hängt an einer Poison Message / einem blockierenden Call.</div>
<div class="intro-box"><b>Toter Consumer</b><br>Der Consumer ist weg (Crash, Disconnect).</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Welche <b>zusätzlichen Signale</b> trennen die drei Ursachen — und in welcher Reihenfolge würdest du sie aufdecken? Achtung: einer der Kanäle fehlt in den meisten Standard-Dashboards.
</Callout>

</div>

<!--
- Setup ohne Auflösung: die drei Verdächtigen vorstellen, Publikum
  diskutieren lassen, welche Metriken sie sehen wollen (Ack-Rate?
  Producer-Rate? unacked?).
- Überleitung: in der Simulation kostet jedes Signal einen Klick —
  genau wie in echt jede neue Query Zeit kostet.
-->

---
clicks: false
hideInToc: true
routeAlias: rabbitmq-queue
---

<RabbitQueueSim />

<!--
- Bedienung: Szenario A/B/C wählen (Zuordnung ist gemischt!), dann die
  Diskriminator-Signale von oben nach unten aufdecken — vor jedem Aufdecken
  tippen lassen. Bayes-Balken rechts zeigen die Belief-Richtung.
- Zeigen: die Asymmetrie — beim Producer-Spike ist nach Signal 1 (Ack-Rate
  konstant) alles klar; vergiftet vs. tot trennt erst Signal 3 (unacked:
  voller Prefetch vs. → 0).
- ▶/Scrub spielt die Zeitachse ab; nach vollem Aufdecken zeigen die
  Szenario-Buttons die Ursache.
- ⚙: Zurücksetzen & neu mischen (neue Zuordnung + neues Rauschen) +
  Modell-Hinweis (unacked = der Schlüssel-Kanal, fehlt oft im Dashboard).
-->

---
hideInToc: true
---

# Setup: CrashLoopBackOff — warum stirbt der Pod?

Ein Pod restartet seit dem Deploy im CrashLoopBackOff-Takt. Drei völlig verschiedene Ursachen erzeugen **fast identische Restart-Zähler** (gleiche BackOff-Kadenz):

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>kubelet</b>&ensp;startet Container</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Container</b>&ensp;läuft … und stirbt 💥</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>BackOff</b>&ensp;10 s → 20 s → 40 s … Restart #n</span>
</div>

<div class="grid grid-cols-3 gap-3 mt-2">
<div class="intro-box"><b>OOMKilled</b><br>Der Container frisst sich ans Memory-Limit, der Kernel killt hart.</div>
<div class="intro-box"><b>Liveness-Probe</b><br>Die App startet nur langsam — eine zu aggressive Probe killt sie vorher.</div>
<div class="intro-box"><b>App-Crash</b><br>Die Anwendung terminiert selbst mit einer Exception.</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Der Restart-Zähler sieht in allen drei Fällen gleich aus. Welche <b>zusätzliche Evidenz</b> trennt die Ursachen — und wo findest du sie? Achtung: sie steht nicht im CPU/Memory-Dashboard, sondern in <code>kubectl describe pod</code>.
</Callout>

</div>

<!--
- Setup ohne Auflösung: die drei Verdächtigen vorstellen, Publikum
  diskutieren lassen, welche Evidenz sie sehen wollen (Memory? Events?
  Exit-Codes? Logs?).
- Mechanik-Hinweis: hier trennt keine Kurvenform, sondern kategoriale
  Evidenz — Exit-Codes und Events sind diskrete Fakten, kein Signal.
- Überleitung: in der Simulation kostet jedes Aufdecken einen Klick —
  wie in echt jede kubectl-Query bzw. jedes Dashboard Zeit kostet.
-->

---
clicks: false
hideInToc: true
routeAlias: k8s-crashloop
---

<CrashLoopSim />

<!--
- Bedienung: Szenario A/B/C wählen (Zuordnung ist gemischt!), dann Spur 2
  und Spur 3 nacheinander aufdecken — vor jedem Aufdecken tippen lassen.
  Rail rechts: kategorialer Ausschluss (? / ✗ / ✓), kein Bayes.
- Zeigen: die Asymmetrie — beim OOM-Fall reicht Spur 2 (Memory-Sägezahn
  küsst das 512-Mi-Limit und bricht ab); Liveness vs. App-Crash sehen dort
  gleich aus und trennen sich erst in Spur 3: Exit-Code 137 vs. 143 vs. 1
  plus „Liveness probe failed"-Events vor jedem Kill.
- Pointe: der Liveness-Fall ist die häufigste reale Fehldiagnose — ein
  langsam startender Pod sieht aus wie ein Absturz; Fix ist eine
  startupProbe / initialDelay, kein App-Debugging.
- Nach vollem Aufdecken zeigen die Szenario-Buttons die Ursache.
- ⚙: Zurücksetzen & neu mischen (neue Zuordnung) + Exit-Code-Semantik
  (137 = 128+SIGKILL, 143 = 128+SIGTERM, 1 = App-Fehler).
-->

---
hideInToc: true
---

# Setup: Der Heap wächst — Leak oder Cache-Warmup?

Seit dem Deploy steigt der Heap eines JVM-Service stetig, die GCs werden hektischer. Zwei völlig verschiedene Ursachen erzeugen **exakt dieses Leitsignal**:

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Allokation</b>&ensp;Requests erzeugen Objekte</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Heap</b>&ensp;Sägezahn steigt 📈</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Full GC</b>&ensp;räumt auf — aber wie tief?</span>
</div>

<div class="grid grid-cols-2 gap-3 mt-2">
<div class="intro-box"><b>Memory-Leak</b><br>Unfreigebbare Objekte sammeln sich an — der Heap-Sockel wächst unbegrenzt, bis zum OOM.</div>
<div class="intro-box"><b>Cache-Warmup (gesund)</b><br>Ein Cache füllt sich nach dem Deploy bis zu seinem Sollmaß — dann ist Schluss.</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Der rohe Heap-Sägezahn sieht in beiden Fällen lange gleich aus. Welche <b>zusätzlichen Signale</b> trennen die beiden Ursachen? Achtung: eine der entscheidenden Achsen ist kein Messwert — sie muss aus dem Roh-Signal <b>berechnet</b> werden.
</Callout>

</div>

<!--
- Setup ohne Auflösung: die zwei Verdächtigen vorstellen, Publikum
  diskutieren lassen, welche Metriken sie sehen wollen (GC-Frequenz?
  Reclaim? Heap nach GC?).
- Pointe vorbereiten: nicht jedes Signal ist ein Messwert — die richtige
  Achse zu wählen ist selbst Signalkombination.
- Überleitung: in der Simulation kostet jedes Signal einen Klick —
  genau wie in echt jede neue Query Zeit kostet.
-->

---
clicks: false
hideInToc: true
routeAlias: memory-leak
---

<MemoryLeakSim />

<!--
- Bedienung: Szenario A/B wählen (Zuordnung ist gemischt!), dann die
  Signale von oben nach unten aufdecken — vor jedem Aufdecken tippen
  lassen. Bayes-Balken rechts zeigen die Belief-Richtung.
- Zeigen: Signal 1 (GC-Frequenz) grenzt NICHTS ein — konfundiert mit der
  Last, ohne Last-Modell nicht attribuierbar. Signal 2 (Reclaim pro GC)
  trennt: fällt gegen null (Leak) vs. stabilisiert sich (Cache).
  Signal 3 (Post-GC-Minimum) ist die Pointe: kein neuer Messwert,
  sondern aus Signal 0 berechnet (untere Hüllkurve) — monoton steigend
  (Leak) vs. Plateau (Cache).
- ▶/Scrub spielt die Zeitachse ab; nach vollem Aufdecken zeigen die
  Szenario-Buttons die Ursache.
- ⚙: Zurücksetzen & neu mischen (neue Zuordnung + neues Rauschen) +
  Modell-Hinweis (Roh-Heap & GC-Frequenz bewusst nicht inferenzwirksam;
  reale Überlagerung LRU-Cache + langsames Leak braucht längere Fenster).
-->

---
hideInToc: true
---

# Setup: Latenz-Spikes — Noisy Neighbor, Batch-Job oder GC?

Die p99-Latenz der App steigt seit dem Incident-Zeitpunkt steil an. Drei völlig verschiedene Ursachen erzeugen **exakt dieses Leitsignal**:

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Hypervisor</b>&ensp;teilt physische CPUs zu</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>VM</b>&ensp;Prozesse teilen sich die vCPUs</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>JVM</b>&ensp;App-Threads + GC</span>
</div>

<div class="grid grid-cols-3 gap-3 mt-2">
<div class="intro-box"><b>Noisy Neighbor</b><br>Eine fremde VM auf demselben Host frisst die physische CPU — der Täter sitzt <b>außerhalb</b> der VM.</div>
<div class="intro-box"><b>In-Guest Batch-Job</b><br>Ein Prozess <b>in</b> der VM rechnet plötzlich mit (cron? Backup? Log-Rotation?).</div>
<div class="intro-box"><b>JVM GC-Druck</b><br>Stop-the-World-Pausen <b>in der JVM</b> fressen die Latenz — die VM sieht von außen unauffällig aus.</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Welche <b>zusätzlichen Signale</b> trennen die drei Ursachen — und in welcher Reihenfolge würdest du sie aufdecken? Achtung: der Schlüssel-Kanal fehlt in den meisten Default-Dashboards.
</Callout>

</div>

<!--
- Setup ohne Auflösung: drei Verdächtige auf drei Ebenen (Hypervisor /
  VM / JVM) vorstellen, Publikum diskutieren lassen, welche Metriken sie
  sehen wollen (CPU? GC-Logs? Steal?).
- Überleitung: in der Simulation kostet jedes Signal einen Klick — genau
  wie in echt jede neue Query Zeit kostet.
-->

---
clicks: false
hideInToc: true
routeAlias: noisy-neighbor
---

<NoisyNeighborSim />

<!--
- Bedienung: Szenario A/B/C wählen (Zuordnung ist gemischt!), dann die
  Diskriminator-Signale von oben nach unten aufdecken — vor jedem Aufdecken
  tippen lassen. Bayes-Balken rechts zeigen die Belief-Richtung.
- Zeigen: User-CPU trennt nur den Batch-Job ab (steigt allein dort);
  Steal und GC bleiben in der CPU-Kurve unsichtbar. Erst %steal lokalisiert
  den Täter außerhalb der VM — GC-Pausenzeit bestätigt danach die JVM-These.
- ▶/Scrub spielt die Zeitachse ab; nach vollem Aufdecken zeigen die
  Szenario-Buttons die Ursache.
- ⚙: Zurücksetzen & neu mischen (neue Zuordnung + neues Rauschen) +
  Modell-Hinweis (%steal aus /proc/stat bzw. vmstat: vCPU lauffähig, aber
  keine physische CPU — der Kanal, der in Default-Dashboards oft fehlt).
-->

---
hideInToc: true
---

# Debrief: Dashboards, die diskriminieren

Das Leitsignal war in jedem Drill **identisch** — diagnostiziert hat immer ein Kanal, der im Standard-Dashboard oft fehlt:

<div class="mt-2" />

| Drill                    | Leitsignal (Symptom) | Der Schlüssel-Kanal                            |
| ------------------------ | -------------------- | ---------------------------------------------- |
| **Latenz-Verteilung**    | p99 erhöht           | die **Verteilungsform** (Banden vs. Kontinuum) |
| **RabbitMQ-Queue**       | Queue Depth wächst   | **unacked** (in-flight)                        |
| **CrashLoopBackOff**     | Restarts steigen     | **Exit-Codes** & Event-Reihenfolge             |
| **Heap: Leak vs. Cache** | Heap wächst          | das **Post-GC-Minimum**                        |
| **Noisy Neighbor**       | Latenz-Spikes        | **%steal**                                     |

<div v-click class="mt-3">

<Callout tone="success" title="Merksatz">
Standard-Dashboards zeigen <b>Symptome</b>. Diagnose braucht <b>Diskriminatoren</b> — Kanäle, die zwischen Hypothesen trennen. Die gehören ins Dashboard, <i>bevor</i> der Incident kommt.
</Callout>

</div>

<div class="abs-br m-3 text-xs opacity-60">

Dashboard-Ebenen & Drill-Down: <TalkXref slug="20260329-grafana-lgtm-monitoring-in-k8s-distributed-system" anchor="dashboard-architektur">Monitoring-Talk</TalkXref>

</div>

<style>
table {
  font-size: 0.72em;
}
table td,
table th {
  padding-top: 0.3em;
  padding-bottom: 0.3em;
}
</style>

<!--
- Debrief der fünf Diagnose-Drills: die Tabelle einmal durchgehen und
  fragen, welche dieser Kanäle im eigenen Dashboard fehlen.
- Klick: der Merksatz. Diskriminatoren VOR dem Incident einbauen — im
  Incident kostet jede neue Query Zeit (das war die Aufdeck-Mechanik).
- Fußzeile: wie man Dashboards in Ebenen baut → Monitoring-Talk.
-->

---
layout: section
---

# Abschluss

Error-Budgets, Querverweise, Nachspielen

---
hideInToc: true
---

# Setup: SLO, Error-Budget & Burn-Rate

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### Die Mechanik

- **SLO 99,9 %** ⇒ Budget = 0,1 % Fehler im 30-Tage-Fenster (= 43 min Totalausfall)
- **Burn-Rate** = wie schnell das Budget verbrennt (1× = genau am Limit)
- Alert feuert, wenn **langes UND kurzes Fenster** über der Schwelle liegen

</div>
<div class="intro-box intro-box-accent">

### Die Policy (SRE Workbook)

- **Notfall** (Fast Page): Burn 14,4× über 1 h (+ 5 min)
- **Warnung** (Slow Page): 6× über 6 h (+ 30 min)
- **Aufgabe** (Ticket): 1× über 3 d (+ 6 h)

</div>
</div>

Drei Fehlerbilder treffen auf diese Policy: **Spike** (100 % Fehler für 20 min) · **Schleichend** (0,3 % dauerhaft) · **Flattern** (2-min-Bursts à 5 % alle 30 min).

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Welcher Alarm feuert je Szenario <b>zuerst</b> — und wie viel <b>Budget ist dann noch übrig</b>? Und wie oft hätte ein naiver 5-Minuten-Alert gefeuert?
</Callout>

</div>

<!--
- Setup ohne Auflösung. Burn-Rate an einem Beispiel vorrechnen: 0,3 %
  Fehler bei 0,1 % Budget = Burn 3×.
- Burn-Rate-Alerting ist ein Regelkreis über den Regelkreisen — mit
  denselben Fallen: Fenster zu kurz = Flattern (Hysterese!), zu lang =
  das Budget ist weg, bevor jemand aufwacht. Multi-Window-Alerts sind
  gewollte Hysterese im Alerting — dieselbe Doppelschwellen-Idee wie
  der Recovery Threshold in Kapitel 3.
- Klick: die Frage stellen — die Antwort-Chips der Sim sind bewusst
  2/5/10 %-Bänder (θ·W/720 h, die Invariante).
-->

---
clicks: false
hideInToc: true
routeAlias: slo-burn-rate
---

<BurnRateSim />

<!--
- Bedienung: Szenario wählen, ZWEI Tipp-Fragen beantworten (Chips), dann
  ▶. Die Fehlerraten-Kurve oben ist die Aufgabe (sofort sichtbar);
  Burn-Raten, Alert-Lanes und Budget decken sich erst beim Abspielen auf.
  „↺ Reset" holt die Tipp-Phase zurück (Szenario + ⚙-Regler bleiben).
- Spike: Notfall nach 52 s bei 98,0 % Rest — die 2 % sind by design
  (14,4·1 h/720 h). Teuer ist die Dauer: 20 min = 46 % des Monatsbudgets.
  Nachlauf: mit Kurzfenster ≈ 5 min statt ≈ 59 min.
- Schleichend: weder Notfall noch Warnung (3× < 6×), Aufgabe nach ≈ 24 h
  bei 90 % — Readout „Budget“: leer in ~7 Tagen ab Ende.
- Flattern: naive 5-min-Lane feuert ~130-mal, die Policy genau 1 Aufgabe.
  Kernsatz: langes Fenster integriert (feuern), kurzes setzt schnell
  zurück — gewollte Hysterese, Doppelschwellen wie in Kapitel 3.
- ⚙: SLO 99 % auf „Schleichend“ (alles verstummt); Notfall-Fenster 5 min
  (Notfall flattert wie naiv); Intensität ×2 auf „Flattern“ (Warnung
  kommt dazu — wieder bei ≈ 95 %, die Invariante).
- Tab „Erklärung & Modell“: Policy-Tabelle mit 2/5/10 %, Invariante,
  Ehrlichkeitshinweise (Zeitraffer, ideale Fenster, kein Tagesgang).
-->

---
hideInToc: true
---

# Querverweise

<TalkXrefPanel
  variant="neutral"
  :here="{
    title: 'Komplexe Systeme im SRE-Alltag',
    bullets: [
      'Interaktive Simulationen: Warteschlangen, Sättigung, Hysterese, metastabile Ausfälle, Diagnose-Drills',
      'Workshop-Mechanik: <b>Predict first</b> und <b>Diagnose durch Konjunktion</b>',
      'Alle Simulationen einzeln verlinkbar — zum Nachspielen und Weitergeben',
    ],
  }"
  :refs="[
    {
      slug: '20260329-grafana-lgtm-monitoring-in-k8s-distributed-system',
      anchor: 'mm1-80-prozent',
      bullets: [
        'Die Theorie hinter diesem Deck: Methoden (RED/USE/Golden Signals), Schwellwerte, Hysterese-Alerting',
        'Dashboard-Architektur in vier Ebenen und der LGTM-Stack (Mimir · Loki · Tempo)',
      ],
    },
    {
      slug: '20260707-anatomy-of-autonomous-agents',
      anchor: 'alert-analyse',
      bullets: [
        'Geplanter <b>Monitoring-Agent</b>: „trianguliere neue Alerts&quot; als Runbook — die Diagnose-Drills aus diesem Deck, automatisiert',
        'Gleiche Agenten-Anatomie wie Ticket-Tests und CVE-Fixes: Runbook + Skills, Zustand im Alert-Ticket',
      ],
      hint: 'Die Aufdeck-Reihenfolge der Diagnose-Drills ist genau die Werkzeug-Reihenfolge, die so ein Agent lernen muss.',
    },
  ]"
/>

<!--
- Links dieses Deck, rechts die zwei Anschluss-Talks.
- Monitoring-Talk: woher die Theorie und die kopierten Simulationen stammen.
- Anatomie-Talk: der geplante Monitoring-Agent macht aus den Diagnose-Drills
  ein Runbook — Alert-Triangulation als automatisierter Workflow.
-->

---
layout: section
---

# Making of

Unter der Motorhaube: Architektur, Paradigmen, Didaktik

<!--
- Bonus-Kapitel für Selbststudium und Nachbauer; im Live-Talk je nach
  Zeitbudget kürzbar oder ganz überspringbar.
- Roter Faden: erst WIE gebaut (Architektur), dann WAS simuliert wird
  (Paradigmen + Landkarte), dann WARUM so bedient (Didaktik), zuletzt
  Ehrlichkeit (Grenzen, Quellen).
-->

---
hideInToc: true
routeAlias: making-of-architektur
---

# Architektur: drei Render-Pfade, eine Schale

<div class="grid grid-cols-3 gap-3 mt-3">
<div class="intro-box">

### 🖼️ Canvas

- Oszilloskop-Scopes (M/M/1, M/M/c) und alle Fixed-Step-Sims
- dichte Traces, Redraw pro Frame
- Theme-Wechsel wirkt sofort: Farben werden pro Frame gelesen

</div>
<div class="intro-box intro-box-accent">

### 📐 Rohes SVG

- Systemdynamik, Sparklines, Hysterese-Loops, Kantinen-Bühne
- deklarativ aus Vue-Templates
- kein Chart-Framework nötig

</div>
<div class="intro-box">

### 📊 d3 — nur wo nötig

- nur die 5 Diagnose-Sims
- nur `d3-scale` / `-selection` / `-shape`
- kein d3-zoom, kein d3-force

</div>
</div>

<div class="chain mt-4">
<span class="chain-node">SimShell<br/><small>Titel · Presets · ⚙ · Verdict</small></span>
<span class="chain-arrow">→</span>
<span class="chain-node">Composables<br/><small>useSimTransport · usePredictSketch · useScopeColors</small></span>
<span class="chain-arrow">→</span>
<span class="chain-node">Engines<br/><small>lib/mm1Engine · breakerModel · burnRate · rng</small></span>
</div>

<div v-click class="mt-3">

<Callout tone="info" title="Das Muster">
Der Sim-Zustand lebt in <b>einfachen JS-Objekten</b>, nicht im Reaktivitätssystem — Vue rendert Rahmen und Regler, die heiße Schleife zeichnet selbst.
</Callout>

</div>

<!--
- Entscheidungskriterium ist die Punktdichte: tausende Trace-Punkte pro
  Frame → Canvas; ein paar Dutzend Formen → SVG direkt aus dem Template.
- d3 bewusst klein gehalten: nur Skalen und Pfad-Generatoren, keine
  d3-Datenbindung — die macht Vue.
- Die SimShell-Schale macht 22 Sims kohärent bedienbar: gleiche Preset-Zeile,
  gleiches ⚙-Overlay, gleicher Verdict-Platz.
-->

---
hideInToc: true
routeAlias: making-of-paradigmen
---

# Diskret vs. analytisch? Die falsche Achse

<div class="grid grid-cols-2 gap-4 mt-3">
<div class="intro-box">

### Die Bauart täuscht

- fast jede Sim **mischt**: fester Takt (Fluid) **plus** Poisson-Züge
- Burn-Rate: analytisch vorberechnet **plus** Seed-Rauschen
- M/M/1: echtes Next-Event-DES **mit** Theorie-Overlay

</div>
<div class="intro-box intro-box-accent">

### Die zwei echten Achsen

- **deterministisch ↔ stochastisch** — entscheidet der Zufall nahe der Schwelle?
- **aggregiert ↔ individuell** — Flüsse und Mittelwerte oder einzelne Jobs?

</div>
</div>

<table class="mo-quad mt-3">
<tbody>
<tr><td class="mo-axis"></td><td class="mo-axis">deterministisch</td><td class="mo-axis">stochastisch</td></tr>
<tr><td class="mo-axis">individuell</td><td>— (selten sinnvoll)</td><td>M/M/1-Kantine (DES)</td></tr>
<tr><td class="mo-axis">aggregiert</td><td>Systemdynamik-Pipeline</td><td>Retry-Sturm (Fluid + Poisson)</td></tr>
</tbody>
</table>

<div v-click class="mt-3">

<Callout tone="warning" title="Wiederkehrendes Motiv">
Theorie-Kurve als Overlay über der Simulation: die Formel liefert den <b>Mittelwert</b>, die Simulation die <b>Streuung</b> — genau dort lebt das Risiko.
</Callout>

</div>

<style>
.mo-quad {
  font-size: 0.72em;
  line-height: 1.3;
}
.mo-quad td {
  padding: 0.2em 0.8em;
}
.mo-quad .mo-axis {
  opacity: 0.55;
  font-weight: 600;
}
</style>

<!--
- Kernaussage: „diskret vs. analytisch" beschreibt die Bauart, nicht den
  Erkenntniswert. Die didaktisch relevanten Achsen sind Zufall und
  Aggregationsgrad.
- Das Motiv-Callout ist das Echo der Schlussfolie: der Mittelwert
  verschweigt die Gefahr — nahe der Schwelle entscheidet der Zufall.
- Überleitung: „die nächste Folie plottet alle 22 Sims auf diese zwei
  Achsen — und danach führen wir die Naht live vor."
-->

---
clicks: false
hideInToc: true
routeAlias: paradigmen-landkarte
---

<ParadigmMap />

<!--
- Bedienung: Punkt oder Pill anklicken → Detail-Karte rechts (Engine,
  Zeitschritt, Zufall, Rendering, Mechanik, Folien-Link). Chips oben dimmen
  fremde Familien, „Alle" oder erneuter Klick hebt auf.
- Regie, drei Kontraste zeigen: M/M/1 oben rechts (stochastisch +
  individuell — gestrichelter Rand = läuft ehrlich ungeseeded auf
  Math.random) vs. Systemdynamik unten links (deterministisch + aggregiert)
  vs. Retry-Sturm in der Mitte (Fluid mit Poisson: stochastisch, aber
  aggregiert).
- Sockel-Band unten: „kein dynamisches Modell" — Diagnose-Traces sind
  Skript, Kataloge sind Keyframes. Ehrlichkeit vor Eleganz.
-->

---
hideInToc: true
---

# Setup: Die Naht live — wie lange hält „stabil"?

Gleiche Gleichungen wie der **Retry-Sturm** (per Import aus `breakerModel.js`) — aber **ohne Burst**: konstante Last **ρ = λ/μ**, nur das Poisson-Rauschen arbeitet.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Clients</b>&ensp;λ = ρ·μ konstant · Timeout 1 s · ≤ 2 Retries</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Queue</b>&ensp;unbegrenzt (FIFO)</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Service</b>&ensp;μ = 100 req/s</span>
</div>

Das Fluid-Mittel — „die Formel" — verspricht: **stabil für jedes ρ < 1** (die Falte liegt erst bei ρ<sub>c</sub> ≈ 0,999).

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Wie lange überlebt das System <b>wirklich</b>, je nach Last ρ? Skizziere die Überlebenszeit von ρ = 0,80 bis 1,05 (Deckel: 300 s). Wo liegt die Klippe?
</Callout>

</div>

<!--
- Der Bogen: „Diskret vs. analytisch" hat die Naht behauptet, die Landkarte
  hat sie kartiert — diese Sim führt sie live vor. Das ist das Artefakt zur
  HotOS-'25-Ensemble-Botschaft auf der Quellen-Folie.
- Setup ohne Auflösung! Kein Burst, kein Trigger — nur konstante Last und
  Poisson-Zufall. Freidlin-Wentzell einmal aussprechen: metastabil heißt
  langlebig, aber entrinnbar.
- Klick: die Frage. 30 s diskutieren lassen — die meisten tippen auf „ewig
  stabil bis ρ ≈ 1" (das Fluid-Versprechen).
-->

---
clicks: false
hideInToc: true
routeAlias: mttf-klippe
---

<MetastabilitySim />

<!--
- Tab „MTTF-Klippe": Überlebenszeit skizzieren (oder Preset wählen), dann
  ▶ Sweep — 11 Lastpunkte × 24 Läufe, MTTF als Exponential-MLE mit
  Zensierung (▲ = ≥ 300 s). Verdict vergleicht die eigene Klippe mit der
  gemessenen (ρ ≈ 0,96) und der Fluid-Falte (ρc ≈ 0,999).
- Kernaussage: bei ρ = 0,90 lebt das System im Mittel nur Minuten — die
  letzten ~10 % Kapazität vor der Falte gehören dem Rauschen. Das ist die
  Metastabilitäts-Begründung der 80-%-Regel aus Kapitel 1.
- Tab „Die Naht": Potential-Becken (Fluid-Skelett) mit Ball = Live-Queue;
  ρ-Regler wirkt live — Becken schrumpft, Entkommen häuft sich. Preset
  „nahe der Klippe" laufen lassen: ⚡-Marker in der Trajektorie, Histogramm
  füllt sich (exponentiell verteilt — Entkommen ist gedächtnislos).
- ⚙: R verschiebt Falte und Klippe; „Gleicher Seed" macht den Sweep
  reproduzierbar; Reset/Rewind wie bei allen Predict-first-Sims.
-->

---
hideInToc: true
routeAlias: making-of-didaktik
---

# Didaktik: erst festlegen, dann anschauen

<div class="grid grid-cols-2 gap-4 mt-3">
<div class="intro-box">

### ✏️ Commitment-Device

- **Predict first**: ▶ schaltet erst frei, wenn die Skizze **55 % Abdeckung** erreicht (`usePredictSketch`)
- **Verdict-Banner** nach dem Lauf: Treffer oder Überraschung — beides ist der Lernmoment
- drei Archetypen: ✏️ Predict-first · 🔍 Diagnose-Drill · 🖱️ Katalog

</div>
<div class="intro-box intro-box-accent">

### 🎛️ Bedien-Philosophie

- wenige sichtbare Regler (1–3), alles Weitere hinter ⚙
- Presets = Szenarien mit Geschichte, keine Parameterwüste
- **↺ Reset** löscht alles, **⏮ Rewind** nur den Lauf — die Skizze bleibt
- Deep-Link pro Sim (`routeAlias`) fürs Nachspielen

</div>
</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Warum der Zwang?">
Wer erst tippt, kann sich hinterher nicht einreden, er hätte es eh gewusst — die Überraschung wird messbar und bleibt hängen.
</Callout>

</div>

<!--
- Das Coverage-Gate ist bewusst unbequem: ohne festgehaltene Erwartung
  kein Start. Skippen geht, kostet aber das Verdict.
- Muster stammt aus den Explorable Explanations (Bret Victor, Nicky Case):
  „You draw it" — Vorhersage einzeichnen, bevor die Daten kommen.
- Die ⚙-Regler sind fürs Zuhause-Experimentieren; live lenken sie nur ab.
-->

---
hideInToc: true
routeAlias: making-of-engineering
---

# Engineering: Determinismus, Performance, Tests

<div class="grid grid-cols-2 gap-3 mt-3">
<div class="intro-box">

### 🎲 Zufall mit Seed

- mulberry32-PRNG, Poisson nach Knuth, Box-Muller (`lib/rng.js`)
- gleicher Seed ⇒ exakt gleicher Lauf — reproduzierbar und teilbar
- ehrliche Ausnahme: die Kantinen-Sims laufen ungeseeded auf `Math.random`

</div>
<div class="intro-box">

### ⚡ Heiße Pfade

- Sim-Zustand nicht-reaktiv, ein Version-Tick benachrichtigt Vue
- Engines in `shallowRef`, Canvas für dichte Traces
- rAF bündelt Schritte pro Frame; `prefers-reduced-motion` respektiert

</div>
<div class="intro-box">

### ✅ Tests (Vitest)

- `bullwhipModel` und `burnRate` gegen analytisch gerechnete Tabellen gepinnt
- Modelle sind pure JS-Module — testbar ganz ohne Browser

</div>
<div class="intro-box">

### 🔍 QA (Playwright)

- Overflow-Checker rendert jede Folie in Chromium, Firefox **und** WebKit — hell und dunkel
- nötig, weil Slidev Überlauf stumm abschneidet

</div>
</div>

<!--
- Version-Tick-Muster: ein ref zählt hoch, Computeds hängen daran — das
  Zustandsobjekt selbst bleibt für Vues Proxy unsichtbar (kein Tracking
  im 50-Hz-Takt).
- Warum die Kantinen ungeseeded blieben: 1:1-Portierung der Originale,
  und die sichtbare Streuung ist dort didaktisch erwünscht.
- Die Modell-Extraktion nach lib/ passierte genau für die Tests: Formeln
  raus aus den .vue-Dateien, dann gegen Erwartungstabellen gepinnt.
-->

---
hideInToc: true
routeAlias: making-of-grenzen
---

# Grenzen: was die Modelle bewusst weglassen

<div class="mo-limits">

| Vereinfachung                               | Warum das okay ist                                                |
| ------------------------------------------- | ----------------------------------------------------------------- |
| kein Event-Heap-DES in den Fluid-Sims       | fester Takt (Δt = 0,02–0,05 s) reicht für Flüsse und Schwellen    |
| kein RK4, nur Vorwärts-Euler                | Δt ist klein gegen die Zeitkonstanten der Systeme                 |
| Fluid-Approximation verschweigt Tail-Latenz | dafür gibt es die Latenz-Sim (Monte-Carlo) separat                |
| keine Netzwerk-Topologie                    | ein Service, ein Pool — Mesh-Effekte wären ein eigenes Deck       |
| Diagnose-Familie = **skriptete Traces**     | Drill-Ziel ist das Ablesen der Diskriminatoren, nicht die Dynamik |

</div>

<div v-click class="mt-4">

<Callout tone="warning" title="Merksatz">
Jedes Modell ist falsch — diese hier sagen dir wenigstens, <b>wo</b>.
</Callout>

</div>

<style>
.mo-limits table {
  font-size: 0.8em;
  line-height: 1.35;
}
</style>

<!--
- Das Muster stammt von Nicky Case: jede Explorable veröffentlicht ihre
  Vereinfachungsliste mit — Modellgrenzen sichtbar machen statt kaschieren.
- Wichtigste Zeile ist die dritte: Fluid-Modelle können prinzipiell keine
  Tail-Latenz zeigen. Wer p99 sehen will, braucht Einzelereignisse —
  deshalb existiert die Latenz-Sim als Monte-Carlo-Sampling daneben.
-->

---
hideInToc: true
routeAlias: making-of-quellen
---

# Quellen & Inspiration

- Bret Victor — _Explorable Explanations_ (2011) · reaktive Dokumente statt toter Text
- Nicky Case — _Why Simulate?_ · _Explorable Explanations: 4 More Design Patterns_ · Predict-first & Scaffolding
- Isaacs et al. — _Analyzing Metastable Failures_ (HotOS '25) · AWS nutzt ein **Ensemble**: CTMC-Modelle + diskrete Ereignissimulation + Emulation
- Habibi et al. — _MSF-Model_ (SRDS 2024, arXiv:2309.16181) · Metastabilität warteschlangentheoretisch modelliert
- Mor Harchol-Balter — _Performance Modeling and Design of Computer Systems_ (2013) · die Warteschlangen-Referenz

<div class="mt-6 text-xs opacity-60">

Und ja, dieses Deck ist selbst ein Exponat: gebaut mit einem LLM-Agenten (Claude Code) in ~3 Tagen — inklusive aller 22 Simulationen; die Commits tragen den 🤖-Trailer.

</div>

<!--
- HotOS-'25-Botschaft hervorheben: Profis wählen nicht EIN Paradigma,
  sondern staffeln bewusst mehrere Abstraktionsebenen fürs selbe Problem —
  genau die Aussage der Paradigmen-Landkarte.
- Victor/Case sind die didaktische Blaupause (Predict-first, ehrliche
  Vereinfachungsliste); Harchol-Balter die Theorie hinter Kapitel 1.
-->

---
layout: end
hideInToc: true
---

# Danke

Zum Nachspielen: Jede Simulations-Folie hat einen Deep-Link — Folie öffnen genügt. ⚙ = Experimentier-Regler.

Quellen: Herbert Simon, _The Architecture of Complexity_ (1962) · thesoftwarefrontier.com, _How Systems Really Fail_ · Bronson et al., _Metastable Failures_ (HotOS ’21) · Lee et al., _The Bullwhip Effect_ (1997) · Google SRE Workbook (SLO/Burn-Rate)

<!--
- Selbststudium-Hinweis wiederholen: Deep-Links, ⚙-Labore, „Gleicher Seed"
  zum Reproduzieren.
- Wer nur eine Sache mitnimmt: der Mittelwert verschweigt die Gefahr —
  nahe der Schwelle entscheidet der Zufall.
-->
