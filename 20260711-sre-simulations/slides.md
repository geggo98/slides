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
