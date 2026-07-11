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
