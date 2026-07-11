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
<div class="map-item">🔍 RabbitMQ: Queue wächst</div>
</div>
<div class="map-col">
<div class="map-head">🔁 Retry als Verstärker</div>
<div class="map-item">✏️ Retry-Sturm</div>
<div class="map-item">✏️ Cache-Stampede</div>
<div class="map-item">🚧 Cascading Failure</div>
<div class="map-item">🚧 Circuit Breaker & Shedding</div>
</div>
<div class="map-col">
<div class="map-head">🎛️ Regelkreis mit Verzögerung</div>
<div class="map-item">✏️ Autoscaler-Hunting</div>
<div class="map-item">✏️ Bullwhip-Effekt</div>
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

✏️ Predict-first &nbsp;·&nbsp; 🔍 Diagnose-Drill &nbsp;·&nbsp; 🖱️ interaktiver Katalog &nbsp;·&nbsp; 🚧 Platzhalter, Simulation folgt

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
-->

---
hideInToc: true
routeAlias: littles-law
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

### Was die Übung zeigen wird

- Aus λ und Ziel-Latenz die **nötige Kapazität** herleiten
- **Headroom-Planung** mit der Wq-Hyperbel aus diesem Kapitel
- Workshop-Rechenaufgaben mit Auflösung — Zahlen aus echten Systemen

</div>
</div>

<div class="mt-4">

<Callout tone="info" title="🚧 Simulation in Arbeit — Platz reserviert">
Geplant: interaktive Rechen-Drills auf Basis der Kantinen-Simulation — λ, W oder N verdecken, die fehlende Größe schätzen, dann messen. Der Little-Check-Gauge im M/M/1-Simulator ist der Vorgeschmack.
</Callout>

</div>

<!--
- Platzhalter-Folie: Konzept steht, Simulation folgt.
- Mündlich: Little's Law ist der Konsistenz-Check schlechthin — der
  fünfte Gauge in der Kantinen-Sim rechnet genau das live nach.
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

# Setup: Der Bullwhip-Effekt

Endkunden kaufen sehr gleichmäßig: **100 Stück/Woche** (± kleines Rauschen).
Ab **Woche 15** steigt die Nachfrage **dauerhaft um 20 %** auf **120 Stück/Woche** — mehr passiert nicht.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Endkunden</b>&ensp;100 → 120 Stück/Woche</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Händler</b>&ensp;Stufe 1</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Großhandel</b>&ensp;Stufe 2</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Distributor</b>&ensp;Stufe 3</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Fabrik</b>&ensp;Lieferzeit je Stufe: 2 Wochen</span>
</div>

Jede Stufe der Kette sieht nur die **Bestellungen ihrer Nachbarstufe**, prognostiziert daraus
und bestellt nach einer Order-up-to-Politik (Ziel: Prognose × (Lieferzeit + 1) im Bestand + unterwegs).

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Was bestellt die <b>Fabrik</b> pro Woche, wenn die Endkunden-Nachfrage ein einziges Mal dauerhaft um <b>+20 %</b> steigt? Eine glatte Anpassung, moderates Überschwingen — oder starke Oszillation?
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
- Bedienung: Vorhersage der Fabrik-Bestellungen direkt ins obere Diagramm
  skizzieren (Maus/Finger) oder Preset wählen (glatte Anpassung /
  Überschwingen / starke Oszillation), dann ▶ starten. Coverage-Gate:
  Skizze muss von (fast) links bis (fast) rechts reichen.
- Zeigen: Die dunkle Linie (Endkunden-Nachfrage) ist vorab vollständig
  bekannt — nur +20 % ab Woche 15. Nach dem Lauf: Fabrik-Spitze weit über
  der Nachfrage, danach Wochen mit 0 Bestellungen (Produktionsstopp);
  unteres Diagramm: Bestand schießt hoch und fällt in den Rückstand
  (schraffierte Zone). Klick auf Legenden-Einträge blendet einzelne
  Stufen ein/aus. Beachte: Die Fabrik schwankt schon VOR Woche 15 —
  reines Rauschen wird genauso verstärkt.
- Verdict unten vergleicht Vorhersage- und Mess-Kategorie (Spitzenwert)
  und zeigt die Varianz-Verstärkung je Stufe (× vs. Nachfrage).
- ⚙ Experimentieren: Lieferzeit L und Prognose-α verstärken die Peitsche;
  POS-Sharing (alle Stufen sehen die Endkunden-Nachfrage) dämpft sie
  drastisch — mit „Gleicher Seed" direkt vergleichen! Frühere
  Fabrik-Läufe bleiben blass sichtbar.
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

Die Verstärker entschärfen — Platzhalter für kommende Simulationen

<!--
- Kurzes Kapitel: zwei geplante Simulationen, die Konzepte stehen schon.
-->

---
hideInToc: true
routeAlias: cascading-failure
---

# Kaskadierender Ausfall — die Health-Check-Spirale

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

- Der Load Balancer ist als **Schutz** gebaut — unter Last wird er zum **Verstärker**
- Verwandt mit dem Retry-Sturm: dieselbe Selbsterhaltung, eine Ebene höher
- Klassische Gegenmittel: Panic-Mode/Fail-Open (Envoy), Mindest-Quorum, langsamere Auswurf-Regeln

<div class="mt-4">

<Callout tone="info" title="🚧 Simulation in Arbeit — Platz reserviert">
Geplant (Predict-first): N Instanzen hinter einem LB, Health-Check-Schwellen als ⚙-Regler — vorhersagen, ab wie vielen ausgeworfenen Instanzen die Kaskade unumkehrbar wird.
</Callout>

</div>

<!--
- Platzhalter: Konzept per Kausalkette erklären, Simulation folgt.
- Brücke: das ist der Retry-Sturm auf Infrastruktur-Ebene — der „Retry"
  ist hier die Lastumverteilung des LB.
-->

---
hideInToc: true
routeAlias: circuit-breaker
---

# Circuit Breaker & Load Shedding

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### Schon live gesehen

- **✂️ Load-Shed** in der M/M/1-Kantine: Wartende verwerfen, Wq sofort runter
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

<div class="mt-4">

<Callout tone="info" title="🚧 Simulation in Arbeit — Platz reserviert">
Geplant: Retry-Sturm-Szenario mit zuschaltbarem Breaker — vorhersagen, wie sich Recovery-Zeit und verworfene Requests gegen das ungebremste System verschieben.
</Callout>

</div>

<!--
- Platzhalter: die Gegenmaßnahmen-Perspektive bündeln — vier Sims dieses
  Decks haben schon je ein Gegenmittel eingebaut (Shed, Single-Flight,
  Age-Drop, Stabilization Window).
- Merksatz: Ein Breaker ist gewollte Hysterese — dieselbe Mechanik, die
  in Kapitel 3 als Problem auftrat, hier als Werkzeug.
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
routeAlias: slo-burn-rate
---

# SLO, Error-Budget & Burn-Rate

<div class="grid grid-cols-2 gap-4 mt-4">
<div class="intro-box">

### Die Mechanik

- **SLO 99,9 %** ⇒ Budget = 0,1 % Fehler pro Fenster
- **Burn-Rate** = wie schnell das Budget verbrennt (1× = genau am Limit)
- Alerting auf **zwei Fenstern**: schnell (Notfall) + langsam (Trend)

</div>
<div class="intro-box intro-box-accent">

### Warum hier?

Burn-Rate-Alerting ist ein **Regelkreis über den Regelkreisen** — mit
denselben Fallen: Fenster zu kurz = Flattern (Hysterese!), zu lang =
das Budget ist weg, bevor jemand aufwacht.

</div>
</div>

<div class="mt-4">

<Callout tone="info" title="🚧 Simulation in Arbeit — Platz reserviert">
Geplant: Fehlerraten-Szenarien (Spike, Schleichend, Flapping) gegen Multi-Window-Burn-Rate-Alerts — vorhersagen, welcher Alert wann feuert und wie viel Budget dann noch übrig ist.
</Callout>

</div>

<!--
- Platzhalter: Burn-Rate-Mechanik in zwei Boxen, Simulation folgt.
- Brücke zurück zu Kapitel 3: Multi-Window-Alerts sind gewollte Hysterese
  im Alerting — dieselbe Doppelschwellen-Idee wie der Recovery Threshold.
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
