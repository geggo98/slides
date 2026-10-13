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
<div class="map-item">✏️ Voll ODER leer? <span class="map-tag">Einwand</span></div>
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
<div class="map-item">✏️ Wandernde Engpässe <span class="map-tag">Sandbox + Drehbuch</span></div>
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
hideInToc: true
---

# Setup: Der Einwand aus dem Publikum

„Schöne Theorie — aber **in echt** ist so eine Schlange doch fast immer **entweder ganz voll oder ganz leer**!" An der Supermarktkasse: Band frei **oder** Traube bis ins Regal — selten das brave Mittelfeld.

<div class="chain mt-4 mb-4">
<span class="chain-node"><b>Ankünfte</b>&ensp;λ̄ = 0,9 · vier Verkehrsmuster</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Puffer</b>&ensp;endlich, K = 40</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Service</b>&ensp;μ = 1</span>
</div>

Vier Szenarien, (fast) gleiche mittlere Last: **gleichmäßig** · **kurze Schübe** · **lange Phasen** · **selbstverstärkend** (Retries).

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Der Einwand beschreibt eine <b>bimodale</b> Verteilung: Masse an beiden Rändern, Loch in der Mitte. Reicht dafür schon „die Last kommt in Schüben" — oder braucht es mehr? Pro Szenario erst tippen, dann zeigt die <b>exakte</b> Verteilung die Wahrheit.
</Callout>

</div>

<!--
- Echter Einwand nach dem Vortrag — ernst nehmen: er beschreibt eine
  Beobachtung, keinen Denkfehler. Die Frage ist, WANN sie zutrifft.
- Zahlen: mittlere Last 0,9 in drei der vier Fälle identisch — nur die
  DYNAMIK unterscheidet sich (Fall C: 0,6 Grundlast + Retry-Feedback).
- Klick: 30 s diskutieren lassen — die meisten tippen „Schübe reichen".
- Nicht verraten: Burstiness allein reicht nicht — es braucht lange
  Phasen (Korrelationszeit) oder Feedback. Der Einwand wird damit selbst
  zum Diagnose-Werkzeug.
-->

---
clicks: false
hideInToc: true
routeAlias: voll-oder-leer
---

<QueueDynamikSim />

<!--
- Bedienung: Szenario oben wählen → Vorhersage-Maske über dem Histogramm:
  unimodal („nur leer") oder bimodal („voll ODER leer") tippen, erst dann
  deckt sich die exakte Hülle auf. Regie-Reihenfolge: 0 → B1 → B2 → C.
- Fall 0 (gleichmäßig, ρ=0,9): geometrisch fallend, unimodal — Referenz.
- Fall B1 (kurze Schübe): gleiche marginale Varianz wie B2, aber τ_c=0,05 —
  die Bursts mitteln sich weg, weiterhin unimodal. Kernsatz: Burstiness
  allein erzeugt keine Bimodalität.
- Fall B2 (lange Phasen): identischer Mix, nur q=0,01 → τ_c=50: Stoßzeit
  vs. Nacht → bimodal. Treiber ist die Korrelationszeit, nicht die Varianz.
- Fall C (heizt sich auf): ρ̄=0,6 + lineares Retry-Feedback → bimodal UND
  metastabil: MFPT ≈ 6 900 — der volle Ast kommt spontan fast nie.
  ⚡ Laststoß (Sprung auf n=K) oder ⏩ π auffüllen (Batch) zeigen ihn.
  Brücke zum Bonus: exakt der Mechanismus der MTTF-Klippe (mttf-klippe).
- Konvergenz = 1 − TV-Distanz: bei Fall C plateaut sie — ehrlich zeigen!
- ⚙: ρ̄ · Burst-Amplitude b · Umschaltrate q (log) · Feedback r · Tempo ·
  Lesehilfe Wartezeit-Zonen · Vorhersage-Modus · Seeds.
- Auflösung des Einwands: „voll ODER leer" stimmt — aber nur bei langen
  Lastphasen oder Selbstverstärkung. Wer es an der Kasse sieht, hat
  Stoßzeiten vor sich; wer es im System sieht, Phasen-Last oder Retries.
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
- Bedienung: links Szenario wählen (nach Kategorie gruppiert: Compute, Pool,
  Infra, Extern, Kaskade), dann ▶ drücken — der Fortschritts-Slider
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
<strong>Hysterese = Integrator + Doppelschwelle.</strong> Entsteht, wo ein gedächtnisbehafteter Mechanismus getrennte Set-/Reset-Schwellen hat (Schmitt-Trigger) — gewollt als Anti-Flattern (Galera <code>fc_factor</code> &lt; 1, Grafana Recovery Threshold).
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
- Eck-Animationen: grau = Last, Farbe = Reaktion. Fläche = Pegel (Gedächtnis),
  Linie = Rate; harte Kanten = binär, glatte Kurve = proportional. Wehr:
  Sägezahn im Hystereseband; Regler: exponentielle Annäherung; Reflex: Rate
  kippt sofort auf 0 und zurück; Dämpfer: gedämpftes Mitlaufen. ⓘ an jeder
  Spur hält alles an und öffnet die Vergrößerung mit Erklärung.
  Jeder Datenpunkt ist klickbar: Dialog mit Was, Warum hier, Achtung und Link
  auf die Original-Doku. Einordnung faktengeprüft: Fenster-/Credit-Verfahren
  (TCP, Netty, HTTP/2, Reactive Streams, credit_flow) sind pegelbasiert und
  stehen im Wehr. Lehrpaar: Envoy stop_accepting_requests ist mit Trigger
  threshold ein Reflex, mit scaled ein Dämpfer.
-->

---
clicks: false
hideInToc: true
routeAlias: systemdynamik
---

# Systemdynamik — Interaktiv

<SystemDynamicsSimulator />

<!--
- Bedienung: Szenario wählen (Queues als Federn,
  Dirac-Impuls, Überlast + Recovery, Wandernder Engpass), ▶ startet die
  Pipeline-Animation Gateway → Quote-Service → Provider-Adapter.
- Zeigen: „Dirac-Impuls" (Batch = maximale Oszillation) und „Wandernder
  Engpass" (der Rückstau wandert mit den Kapazitätseinbrüchen: erst
  Quote-Service, dann Provider-Adapter, dann Gateway) — die Kernaussagen
  der Sektion live.
- Die drei Regeln (Schutzkapazität, Steady Flow, Hysterese) stehen auf der
  M/M/1-Folie.
- Mit Zufall, verdeckter Nachbar-VM und Gegenmaßnahmen als Schaltern:
  Folie „Wandernde Engpässe“ (wandernde-engpaesse) im Kapitel
  Gegenmaßnahmen.
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

Die Verstärker entschärfen — der Load Balancer als Verstärker, der Breaker als gewollte Hysterese, die Kette mit dem wandernden Engpass

<!--
- Drei Sims: Health-Check-Spirale (Kaskade + Panic-Mode), Circuit Breaker
  (Opfer kauft Erholung) und Wandernde Engpässe (Sandbox + Drehbuch:
  Beseitigen legt den nächsten Engpass frei, Abfangen schafft keine
  Kapazität — ein Modell, zwei Folien).
- Danach ein Debrief aus Kundensicht: was die Gegenmaßnahmen für die
  Deadline der Kunden bedeuten (Brücke zum Monitoring-Talk).
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
hideInToc: true
---

# Setup: Der wandernde Engpass im Online-Shop

Produktseiten brauchen Webserver und Bestandsprüfung, Checkouts zusätzlich den Zahlungsdienst (**Zahlen illustrativ**):

<div class="chain mt-4 mb-4" style="font-size: 0.8em">
<span class="chain-node"><b>Webserver</b>&ensp;100 req/s je Instanz</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Bestandsprüfung</b>&ensp;eine DB, 300 Produktseiten/s</span>
<span class="chain-arrow">→</span>
<span class="chain-node"><b>Zahlungsdienst</b>&ensp;extern, 70 req/s</span>
</div>

- **Ruhiger Nachmittag:** konstant **270 req/s**, **3 Webserver**, nichts im Log — nebenan auf dem Host eine **fremde VM**
- **Rabattaktion:** **100 → 1.000 req/s** bei **2 Webservern**; Funnel: 10 % der Produktseiten → Checkout (illustrativ)
- Bestand und **personalisierte Empfehlungen** jeder Produktseite fragen **dieselbe DB**

<div v-click class="mt-4">

<Callout tone="warning" title="Die Frage">
Bei <b>konstanter</b> Last wechselt der Engpass zwischen Webserver und Bestandsprüfung — woher kommt das? Und in der Aktion, wenn weitere Webserver starten: <b>Wohin wandert der Engpass dann</b> — und ab wann helfen mehr eigene Server nicht mehr?
</Callout>

</div>

<!--
- Setup ohne Auflösung! Eine Kette, zwei Folien: erst der ruhige
  Nachmittag (Ursache), dann die Rabattaktion (Gegenmaßnahmen). Die
  Zahlen sind illustrativ — es geht um Richtung und Reihenfolge, nicht
  um Sizing.
- Kopfrechnen Nachmittag: 3 × 100 = 300 req/s Webserver gegen 270 —
  knapp. Die DB rechnet in Einheiten: Eine Produktseite kostet 1,5 E
  (Bestand 0,3 + Empfehlungen 1,2), die DB schafft 450 E/s, also 300
  Produktseiten/s. Beide Reserven sind knapp — es braucht nicht viel,
  um eine davon aufzuzehren. Was sie aufzehrt, klärt erst die Sim.
- Kopfrechnen Aktion: 2 × 100 = 200 req/s Webserver gegen 1.000
  Anfragen — klar überlastet. Die Bestandsprüfung sieht nur, was die
  Webserver durchlassen (höchstens 200 gegen 300): Sie wirkt gesund. Der
  erste Engpass versteckt den nächsten.
- NICHT vorrechnen, was nach dem Scaling passiert — das ist Schritt 1
  im Drehbuch der Sim (Schritt 0 fragt nur „Wo klemmt es zuerst?“).
  Auch den Zahlungsdienst nicht kommentieren: 10 % von 909 Produktseiten
  ≈ 91 Checkouts/s gegen 70 ist die Pointe von Schritt 4.
- „Konstante Last, nichts im Log“ ist der Alltag aus dem
  Monitoring-Talk („Ein Auslöser ist nicht nötig“). Die fremde VM nur
  erwähnen, nicht erklären — in der Sim wird sie aufgedeckt.
- Klick: die Frage stellen, 30 s diskutieren lassen, dann zur ersten
  Sim.
-->

---
clicks: false
hideInToc: true
routeAlias: wandernde-engpaesse
---

<WanderingBottleneckSim />

<!--
- Bedienung im PUBLIKUMSFENSTER, nicht im Presenter: Presenter- und
  Publikumsansicht rechnen je eine eigene Sim — Schalter, Aufdecken und
  Tempo werden nicht synchronisiert. Die Vorschau der nächsten Folie
  steht still. Nach jedem Mausklick geht der Klicker normal weiter.
- Startet mit dem Preset „Nachbar-VM (verdeckt)“ (Zeile „Ursache:“):
  konstant 270 req/s, 3 Webserver, Zeitraffer ×20. Läuft beim Betreten
  sofort los, nach 10 min Vorlauf — das Diagramm ist schon voll.
  Transport: „⏸ Pause“ / „▶ Weiter“, Zeitraffer-Knöpfe, „⏩“ rechnet
  Sim-Zeit sofort. „↺ Neu“ startet mit demselben Seed neu und setzt die
  Schalter zurück.
- Zeigen: Die Last ist flach („req/s konst.“; darunter „Ist …“ — die
  Ankünfte schwanken leicht um den Mittelwert), trotzdem springt das
  Engpass-Band (satt = Engpass, blass = knappste Station) zwischen
  Webserver und Bestandsprüfung. Die Statusanzeige oben nennt „Engpass
  jetzt … · kollabiert“ bzw. „kein Engpass · knappste Reserve …“. Die
  Fußzeile zählt Engpass-Wechsel und Engpass-Zeit im 10-min-Fenster —
  konstante Last, kein Deploy, kein Fehler im Log. Hinter dem Engpass
  melden die Karten „läuft leer“; ist die Überlast vorbei, aber die
  Queue noch voll, steht orange „Rückstau baut ab …“. Die Karten zeigen
  Momentwerte (Reserve = Kapazität / Last − 1 der Karte), Band und
  Statusanzeige die geglättete Reserve.
- Tippen lassen, wer die Kapazität klaut. Schon verdeckt zeigt die
  Hosts-Leiste die Wirkung: „je … statt … req/s — Ursache unbekannt“ an
  den Webservern, „Disk-await ↑ … ms — Ursache unbekannt“ an der DB.
  Dann „🔒 Nachbar-VM aufdecken“ (oder ⚙ „Alle aufdecken“): CPU-Schübe
  der fremden VM fallen mit dem Webserver-Engpass zusammen, IO-Schübe
  mit dem Engpass an der Bestandsprüfung (DB); im Diagramm als Streifen
  „Nachbar“ direkt unter dem Engpass-Band, Legende „Nachbar CPU“ /
  „Nachbar IO“. Die Fußzeile zählt jetzt, wie viele Wechsel in einen
  Nachbar-Schub fallen. ⚙ „Wieder verdecken“ nimmt das Aufdecken zurück
  — „↺ Neu“ tut das nicht.
- Der Nachbar ist ein Batch-Job: erst CPU (komprimieren), dann IO
  (schreiben), dann Pause. Deshalb wandert der Engpass im Takt Webserver
  → Bestandsprüfung → keiner. Nicht als Zufall verkaufen — zufällig sind
  nur Dauer und Stärke der Schübe.
- Was der Gast sieht: CPU-Konkurrenz als %steal an den Web-VMs (st in
  top/vmstat, aus /proc/stat; im Modell 25–40 %). IO-Konkurrenz zeigt
  KEIN steal, sondern längere Disk-Wartezeit an der DB: await in
  iostat -x steigt auf das 1,5- bis 2,0-Fache von 1,2 ms; %iowait gilt
  laut Kernel-Doku als unzuverlässig. Einen Steal-Zähler für IO gibt es
  nicht. Nach dem Aufdecken steht genau das in der Hosts-Leiste
  („Gast: %steal …“ bzw. „Gast: Disk-await … · %steal …“).
- Preset „Nur Zufall“: Nachbar aus, 275 req/s und deutlich stärkere
  Eigenschwankungen in Ankünften und Kapazität als im Nachbar-Preset, bei
  knappen Reserven — der Engpass wandert trotzdem, nur seltener. Mit den
  Werten des Nachbar-Presets bliebe er ohne Nachbarn fast immer aus (so
  auch bei „🏠 Eigener Host“). Das ist die strengste Lesart von „Ein
  Auslöser ist nicht nötig“ — Roser, Nakano & Tanaka (2003): „the
  bottleneck shifts between different machines, depending on the
  preceding random events“ (dort zählen auch Maschinenausfälle dazu;
  hier reichen schon Schwankungen). Dort ist „🎯 Murphy · nur Demo“
  gesperrt und „🏠 Eigener Host“ gedimmt; die Hosts-Leiste zeigt „kein
  Nachbar“ und die Gast-Metriken direkt, es gibt nichts aufzudecken.
- Startfenster: Für die Ursachen-Szenarien wählt die Sim einen Start-Seed,
  dessen erstes Fenster mindestens 2 Engpass-Wechsel zeigt — eine Auswahl,
  keine Kalibrierung (höchstens 20 Versuche, sonst der Seed mit den
  meisten Wechseln). Ohne sie bliebe bei „Nur Zufall“ etwa jedes siebte
  Fenster ruhig. Dieselbe Auswahl läuft bei jedem Preset-Wechsel und bei
  ⚙ „Neuer Seed“ — geprüft aber mit den Grundschaltern des Presets: Mit
  🛡️, 🏠 oder anderer Schwankung ist das Startfenster nicht garantiert.
  „↺ Neu“ und ⚙ „Gleicher Seed“ behalten den Seed („Gleicher Seed“ auch
  die Schalter). Bleibt ein späteres Fenster ruhig: ⚙ „Neuer Seed“ oder
  ⚙ Schwankung „stark“.
- „🎯 Murphy · nur Demo“: Der Nachbar schlägt zu, sobald sich die letzte
  Engpass-Station erholt hat UND das Eigenrauschen der ANDEREN Station
  (Webserver ↔ DB) im Tief ist (z ≤ −0,3 σ) — und trifft genau diese
  andere Station, mit voller Stärke für 35 s. Frühestens 20 s nach Ende
  des letzten Schlags; kommt kein Tief, schlägt er spätestens 90 s nach
  diesem Ende trotzdem zu — sobald gerade kein Engpass besteht. So
  verschiebt jeder Schlag den Engpass. Kein realistisches
  Verhalten, sondern der Worst Case. NICHT „trifft die Station mit der
  kleinsten Reserve“ — das würde den Engpass nur vertiefen. Schaltbar
  nur im Preset „Nachbar-VM (verdeckt)“.
- „🛡️ Schutzkapazität“: Den Engpass bewusst festlegen — die DB, die
  sich nicht horizontal skalieren lässt — und den anderen Stationen
  Reserve geben, hier den Webservern +20 %. Damit werden die Webserver
  zu Nicht-Engpässen, die DB zum festen Engpass. Bei „Nur Zufall“ hört
  das Wandern auf (Lawrence & Buss 1994, Abstract: „shiftiness declines
  when the capacity of nonbottleneck resources is increased“).
- Gegenprobe im ⚙ „Schutzkapazität +20 % überall“, im Preset „Nur
  Zufall“: Die Überlast verschwindet (klar, mehr Kapazität), aber die
  knappste Station wandert weiter wie vorher — die Fußzeile zählt dann
  deren Wechsel. Es entsteht kein fester Engpass, an dem Back Pressure
  und Shedding ansetzen könnten. Im Preset „Nachbar-VM“ bleiben
  Überlast und Wechsel: Ein Schub frisst auch diese Reserve auf.
- Gegen den Nachbarn hilft Schutzkapazität nur halb: Die Überlastzeit am
  Webserver sinkt deutlich, die Wechsel kaum — ein CPU-Schub nimmt 25–40 %
  der Web-CPU und frisst damit auch die zusätzlichen 20 % samt der
  normalen Reserve auf, und die IO-Schübe treffen die DB. Erst
  „🏠 Eigener Host“ (Isolation: dedizierter Host, eigenes Storage)
  beseitigt die Wechsel.
- Abgrenzung: Die Systemdynamik-Folie (systemdynamik) zeigt das Wandern
  deterministisch mit geskripteten Einbrüchen; der Noisy-Neighbor-Drill im
  Diagnose-Kapitel (noisy-neighbor) übt %steal als Diskriminator an einer
  einzelnen VM. Hier: dieselbe Ursache, ihre Wirkung auf eine ganze Kette —
  und ein IO-Nachbar ganz ohne steal.
- Tab „Erklärung & Modell“: Engpass-Definition (Reserve = Kapazität /
  Nachfrage − 1; Engpass = knappste Station mit Reserve < 0; „kollabiert“
  vs. „abgefangen“), %steal vs. Disk-await, Murphy, Schutzkapazität und
  Eigener Host, das Startfenster samt aktuellem Seed, Modell und bewusste
  Vereinfachungen; unten „Verwandte Sims“ als Sprungknöpfe. Solange der
  Tab offen ist, steht die Sim still.
-->

---
clicks: false
hideInToc: true
routeAlias: engpass-gegenmassnahmen
---

<WanderingBottleneckSim variant="remedies" />

<!--
- Bedienung im PUBLIKUMSFENSTER (wie auf der vorigen Folie): Presenter
  und Publikum rechnen getrennt, Drehbuch und Schalter werden nicht
  synchronisiert.
- Startet im Preset „Rabattaktion“ (Zeile „Szenario:“), Zeitraffer ×20,
  angehalten auf Schritt 0 kurz vor dem Aktionsstart — kein Autoplay.
  Die Drehbuch-Karte rechts führt: „Lage:“ → „Zug:“ → Frage (Schritt 0
  „Wo klemmt es zuerst?“, danach „Wohin wandert der Engpass?“). Erst
  tippen lassen: „Webserver“ / „Bestandsprüfung“ / „Zahlungsdienst“ /
  „bleibt“ (in Schritt 0 „nirgends“), oder „ohne Tipp ▸“. VORSICHT: In
  der Fragephase lösen ▶ und ⏩ den Zug ohne Tipp aus — nicht als Start
  drücken, solange getippt werden soll.
- Nach dem Tipp setzt der Zug die Schalter (sie pulsieren kurz), und die
  Sim läuft von selbst: „⏳ Einschwingen … noch … s Sim-Zeit“; ⏩ spult
  bis zur Auflösung. Dort hält sie an: „✓ Richtig getippt“ / „✗ Getippt:
  …“ / „ohne Tipp“ in der Karte, die Tipp-Knöpfe markieren die richtige
  Antwort, die Fußzeile bringt „Antwort: <Station> · <Zustand>
  (bleibt).“ mit Erklärung. Dann „Weiter ▸“, nach dem letzten Schritt
  „Fazit ▸“: Fazit in der Karte, die Fußzeile zieht die Bilanz in Zahlen
  („Bilanz: rechtzeitig jetzt …“ gegen den Aktionsstart), dazu „x von N
  Tipps richtig“ (laufend oben in der Karte als „x/N“, mit ✓ ab dem
  ersten Treffer); „↺ Von vorn“ startet neu.
- Diagramm: Die Anfragen/s sind gestapelt — rechtzeitig, abgewiesen,
  verloren, „wartet“ (noch in einer Queue); die Stapelhöhe ist die
  Nachfrage. Darunter die Checkouts/s gegen das Limit.
- Die Knöpfe 0 … 5 im Kopf der Karte springen zu jedem Schritt und
  rechnen mit gleichem Seed bis zu dessen Frage neu.
- Alle Schalter lassen sich jederzeit auch einzeln umlegen (Sandbox).
  Weicht man vom Drehbuch ab, meldet die Karte „⚠ Schalter weichen vom
  Drehbuch ab — Tipps gesperrt.“ und bietet „Zurück zu Schritt k“ an.
  Geschieht das während des Einschwingens, bleibt der Tipp „nicht
  gewertet — Schalter wichen ab“. Weicht ein Seed ausnahmsweise vom
  Drehbuch ab, sagt die Fußzeile „Diesmal anders als im Drehbuch …“.
- Schalter-Leiste rechts unten, nach Grundrichtung gruppiert („Zufluss
  bremsen“, „Arbeit verwerfen / reduzieren“, „Kapazität erhöhen“ …). Das
  Drehbuch legt um: in Schritt 1 „Scaling 2→12“ (Modus „reaktiv“), in
  Schritt 2 „BP → Bestand“, in Schritt 3 „Shed: Produktseiten“, in
  Schritt 4 „Feature Shedding“, in Schritt 5 „BP → Zahlung“ und „Shed:
  Checkouts“. Dazu steht dort „Schutzkap. +20 %“ zum Ausprobieren. Die
  Leiste zeigt je Preset nur dessen Züge plus wenige Ablenker;
  eingeschaltete Schalter bleiben immer sichtbar (gedimmt, wenn sie nicht
  zum Preset gehören).
- Drehbuch (rechtzeitig ausgelieferte Seiten und Bestellungen je s,
  gemittelt über viele Seeds, illustrativ):
  0 Aktionsstart → Webserver kollabiert: 2 × 100 = 200 req/s gegen
    1.000. Die Eingangs-Queue wächst, Kunden geben nach 10 s auf, und was
    die Webserver noch rechnen, kommt nach mehr als 2 s — zu spät: 0
    Produktseiten rechtzeitig, 200/s verschwendete Arbeit. Die DB sieht
    höchstens 200 gegen 300 und wirkt gesund.
  1 Scaling 2 → 12, reaktiv → Bestandsprüfung kollabiert. Erkennen 30 s
    + Kaltstart 60 s + Aufwärmen 30 s (neue Instanzen starten bei 40 %),
    volle Kapazität nach 120 s: 12 × 100 = 1.200 req/s gegen 1.000.
    Sobald genug Webserver laufen, trifft die volle Last die
    Bestandsprüfung (300 Produktseiten/s). Ohne Schutz kollabiert sie:
    wieder 0 rechtzeitig, 300/s Arbeit für den Papierkorb.
  2 Back Pressure an der Bestandsprüfung → bleibt, abgefangen.
    Concurrency-Limit vor der DB (höchstens 0,1 s Arbeit in der DB) plus
    BEGRENZTE Eingangs-Queue (0,5 s); Überlauf → 503. Die DB bleibt voll
    ausgelastet — aber keine Arbeit geht mehr verloren: 290 Produktseiten
    und 10 Bestellungen/s rechtzeitig, 700/s abgewiesen.
  3 Load Shedding → bleibt, abgefangen — jetzt früh und nach Priorität:
    Produktseiten zuerst, Checkouts zuletzt. 280 Produktseiten, 28 statt
    10 Bestellungen/s, 690/s sofort abgewiesen statt erst an der Queue.
  4 Feature Shedding → Zahlungsdienst kollabiert. Empfehlungen aus: Eine
    Produktseite kostet 0,3 E statt 1,5 E, die DB schafft 1.500 Seiten/s.
    Jetzt kommen 910 Produktseiten durch, 10 % davon wollen zahlen: 91
    Checkouts/s gegen 70 extern. 0 Bestellungen rechtzeitig, 90/s
    verschwendet.
  5 Kasse schützen (Back Pressure + Shedding am Zahlungsdienst) →
    bleibt, abgefangen. Zahlungsaufrufe aufs Limit begrenzen, überzählige
    Checkouts sofort abweisen („Kasse ausgelastet — Warenkorb bleibt“):
    910 Produktseiten und 70 Bestellungen/s, 20/s abgewiesen. Mehr als 12
    Webserver ändern daran nichts — die Grenze liegt außerhalb des Shops.
- Kernsatz: Wer den Engpass beseitigt (Scaling, Feature Shedding), legt
  den nächsten frei; wer ihn abfängt (Back Pressure, Shedding), verliert
  weniger Arbeit, schafft aber keine Kapazität. Die ganze Kette
  beobachten, nicht nur die Station, die gerade brennt.
- Präzisierung Back Pressure: Sie schafft KEINE Kapazität, sie verlegt
  den Stau an den Rand — in eine begrenzte Queue, deren Überlauf
  abgewiesen wird. Ohne Grenze wäre es nur ein längerer Stau. SRE Book:
  „Usually, if the queue is full, the server will reject new requests.“
- Scaling reaktiv vs. vorgewärmt (Modus-Knopf „reaktiv“ / „vorgew.“
  neben „Scaling 2→12“): reaktiv 30 + 60 + 30 = 120 s bis volle
  Kapazität, vorgewärmt (Warm Pool) 10 s. Beides hilft nur, solange der
  Engpass horizontal skalierbar ist — die Bestands-DB und der externe
  Zahlungsdienst sind es nicht. AWS Warm Pools halten dafür
  „pre-initialized EC2 instances“ bereit. Den Modus umschalten verlässt
  das Drehbuch (Tipps gesperrt) — danach „Zurück zu Schritt k“.
- Praxis zu Schritt 5: Stripe nennt einen Flash Sale ausdrücklich als
  möglichen Auslöser seiner Rate Limits, nennt clientseitig einen Token
  Bucket als gängiges Verfahren und bittet, vor einem absehbaren Ereignis
  den Support zu
  kontaktieren — große Erhöhungen mindestens sechs Wochen im Voraus. Das
  Kontingent VOR der Aktion zu klären ist auch eine Gegenmaßnahme.
- Wer statt Feature Shedding „einfach cachen“ vorschlägt: Das zeigt das
  Preset „Teure Abfragen“ (oder „Cache + Coalescing“ im ⚙). Die
  Empfehlungen bleiben, eine Seite kostet aber noch 0,54 E — in der
  Rabattaktion bleibt die DB damit knapp der Engpass, die Kasse liegt dicht
  dahinter. Die Reservierung im Checkout (1,0 E) kommt nie aus dem Cache —
  sonst wird überverkauft.
- Load Shedding ohne Back Pressure (Sandbox, nicht im Drehbuch): „Shed:
  Produktseiten“ sieht auch die Wartezeit der DB, nicht nur die
  Eingangs-Queue — allein eingeschaltet fängt es die DB also ebenfalls ab.
- Neben der Rabattaktion stehen weitere Presets in der Zeile
  „Szenario:“; jedes spielt eine Familie der Gegenmaßnahmen einzeln
  durch. Für den Vortrag reicht die Rabattaktion.
- Preset „Kurze Spitzen“ (Familie Spitzen zeitlich verteilen): eigenes
  Drehbuch 0 … 2, Zeitraffer ×20 — das Diagramm zeigt 10 min. 200
  Produktseiten/s und 20 Checkouts/s; Blitzangebote bringen alle 2 min für
  30 s 60 Checkouts/s, im Mittel 30. Nach jeder Zahlung geht eine
  Bestätigungsmail an den Mailversand (45 Mails/s), synchron im Checkout.
  Die Kette bekommt eine vierte Karte „Mailversand“ (schmale Karten:
  „Res.“ = Reserve); unten im Diagramm Checkouts und Mails gegen seine
  Kapazität, blass hinterlegt die Blitzangebote. Schritt 0 fragt nach der
  Station, danach eigene Fragen. Die Leiste zeigt dazu „BP → Zahlung“,
  „Shed: Checkouts“, „Scaling 4→8“ und „Schutzkap. +20 %“ als Ablenker.
- Drehbuch „Kurze Spitzen“ (Bestellungen und Mails je s im Mittel der
  letzten 20 s, mitten in der Welle bzw. in der Dauerlast, gemittelt über
  viele Seeds, illustrativ):
  0 Blitzangebote → Mailversand, kollabiert: Im Mittel reichen 45 Mails/s,
    in der Spitze nicht — 15 Mails/s zu viel, nach 30 s 450 im Rückstau,
    bis zu 10 s Wartezeit. Synchron wartet jeder Kunde auf seine Mail: 6 von 60
    Bestellungen/s kommen rechtzeitig, 54/s gehen verloren. Zwischen den
    Wellen läuft alles.
  1 Puffern & glätten → kein Engpass. Schritt 1 „Puffern & glätten“:
    Bestellung sofort bestätigen, Mail aus dem Puffer — höchstens 1.000
    Mails, keine älter als 20 s. Frage „Was passiert mit den Mails?“ —
    Antwort „später, aber alle“: 60 Bestellungen/s, Mails mit 45/s bis zu
    10 s später, keine verloren; in der Pause läuft der Puffer leer.
  2 Dauerlast → Mailversand, abgefangen. Die Aktion wird verlängert:
    dauerhaft 60 Checkouts/s gegen 45 Mails/s. Frage „Und jetzt die
    Mails?“ — Antwort „gehen verloren“: Der Puffer läuft voll (bei 45/s
    greift das Alter: 900 Mails), Mails, die 20 s warten, fliegen raus —
    15 Mails/s. Die 60 Bestellungen/s kommen durch.
- Pointe „Kurze Spitzen“: Ein Puffer verteilt Spitzen über die Zeit, er
  schafft keine Kapazität — er hilft nur, wenn das Mittel unter der
  Kapazität liegt. Azure, Queue-Based Load Leveling: „If your average
  producer rate exceeds the consumer rate, the queue continues to grow and
  latency increases.“ Darum braucht jeder Puffer Grenzen (Größe und
  Alter). Synchron bleibt nur, was der Kunde in der Antwort braucht —
  Azure nennt als Gegenanzeige „The caller requires a low-latency,
  synchronous response.“ Die Zahlung bleibt deshalb im Checkout.
- Preset „Teure Abfragen“ (Familie Arbeit verwerfen / reduzieren):
  dieselbe Karte, eigenes Drehbuch mit den Schritten 0 … 3. Start: 12
  Webserver, Back Pressure an DB und Kasse ist an — die Lehre der
  Rabattaktion. Die Leiste zeigt dazu „Feature Shedding“ und
  „Schutzkap. +20 %“ als Ablenker.
- Drehbuch „Teure Abfragen“ (Seiten und Bestellungen je s, gemittelt
  über viele Seeds, illustrativ):
  0 Newsletter → Bestandsprüfung, abgefangen: 100 → 900 req/s. Eine
    Produktseite kostet die DB 1,5 E, davon 1,2 E für personalisierte
    Empfehlungen; 450 E/s reichen für 300 Seiten/s. Die Webserver haben
    Reserve. 290 Seiten und 10 Bestellungen/s, 600/s abgewiesen.
  1 Scaling → bleibt, abgefangen. Schritt 1 „Scaling 12→20“ (vorgewärmt,
    10 s): 20 × 100 = 2.000 req/s an den Webservern, aber die DB skaliert
    nicht horizontal — weiter 290 Seiten und 10 Bestellungen/s, 590/s
    abgewiesen.
  2 Batching → bleibt, abgefangen. Schritt 2 „Batching“: Die
    Verfügbarkeitsabfragen gehen aus 50 ms als ein Bündel an die DB, der
    Overhead (0,2 E) teilt sich, je Artikel bleiben 0,1 E. Eine Seite
    kostet ≈ 1,3 statt 1,5 E: 330 Seiten und 12 Bestellungen/s, 550/s
    abgewiesen — und jede Seite wartet +25 ms.
  3 Cache → Zahlungsdienst, abgefangen. Schritt 3 „Cache + Coalescing“,
    Schlüssel je Produkt (personalisiert wird nur sortiert): 80 % der
    Empfehlungen ohne DB-Arbeit, 1,2 → 0,24 E; eine Seite ≈ 0,34
    E. Die DB hat Reserve, 820 Seiten/s kommen durch. 10 % davon wollen
    zahlen: 82 Checkouts/s gegen 70 — Back Pressure an der Kasse fängt
    ab, 70 Bestellungen/s, 10/s abgewiesen.
- Pointe „Teure Abfragen“: Arbeit reduzieren wirkt am teuren Teil.
  Batching spart nur den Overhead, der Cache die Empfehlungen — und die
  Funktion bleibt, anders als bei Feature Shedding. Batching kommt
  bewusst vor dem Cache: Umgekehrt stünden DB und Kasse bei der
  Auflösung fast gleichauf, der Engpass hinge am Seed. Trade-offs des
  Batchings: Latenz (Kafka linger.ms, DataLoader), Teilfehler,
  Blast-Radius. Coalescing gegen die „thundering herd“ beim leeren Cache
  nennt die AWS Builders' Library („request coalescing“): viele Clients,
  dieselbe ungecachte Ressource — im Newsletter öffnen alle dieselben
  Produkte. Der Cache der Sim ist sofort warm; den leeren Cache zeigt die
  Sim „Cache-Stampede“.
- Preset „Empfehlungen hängen“ (Familie Überlast isolieren + Verstärkung
  verhindern): eigenes Drehbuch 0 … 3, Echtzeit (×1) — ein Vorfall im
  Sekundentakt, das Diagramm zeigt 2 min. Konstant 220 req/s, davon 20
  Checkouts, auf 4 Webservern mit je 100 Threads. Ab Schritt 1 stellt die
  Karte eigene Fragen statt „Wohin wandert der Engpass?“, die Tipps sind
  deren Antworten. Die Pointe steht meist nach wenigen Sekunden im
  Diagramm — dann spult ⏩ bis zur Auflösung. Die Leiste zeigt dazu „Feature Shedding“ und „Scaling
  4→8“ als Ablenker. Blasses Grün im Diagramm: rechtzeitig, aber ohne
  Empfehlungen.
- Drehbuch „Empfehlungen hängen“ (Seiten und Bestellungen je s, gemittelt
  über viele Seeds, illustrativ):
  0 Hänger → Webserver, kollabiert: Der Empfehlungsdienst antwortet nach
    3 s statt 50 ms. Jede Produktseite hält so lange ihren Web-Thread:
    200 × 3 = 600 Threads nötig, 4 × 100 = 400 da. Der Pool läuft leer,
    auch Checkouts finden keinen Thread — 0 Seiten und 0 Bestellungen
    rechtzeitig, 140/s zu spät, obwohl DB und Kasse Reserve haben.
  1 Bulkheads → bleibt, kollabiert. Schritt 1 „Bulkheads“: Checkout 25 %
    der Threads (100), Rest 75 % (300). Frage „Was passiert mit den
    Checkouts?“ — Antwort „laufen wieder“: 20 Bestellungen/s. Die Seiten
    hängen weiter, 200/s verloren.
  2 Timeouts → kein Engpass. Schritt 2 „Timeouts“: Empfehlungen nach
    300 ms abbrechen, die Seite ohne sie ausliefern. Frage „Was zeigen die
    Produktseiten?“ — Antwort „schnell, ohne Empf.“: 200 Seiten und 20
    Bestellungen/s rechtzeitig, alle ohne Empfehlungen (degradiert);
    höchstens 200 × 0,3 = 60 Threads statt 600.
  3 Circuit Breaker → kein Engpass. Schritt 3 „Circuit Breaker“: ab 50 %
    Fehlern 3 s offen, dann 10 % Proben. Frage „Wartezeit auf
    Empfehlungen?“ — Antwort „gar nicht“: Die Seiten kommen sofort ohne,
    200 Seiten und 20 Bestellungen/s; die DB spart 1,2 E je Seite.
- Pointe „Empfehlungen hängen“: Ein Nebendienst legt über geteilte
  Threads die Kasse lahm — kein Kapazitätsproblem, sondern Warten.
  Bulkheads begrenzen den Schaden und verlieren den Pooling-Effekt,
  Timeouts begrenzen das Warten, der Breaker spart den Aufruf ganz
  (automatisches Feature Shedding). Ohne Timeouts sieht der Breaker der Sim
  den Hänger nicht: Er zählt nur Abbrüche, langsam ist im Modell kein
  Fehler. Nygard, Release It! (Kap. 5 „Stability Patterns“); Azure
  „Bulkhead pattern“: „Isolate the elements of an application into pools
  so that if one element fails, the others continue to function.“
- Preset „Retry-Sturm“ (Familie Verstärkung verhindern): eigenes Drehbuch
  0 … 4, Echtzeit (×1) — das Diagramm zeigt 2 min. Konstant 200 req/s,
  davon 50 Checkouts, gegen einen Zahlungsdienst mit 70/s. Jeder Schritt
  spielt dieselbe Störung ab: 15 s Brownout auf 35 %, dann ein Neustart —
  alle offenen Aufrufe brechen im selben Moment ab. Timeouts (2 s) sind an,
  Retries naiv: bis zu 3 Versuche, sofort. Eine Bestellung zählt nur, wenn
  der ganze Checkout binnen 2 s fertig ist — ein Retry nach einem Timeout
  kommt praktisch immer zu spät. In den Schritten 1 bis 3 läuft der schon
  bekannte Brownout im Zeitraffer (×5) bis 2 s vor dem Neustart, die
  Fußzeile sagt es; ⏩ spult bis zur Auflösung, sobald die Wellen im
  Diagramm stehen. Unten im Diagramm die
  Versuche am Zahlungsdienst gegen seine Kapazität, blass hinterlegt der
  Brownout; die Kasse zeigt „↻ ×… · Spitze …×“. Der Retry-Modus ist ein
  Segmentfeld „aus / naiv / Backoff / +Jitter“; dazu „BP → Zahlung“ und
  „Scaling 4→8“ als Ablenker.
- Drehbuch „Retry-Sturm“ (Bestellungen rechtzeitig und Versuche je
  Zahlung im Mittel der letzten 10 s, gemittelt über viele Seeds,
  illustrativ):
  0 Störung → Zahlungsdienst, kollabiert: Jeder Versuch reißt den Timeout
    und wird sofort wiederholt: 3 × 50 = 150 Versuche/s gegen 70. Der
    Brownout ist vorbei, der Sturm bleibt (metastabil): ×2,8 Versuche je
    Zahlung, 0 Bestellungen/s, 37/s verloren — der Anbieter rechnet für
    Clients, die längst aufgegeben haben.
  1 Backoff → bleibt, kollabiert. Schritt 1 „Backoff“: 2 s, dann 4 s Pause.
    Frage „Wie kommen die Retries an?“ — Antwort „in Wellen“: Wer beim
    Neustart gemeinsam scheitert, kommt gemeinsam wieder, Spitze ≈ 2×
    Mittel. Die Menge bleibt: ×2,6, 2 Bestellungen/s, 41/s verloren.
  2 Jitter → bleibt, kollabiert. Schritt 2 „+Jitter“: Pause zufällig bis
    2 bzw. 4 s. Frage „Und jetzt die Retries?“ — Antwort „gleichmäßig“:
    Spitze ≈ 1,3× Mittel. Glatter, aber nicht besser: ×2,5 Versuche je
    Zahlung halten die Queue voll, 1 Bestellung/s, 35/s verloren — Backoff
    und Jitter verteilen, sie deckeln nicht.
  3 Retry-Budget → kein Engpass. Schritt 3 „Retry-Budget 10 %“: höchstens
    55 statt 150 Versuche/s. Frage „Versuche je Zahlung?“ — Antwort
    „≈ ×1,1“ (über die Störung; nach dem Neustart ×1). Im Brownout
    scheitern Zahlungen weiter, nach dem Neustart erholt sich der Dienst
    sofort: alle 50 Bestellungen/s, ≈ 1/s verloren.
  4 Circuit Breaker → Zahlungsdienst, abgefangen. Schritt 4 „Circuit
    Breaker“, aufgelöst mitten im Brownout, 8,7 s nach dem Zug (Kennzahlen
    über den ganzen Schritt). Frage „Was sehen Kunden an der Kasse?“ —
    Antwort „sofort abgewiesen“: 24/s „Kasse ausgelastet — Warenkorb
    bleibt“ statt Fehler nach Timeouts, 16/s verloren (vor allem, bevor er
    öffnet), 10 Bestellungen/s; ×1 Versuche je Zahlung. Er öffnet erst, wenn
    der Client Timeouts erkennt (≈ 4 s), dann 3 s offen, dann Proben.
    Gelingen sie — 35 % Kapazität reichen dafür —, schließt er, und die
    volle Last reißt ihn wieder auf: Im Brownout flattert er. Ein Breaker
    kennt nur auf und zu, dosieren kann er nicht.
- Pointe „Retry-Sturm“: Retries sind „selfish“ (Brooker, AWS Builders'
  Library). Naiv halten sie den Dienst nach der Störung unten — der
  Auslöser ist vorbei, die Last nicht. Backoff verschiebt, Jitter verteilt
  (SRE Book: „retry ripples“ nach einem „network blip“), erst das Budget
  deckelt: Retries nur, solange ihr Anteil unter 10 % liegt (SRE Book:
  „ratio of requests that correspond to retries“). Envoy nimmt 20 % der
  aktiven Requests als Default, Finagle etwa 20 % — keine universelle Zahl. Der
  Breaker sagt schnell ab, kostet laut Brooker aber Testbarkeit und
  Erholungszeit. Zahlungen nur mit Idempotency Key wiederholen (Stripe),
  und Retries nur auf einer Ebene.
- Preset „Bot-Ansturm“ (Familie Zufluss bremsen): eigenes Drehbuch 0 … 4,
  Zeitraffer ×20 — das Diagramm zeigt 10 min. 250 req/s Kunden (davon 20
  Checkouts) auf 12 Webservern; ab Schritt 0 fragt ein Scraper-Bot — ein
  einziger Client — 500 Produktseiten/s ab, jede so teuer für die DB wie
  eine Kundenseite. Der Lastknoten zeigt den Bot („🤖“) und die 429. Unten
  im Diagramm die Produktseiten: Kunden rechtzeitig, ihre Nachfrage, der
  Bot, gepunktet, was die DB schafft; blass hinterlegt der IO-Schub. Ab
  Schritt 1 eigene Fragen. Die Leiste zeigt dazu „Feature Shedding“ und
  „Scaling 12→20“ als Ablenker; „Rate Limit 10/s“ gibt es nur hier.
- Drehbuch „Bot-Ansturm“ (Kundenseiten und Bestellungen je s im Mittel der
  letzten 20 s, gemittelt über viele Seeds, illustrativ):
  0 Bot-Ansturm → Bestandsprüfung, kollabiert: 500 Bot-Seiten/s kosten je
    1,5 E wie eine Kundenseite — 1.115 E/s gegen 450, 67 % davon vom Bot.
    Die Webserver haben Reserve. Ohne Schutz warten Kunden wie Bot: keine
    Kundenseite rechtzeitig, 600/s verloren.
  1 Load Shedding → bleibt, abgefangen. Schritt 1 „Shed: Produktseiten“:
    Der Shedder sieht die Wartezeit der DB und weist Produktseiten früh ab,
    Checkouts zuletzt. Frage „Wen trifft das Abweisen?“ — Antwort „Kunden
    und Bot“: nur 90 von 230 Kundenseiten/s kommen, 140 Kundenanfragen/s
    abgewiesen; der Bot bekommt 195, 305/s abgewiesen. 20 Bestellungen/s,
    ≈ 1/s verloren.
  2 Rate Limit → bleibt, abgefangen. Schritt 2 „Rate Limit 10/s“, dafür
    „Shed: Produktseiten“ aus: Token Bucket, 10 req/s je Client. Frage „Und
    jetzt — wen trifft es?“ — Antwort „nur den Bot“: 490/s bekommen 429,
    alle 230 Kundenseiten/s kommen, 20 Bestellungen/s. Die DB bleibt auf
    dem Papier der Engpass — die Nachfrage des Bots bleibt —, ist aber zu
    84 % ausgelastet.
  3 Admission Control → bleibt, kollabiert. Schritt 3 „Admission 300/s“,
    dazu ein IO-Schub der Nachbar-VM (Disk-await ×2): Die DB schafft nur
    noch ≈ 171 Seiten/s, das statische Limit lässt 260 req/s durch und
    greift gar nicht; der Bot bleibt bei 490/s 429. Frage „Was sehen Kunden
    jetzt?“ — Antwort „warten, dann Fehler“: keine Kundenseite rechtzeitig,
    260/s verloren.
  4 Back Pressure → bleibt, abgefangen. Schritt 4 „BP → Bestand“, derselbe
    IO-Schub. Frage „Und mit Back Pressure?“ — Antwort „teils sofort 503“:
    150 von 230 Kundenseiten/s rechtzeitig, 80 Kundenanfragen/s sofort 503 statt
    Fehler nach Warten, 18 Bestellungen/s, ≈ 1/s verloren; der Bot weiter
    490/s 429.
- Pointe „Bot-Ansturm“: Rate Limit (wen: je Client) ≠ Admission Control
  (wie viel: global, statisch oder adaptiv) ≠ Load Shedding (reagiert auf
  den Zustand) ≠ Back Pressure (Rückmeldung aus der Kette). Stripe: „A
  load shedder makes its decisions based on the whole state of the system
  rather than the user who is making the request.“ Netflix zu statischen
  RPS-Limits: „in large distributed systems that auto-scale this value
  quickly goes out of date“ — veraltet, sobald sich die Kapazität ändert;
  dort rechnet man mit gleichzeitigen Requests nach Little's Law. Dass das Rate Limit das
  Shedding ablöst, ist Absicht: Der Shedder hätte den IO-Schub auch
  abgefangen. Keiner der vier schafft Kapazität.
- ⚙ („Experimentieren“): „Tipps überspringen“ — dann steht statt der
  Tipp-Knöpfe nur „Zug ausführen ▸“. „Alle Schalter zeigen“ klappt alle
  Gegenmaßnahmen mit Wirkung im Modell auf, nach Grundrichtung. „Neuer Seed“, „Gleicher Seed“ und
  „↺ Neu“ starten das Drehbuch bei Schritt 0 neu und löschen die
  Trefferquote; nur „Neuer Seed“ wechselt den Zufall — hier ohne
  Startfenster-Auswahl, die gilt nur auf der Ursachen-Folie. Die Zahlen
  oben sind Mittelwerte; mit Zufalls-Seed schwanken sie leicht. Live
  steht vor jedem Tipp in der Fußzeile „Rechtzeitig: … Produktseiten/s ·
  … Bestellungen/s · früh abgewiesen …/s · verloren …/s“.
- Tab „Erklärung & Modell“: die sechs Grundrichtungen (Zufluss bremsen,
  Arbeit verwerfen/reduzieren, Kapazität erhöhen, Spitzen verteilen,
  Überlast isolieren, Verstärkung verhindern) mit Beispielen (● = hier
  als Schalter) und der Spalte „schafft Kapazität?“, die Präzisierungen
  und die bewussten Vereinfachungen.
- Überleitung: Debrief aus Kundensicht (nächste Folie), dann das Kapitel
  Diagnose.
-->

---
hideInToc: true
clicks: 6
routeAlias: kundensicht
---

# Debrief: Gegenmaßnahmen aus Kundensicht

Rabattaktion: Schritt 1 ≙ ohne Maßnahme, 2–3 ≙ Back Pressure / Load Shedding, 4 ≙ Feature Shedding

<DeadlineOutcomeViz :step="$clicks" />

<div class="abs-br m-3 text-xs opacity-60">

Theorie & Quellen: <TalkXref slug="20260329-grafana-lgtm-monitoring-in-k8s-distributed-system" anchor="kundensicht-deadline">Monitoring-Talk</TalkXref>

</div>

<!--
- Debrief der Rabattaktion: dieselben Gegenmaßnahmen, gesehen vom Kunden
  mit Deadline (App-Timeout, Load Balancer). Online-Zeilen mit den Zahlen
  der Sim: 1.000 req/s, die Bestands-DB schafft 300 Produktseiten/s.
- Ohne Klick: ohne Maßnahme ≙ Schritt 1 — nach dem Scaling klemmt die DB,
  ungeschützt: alle im Timeout, 300/s Arbeit für den Papierkorb.
- Klick 1: Back Pressure / Load Shedding ≙ Schritte 2–3: 300 rechtzeitig,
  700 sofort abgewiesen. Kein Timeout mehr, aber auch nicht mehr Kunden.
- Klick 2: Feature Shedding ≙ Schritt 4: Die DB schafft 1.500, alle
  Produktseiten kommen durch. „Wenn es reicht“ gilt für die ganze Kette:
  91 Checkouts/s gegen 70 — der Engpass wandert zur Kasse.
- Klick 3: Batch, gedrosselt: dieselbe Aufteilung wie Klick 1, aber nichts
  geht verloren, solange das Fertigstellungsfenster reicht.
- Klick 4: Online + Batch auf einer Queue: Erst Batch kippt sie, Online
  landet im Timeout. Verwandt: Die Nachbar-VM der Ursachen-Folie ist ein
  Batch-Job auf geteiltem Host.
- Klick 5: Workload Separation: Gedrosselt wird nur Batch. „🏠 Eigener
  Host“ in der Sim ist die physische Variante.
- Klick 6: Jitter glättet, schafft keine Kapazität. Für Retries zeigt das
  Preset „Retry-Sturm“: Jitter senkt die Spitze von ≈ 2× auf ≈ 1,3×
  Mittel, aber die Menge bleibt (×2,6 Versuche je Zahlung mit Backoff,
  ×2,5 mit Jitter), die Kasse kollabiert weiter. Erst das Retry-Budget
  deckelt (≈ ×1,1).
- Quellen, Timeout-Tabelle (Load Balancer, Proxy, Browser) und Details:
  Monitoring-Talk, Folie „Gegenmaßnahmen aus Kundensicht: die Deadline“
  (Link unten rechts).
- Überleitung: Den Nachbarn der Ursachen-Folie diagnostizieren wir im
  nächsten Kapitel — mit %steal als Schlüssel-Kanal.
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
- Wirkung auf eine ganze Kette — und ein IO-Nachbar ganz ohne steal, nur
  mit längerem Disk-await: Folie „Wandernde Engpässe“
  (wandernde-engpaesse).
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

- Oszilloskop-Scopes (M/M/1, M/M/c), Fixed-Step- und Gillespie-Sims
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
<span class="chain-node">Composables<br/><small>useSimTransport · usePredictSketch · …</small></span>
<span class="chain-arrow">→</span>
<span class="chain-node">Engines<br/><small>lib/mm1Engine · breakerModel · queueDynamikModel · …</small></span>
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
- Die SimShell-Schale macht 24 Sims kohärent bedienbar: gleiche Preset-Zeile,
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
<tr><td class="mo-axis">individuell</td><td>— (selten sinnvoll)</td><td>M/M/1-Kantine (DES) · Voll-oder-leer (Gillespie)</td></tr>
<tr><td class="mo-axis">aggregiert</td><td>Systemdynamik-Pipeline</td><td>Retry-Sturm (Fluid + Poisson)</td></tr>
</tbody>
</table>

<div v-click class="mt-3">

<Callout tone="warning" title="Wiederkehrendes Motiv">
Theorie-Kurve als Overlay über der Simulation: die Formel liefert den <b>Mittelwert</b>, die Simulation die <b>Streuung</b> — genau dort lebt das Risiko. Am reinsten in der Voll-oder-leer-Sim: die <b>exakte</b> stationäre Verteilung (Gauß-Elimination auf dem CTMC-Generator) liegt als Hülle über dem empirischen Histogramm.
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
- Überleitung: „die nächste Folie plottet alle 24 Sims auf diese zwei
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

Der Mechanismus ist dir schon begegnet: **Fall C („heizt sich selbst auf")** der Voll-oder-leer-Sim — dort lineares Minimal-Feedback, hier die echten Retry-Gleichungen.

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
- Rückverweis: Fall C der Voll-oder-leer-Sim (voll-oder-leer) hat denselben
  Kipp-Mechanismus als Minimalmodell gezeigt — MFPT ≈ 6 900 dort ist die
  Kramers-Barriere, die hier zur MTTF-Klippe wird.
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

- `bullwhipModel`, `burnRate`, `metastableModel` und `queueDynamikModel` gegen analytisch gerechnete Tabellen gepinnt (u. a. geometrisches π, MFPT ≈ 6 900)
- Modelle sind pure JS-Module — ohne Browser testbar, das Engpass-Drehbuch mit 50 Seeds

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

| Vereinfachung                                         | Warum das okay ist                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| kein Event-Heap-DES in den Fluid-Sims                 | fester Takt (Δt = 0,02–0,1 s) reicht für Flüsse und Schwellen                      |
| kein RK4, nur Vorwärts-Euler                          | Δt ist klein gegen die Zeitkonstanten der Systeme                                  |
| Fluid-Approximation verschweigt Tail-Latenz           | dafür gibt es die Latenz-Sim (Monte-Carlo) separat                                 |
| keine Netzwerk-Topologie                              | ein Service, ein Pool — Mesh-Effekte wären ein eigenes Deck                        |
| Diagnose-Familie = **skriptete Traces**               | Drill-Ziel ist das Ablesen der Diskriminatoren, nicht die Dynamik                  |
| „Voll ODER leer": 2-Phasen-MMPP, Feedback nur linear  | Korrelationszeit statt Varianz ist der Treiber — Details im Erklärungs-Tab der Sim |
| „Wandernde Engpässe“: Fluid-Kette, Zahlen illustrativ | zeigt Reihenfolge und Richtung der Verschiebung, kein Sizing                       |

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
- Roser, Nakano & Tanaka — _Constraint Management in Manufacturing Systems_ (JSME Int. J. C, 2003) · Engpässe wandern schon durch Zufall

<div class="mt-6 text-xs opacity-60">

Und ja, dieses Deck ist selbst ein Exponat: gebaut mit einem LLM-Agenten (Claude Code) in ~3 Tagen — inklusive aller 22 Simulationen; die Commits tragen den 🤖-Trailer. Die Simulationen selbst sind älter: eine erste Fassung in reinem HTML hatte mich zuvor — auch mit LLM-Agent-Unterstützung — mehrere Monate gekostet, bis alles lief und von den Lernenden bedient und verstanden wurde.

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

Quellen: Herbert Simon, _The Architecture of Complexity_ (1962) · thesoftwarefrontier.com, _How Systems Really Fail_ · Bronson et al., _Metastable Failures_ (HotOS ’21) · Lee et al., _The Bullwhip Effect_ (1997) · Google SRE Workbook (SLO/Burn-Rate) · Lawrence & Buss, _Shifting Production Bottlenecks_ (1994)

<!--
- Selbststudium-Hinweis wiederholen: Deep-Links, ⚙-Labore, „Gleicher Seed"
  zum Reproduzieren.
- Wer nur eine Sache mitnimmt: der Mittelwert verschweigt die Gefahr —
  nahe der Schwelle entscheidet der Zufall.
-->
